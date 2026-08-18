'use strict'
/**
 * dsh-draw-router — 统一绘图路由器（服务端）
 * Designed & built by 小哲 (xiaozhe7772222) 🐧
 *
 * 功能：
 *  1. 用户配置任意 OpenAI 兼容绘图 endpoint（baseURL + apiKey）
 *  2. 自动 GET {base}/models 识别出绘图模型（不预设模型名）
 *  3. 提供 draw_image 工具给 agent 调用
 *  4. REST API 管理绘图源（增删查）
 *
 * 注入：tools（agent 工具）、webServer（REST 接口）
 */
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('node:fs')
const { dirname, join } = require('node:path')

const name = 'draw-router'
const inject = ['tools', 'webServer']
const VERSION = '0.1.1'

const API_BASE = '/dsh-draw-router'
const CONFIG_FILE = join(__dirname, '..', 'draw-config.json')

// ── 模型识别关键词（从模型名自动判断是否绘图模型）─────────────────────
const DRAW_MODEL_PATTERNS = [
  /image/i, /draw/i, /generation/i, /gen/i,
  /u1-fast/i, /wan/i, /wanx/i, /wan2/i,
  /agnes-image/i, /step-1x/i, /step-2x/i, /step-image/i,
  /qwen-image/i, /flux/i, /dall/i, /stable-diffusion/i, /sd-?3/i, /sd-?4/i, /stable-image/i,
  /pixart/i, /seedream/i, /hunyuan/i, /taiyi/i, /cogview/i,
  /ernie-vilg/i, /wenxin/i, /imagen/i, /gpt-image/i, /midjourney/i, /ideogram/i,
  /kling/i, /可灵/i, /即梦/i, /seedance/i, /jimeng/i, /doubao/i, /seedream/i,
  /wan2\.6/i, /wan2\.7/i, /t2i/i, /i2i/i, /txt2img/i,
]

function log(ctx, level, msg) {
  try { ctx.logger[level](`[draw-router] ${msg}`) } catch { /* noop */ }
}
function mask(key) {
  if (!key) return ''
  if (key.length <= 8) return key.slice(0, 2) + '****'
  return key.slice(0, 6) + '****' + key.slice(-4)
}
function readJson(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy() })
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')) } catch { resolve({}) } })
    req.on('error', () => resolve({}))
  })
}
function sendJson(res, code, data) {
  const payload = JSON.stringify(data)
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}
function isDrawModel(modelId) {
  if (!modelId) return false
  return DRAW_MODEL_PATTERNS.some((re) => re.test(modelId))
}
function normalizeModels(raw) {
  const arr = Array.isArray(raw) ? raw : raw?.data
  if (!Array.isArray(arr)) return []
  return arr
    .map((m) => m.id || m.model_id || m.modelId || '')
    .filter(Boolean)
}
function buildEndpoint(baseUrl) {
  const trimmed = (baseUrl || '').trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (/\/images\/generations$/.test(trimmed)) return trimmed
  if (/\/v1$/.test(trimmed)) return `${trimmed}/images/generations`
  if (/\/v1\//.test(trimmed)) return trimmed.replace(/\/v1\/.*$/, '/v1/images/generations')
  return `${trimmed}/v1/images/generations`
}
function buildModelsEndpoint(baseUrl) {
  const trimmed = (baseUrl || '').trim().replace(/\/+$/, '')
  if (/\/images\/generations$/.test(trimmed)) return trimmed.replace(/images\/generations$/, 'models')
  if (/\/v1$/.test(trimmed)) return `${trimmed}/models`
  if (/\/v1\//.test(trimmed)) return trimmed.replace(/\/v1\/.*$/, '/v1/models')
  return `${trimmed}/v1/models`
}
function buildHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
}
function buildDashScopeUrl(baseUrl, path) {
  const trimmed = (baseUrl || '').trim().replace(/\/+$/, '')
  const m = trimmed.match(/(\/[^/]+\/v1)$/)
  if (m) return trimmed.replace(m[1], path)
  const m2 = trimmed.match(/\/v1$/)
  if (m2) return trimmed.replace(/\/v1$/, path)
  return trimmed + path
}
// 修复 Bug 5: 将 lifetime AbortController 接入 fetch
function createFetchSignal(lifetime, timeoutMs) {
  if (typeof AbortSignal.any === 'function') {
    const timeoutController = new AbortController()
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs)
    const combined = AbortSignal.any([lifetime.signal, timeoutController.signal])
    return { signal: combined, clear: () => clearTimeout(timer) }
  }
  // 兼容旧版 Node
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  lifetime.signal.addEventListener('abort', () => { clearTimeout(timer); controller.abort() }, { once: true })
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

async function apply(ctx, config) {
  const cfg = config || {}
  const sources = new Map()
  const lifetime = new AbortController()

  // ── 加载持久化配置 ──
  const persisted = (() => {
    try { return existsSync(CONFIG_FILE) ? JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) : {} } catch { return {} }
  })()
  const merged = { ...(cfg.sources || {}), ...(persisted.sources || {}) }
  for (const [name, s] of Object.entries(merged)) {
    if (!s?.baseUrl) continue
    sources.set(name, {
      baseUrl: s.baseUrl,
      apiKey: s.apiKey || '',
      models: s.models || [],
      manualModels: s.manualModels || [],
      cooldownUntil: 0,
      lastError: '',
    })
  }
  log(ctx, 'info', `loaded ${sources.size} draw sources: ${[...sources.keys()].join(', ') || '(none)'}`)

  function persistSources() {
    try {
      mkdirSync(dirname(CONFIG_FILE), { recursive: true })
      const out = { sources: {} }
      for (const [name, s] of sources) {
        out.sources[name] = { baseUrl: s.baseUrl, apiKey: s.apiKey, models: s.models, manualModels: s.manualModels }
      }
      writeFileSync(CONFIG_FILE, JSON.stringify(out, null, 2), 'utf8')
    } catch (e) {
      log(ctx, 'warn', `persist failed: ${e.message}`)
    }
  }

  async function probeModels(name) {
    const s = sources.get(name)
    if (!s) return []
    const modelsUrl = buildModelsEndpoint(s.baseUrl)
    try {
      const { signal, clear } = createFetchSignal(lifetime, 15000)
      const resp = await fetch(modelsUrl, { headers: buildHeaders(s.apiKey), signal })
      clear()
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        log(ctx, 'warn', `probe '${name}' models failed: ${resp.status} ${text.slice(0, 120)}`)
        s.lastError = `HTTP ${resp.status}`
        return null
      }
      const data = await resp.json()
      const all = normalizeModels(data)
      s.models = all
      s.lastError = ''
      log(ctx, 'info', `probe '${name}': ${all.length} total models`)
      return all
    } catch (e) {
      s.lastError = e.message
      log(ctx, 'warn', `probe '${name}' error: ${e.message}`)
      return null
    }
  }

  function drawModels(name) {
    const s = sources.get(name)
    if (!s) return []
    const detected = (s.models || []).filter(isDrawModel)
    const manual = s.manualModels || []
    return [...new Set([...detected, ...manual])]
  }

  async function callDraw(sourceName, prompt, opts = {}) {
    const s = sources.get(sourceName)
    if (!s) throw new Error(`draw source '${sourceName}' not found`)
    const endpoint = buildEndpoint(s.baseUrl)

    if (s.models.length === 0 && Date.now() >= s.cooldownUntil) {
      const probed = await probeModels(sourceName)
      if (probed === null) {
        s.cooldownUntil = Date.now() + 30000
        throw new Error(`cannot discover models from ${s.baseUrl}: ${s.lastError}`)
      }
    }

    const allModels = drawModels(sourceName)
    if (opts.model && !allModels.includes(opts.model)) {
      // model 由用户手动指定，即使不在自动识别列表也允许
    } else if (allModels.length === 0) {
      throw new Error(`no image models discovered from ${s.baseUrl} (total models: ${(s.models || []).length}). Use POST /dsh-draw-router/sources with action=addModel to add a model manually.`)
    }
    const model = opts.model || allModels[0]

    const body = {
      model,
      prompt,
      n: opts.n || 1,
      response_format: opts.response_format || 'url',
    }
    if (opts.size) body.size = opts.size

    // Agnes 特殊处理
    const srcLower = (sourceName + ' ' + (opts.model || '')).toLowerCase()
    if (srcLower.includes('agnes')) {
      body.size = opts.size || '2K'
      if (opts.ratio) body.ratio = opts.ratio
      body.extra_body = { response_format: body.response_format || 'url' }
      delete body.response_format
    }

    // StepFun 特殊参数
    if (srcLower.includes('step') || srcLower.includes('stepfun')) {
      if (opts.steps) body.steps = opts.steps
      if (opts.cfg_scale) body.cfg_scale = opts.cfg_scale
      if (opts.negative_prompt) body.negative_prompt = opts.negative_prompt
    }

    // 阿里云 DashScope 特殊处理（异步任务）
    const isDashScope = srcLower.includes('dashscope') || srcLower.includes('aliyun') || srcLower.includes('maas')
    if (isDashScope) {
      return await callDashScope(s, prompt, opts, allModels)
    }

    const { signal, clear } = createFetchSignal(lifetime, 120000)
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(s.apiKey),
      body: JSON.stringify(body),
      signal,
    })
    clear()

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`draw failed: HTTP ${resp.status} ${text.slice(0, 300)}`)
    }
    const data = await resp.json()
    const item = data?.data?.[0]
    if (!item) throw new Error(`unexpected response: missing data[0]`)
    return {
      url: item.url || '',
      b64_json: item.b64_json || '',
      revised_prompt: item.revised_prompt || '',
      model: body.model,
      raw: data,
    }
  }

  // 阿里云 DashScope 异步任务实现
  async function callDashScope(s, prompt, opts, allModels) {
    const model = opts.model || allModels[0]
    const createUrl = buildDashScopeUrl(s.baseUrl, '/api/v1/services/aigc/text2image/image-synthesis')
    const { signal: createSignal, clear: createClear } = createFetchSignal(lifetime, 60000)
    const createResp = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${s.apiKey}`,
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model,
        input: { prompt, negative_prompt: opts.negative_prompt || undefined },
        parameters: {
          style: opts.style || '<auto>',
          size: opts.size || '1024*1024',
          n: opts.n || 1,
          seed: opts.seed || undefined,
        },
      }),
      signal: createSignal,
    })
    createClear()
    const createData = await createResp.json().catch(() => ({}))
    if (!createResp.ok || !createData.output?.task_id) {
      throw new Error(`dashscope create failed: HTTP ${createResp.status} ${JSON.stringify(createData).slice(0, 200)}`)
    }
    const taskId = createData.output.task_id

    const taskUrl = buildDashScopeUrl(s.baseUrl, '/api/v1/tasks/') + taskId
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      const { signal: pollSignal, clear: pollClear } = createFetchSignal(lifetime, 10000)
      const pollResp = await fetch(taskUrl, { headers: { 'Authorization': `Bearer ${s.apiKey}` }, signal: pollSignal })
      pollClear()
      const pollData = await pollResp.json().catch(() => ({}))
      const status = pollData.output?.task_status
      if (status === 'SUCCEEDED') {
        const urls = (pollData.output?.results || []).map((r) => r.url)
        return {
          url: urls[0] || '',
          urls,
          model,
          raw: pollData,
        }
      }
      if (status === 'FAILED' || status === 'CANCELED') {
        throw new Error(`dashscope task ${status}: ${JSON.stringify(pollData.output).slice(0, 200)}`)
      }
    }
    throw new Error('dashscope task timeout after 40s')
  }

  // ── agent 工具 ──
  let defineTool
  try {
    const toolsMod = await import('@deepseek-ai/dsh-tools')
    defineTool = toolsMod.defineTool || toolsMod.default?.defineTool
  } catch (e) {
    log(ctx, 'warn', `cannot import @deepseek-ai/dsh-tools: ${e.message}`)
  }

  if (ctx.tools && defineTool) {
    ctx.tools.register(defineTool({
      name: 'draw_image',
      description: 'Generate an image via a configured draw source. Sources & models auto-discovered; use draw_list_sources first to see available providers/models.',
      parameters: {
        prompt: { type: 'string', required: true, description: 'Image generation prompt' },
        source: { type: 'string', description: 'Draw source name (e.g. stepfun, sensenova, agnes, dashscope). Uses first available by default.' },
        model: { type: 'string', description: 'Model name. Auto-picks first detected image model by default.' },
        size: { type: 'string', description: 'Size e.g. 1024x1024 (or 1K/2K/3K/4K + ratio for Agnes)' },
        ratio: { type: 'string', description: 'Aspect ratio for Agnes: 1:1, 16:9, 9:16, ...' },
        n: { type: 'number', description: 'Number of images, default 1' },
        response_format: { type: 'string', description: 'url or b64_json, default url' },
        steps: { type: 'number', description: 'Step count for StepFun models' },
        cfg_scale: { type: 'number', description: 'CFG scale for StepFun models' },
        negative_prompt: { type: 'string', description: 'Negative prompt (StepFun / DashScope)' },
        style: { type: 'string', description: 'Style for DashScope: <auto>, <anime>, <photography>, <painting>, <3d-model>, <watercolor>, <sketch>' },
        seed: { type: 'number', description: 'Random seed for DashScope' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            source: { type: 'string' },
            model: { type: 'string' },
            url: { type: 'string' },
            prompt: { type: 'string' },
            hint: { type: 'string' },
          },
        },
        // 修复 Bug 1+2: render 双参数 + 返回数组
        render: (args, result) => [{ type: 'text', text: result.hint || '图片已生成' }],
      },
      timeoutMs: 130000,
      async execute(params) {
        const prompt = params?.prompt
        if (!prompt?.trim()) throw new Error('prompt is required')
        const src = (params?.source && sources.has(params.source)) ? params.source : defaultSourceName()
        if (!src) throw new Error('no draw sources configured')
        const result = await callDraw(src, prompt.trim(), params)
        return {
          source: src,
          model: result.model,
          url: result.url,
          prompt: prompt.trim(),
          hint: result.url
            ? `图片已生成!\n模型: ${result.model}\n来源: ${src}\nURL: ${result.url}\n请直接输出 Markdown: ![图](${result.url})`
            : result.b64_json
              ? `图片已生成!\n模型: ${result.model}\n来源: ${src}\n(base64 图片数据，请使用 data:image/png;base64,${result.b64_json.slice(0, 50)}... 在对话中显示)`
              : `图片已生成 (b64_json)`,
        }
      },
    }))
    ctx.tools.register(defineTool({
      name: 'draw_list_sources',
      description: 'List configured draw sources and their auto-discovered image models. Use this to know valid model names for draw_image.',
      parameters: {},
      output: {
        schema: { type: 'object', additionalProperties: true, properties: {} },
        render: (args, result) => [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      },
      async execute() {
        const out = {}
        for (const [sname, s] of sources) {
          if ((s.models || []).length === 0 && Date.now() >= s.cooldownUntil) {
            await probeModels(sname)
          }
          out[sname] = {
            baseUrl: s.baseUrl,
            lastError: s.lastError,
            imageModels: drawModels(sname),
            allModelsCount: (s.models || []).length,
          }
        }
        return out
      },
    }))
    log(ctx, 'info', 'tools registered: draw_image, draw_list_sources')
  } else {
    log(ctx, 'warn', `tools NOT registered (ctx.tools=${!!ctx.tools}, defineTool=${!!defineTool})`)
  }

  // ── REST API ──
  function defaultSourceName() {
    const names = [...sources.keys()]
    if (names.length === 0) return undefined
    for (const n of names) {
      if (/sensenova|agnes|tokenrhythm/.test(n)) return n
    }
    return names[0]
  }
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API_BASE}/draw`,
    handler: async (req, res) => {
      if (req.method !== 'POST') { sendJson(res, 405, { error: 'method not allowed' }); return }
      const body = await readJson(req)
      const source = body.source || defaultSourceName()
      if (!source || !sources.has(source)) { sendJson(res, 404, { error: `no source '${source}'` }); return }
      try {
        const result = await callDraw(source, body.prompt, body)
        sendJson(res, 200, { ok: true, url: result.url, model: result.model, source })
      } catch (e) {
        sendJson(res, 500, { error: e.message })
      }
    },
  }), 'draw-router: draw endpoint')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${API_BASE}/sources`,
    handler: async (req, res) => {
      if (req.method === 'GET') {
        const out = {}
        for (const [sname, s] of sources) {
          out[sname] = {
            baseUrl: s.baseUrl,
            apiKeyMasked: mask(s.apiKey),
            lastError: s.lastError,
            modelsCount: (s.models || []).length,
            imageModels: drawModels(sname),
          }
        }
        sendJson(res, 200, { sources: out })
      } else if (req.method === 'POST') {
        const body = await readJson(req)
        const { action, name: sname, baseUrl, apiKey } = body
        if (action === 'add') {
          if (!sname || !baseUrl) { sendJson(res, 400, { error: 'name and baseUrl required' }); return }
          sources.set(sname, { baseUrl, apiKey: apiKey || '', models: [], cooldownUntil: 0, lastError: '' })
          persistSources()
          await probeModels(sname)
          sendJson(res, 200, { ok: true, imageModels: drawModels(sname), lastError: sources.get(sname).lastError })
        } else if (action === 'remove') {
          if (!sources.has(sname)) { sendJson(res, 404, { error: `no source '${sname}'` }); return }
          sources.delete(sname)
          persistSources()
          sendJson(res, 200, { ok: true })
        } else if (action === 'probe') {
          if (!sources.has(sname)) { sendJson(res, 404, { error: `no source '${sname}'` }); return }
          await probeModels(sname)
          sendJson(res, 200, { ok: true, imageModels: drawModels(sname), lastError: sources.get(sname).lastError })
        } else if (action === 'addModel') {
          if (!sources.has(sname)) { sendJson(res, 404, { error: `no source '${sname}'` }); return }
          const s = sources.get(sname)
          if (!body.model) { sendJson(res, 400, { error: 'model name required' }); return }
          if (!s.manualModels) s.manualModels = []
          if (!s.manualModels.includes(body.model)) s.manualModels.push(body.model)
          persistSources()
          sendJson(res, 200, { ok: true, imageModels: drawModels(sname) })
        } else if (action === 'removeModel') {
          if (!sources.has(sname)) { sendJson(res, 404, { error: `no source '${sname}'` }); return }
          const s = sources.get(sname)
          if (s.manualModels) s.manualModels = s.manualModels.filter(m => m !== body.model)
          persistSources()
          sendJson(res, 200, { ok: true, imageModels: drawModels(sname) })
        } else {
          sendJson(res, 400, { error: `unknown action '${action}'` })
        }
      } else {
        sendJson(res, 405, { error: 'method not allowed' })
      }
    },
  }), 'draw-router: sources route')

  ctx.effect(() => () => { lifetime.abort() })
}

module.exports = { name, inject, apply }