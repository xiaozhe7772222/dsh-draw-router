<div align="center">

# dsh-draw-router

**DeepSeek Harness 缺少生图能力？这个插件让它能。**

**DeepSeek Harness (DSH) can't generate images? This plugin fixes that.**

> 🐧 **Designed & built by 小哲** ([@xiaozhe7772222](https://github.com/xiaozhe7772222))
>
> **Author:** 小哲 (xiaozhe7772222) 🐧 · **Maintainer:** 小哲 (xiaozhe7772222) 🐧

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![DSH](https://img.shields.io/badge/DeepSeek%20Harness-0.1.0--rc.6-blue.svg)](https://www.npmjs.com/package/@deepseek-ai/dsh)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-green.svg)](https://nodejs.org)
[![Author](https://img.shields.io/badge/Author-小哲-blue)](https://github.com/xiaozhe7772222)
[![Made with ❤️](https://img.shields.io/badge/Made%20with-%E2%9D%A4%EF%B8%8F-red)](https://github.com/xiaozhe7772222)

填一个 baseURL + API Key → 自动识别绘图模型 → 对话中直接生图

Add a baseURL + API Key → auto-detect image models → draw from chat

</div>

---

**English** | [中文](#中文文档)

---

## English

### The Problem

**DeepSeek Harness (DSH)** is a powerful LLM agent framework, but it has **no built-in image generation capability**. You can't ask the agent to draw a picture, create a diagram, or generate a visual — it simply doesn't know how.

**dsh-draw-router** solves this by acting as a **universal image generation router**. It registers `draw_image` and `draw_list_sources` as agent tools, so the DSH agent can generate images just like it runs bash commands — naturally, in conversation.

### ✨ Features

| Feature | Description |
|---|---|
| 🎨 **Agent-native image gen** | DSH agent can draw images on demand — just ask "画一张图" |
| 🔍 **Auto model discovery** | Enter any OpenAI-compatible `baseURL` + API key → plugin calls `GET /v1/models` and auto-detects image models (never hardcodes model names) |
| 🏭 **Multi-provider** | SenseNova · StepFun · Agnes · Qwen · Tongyi Wanxiang · Jimeng/Seedream · Hunyuan · GPT Image · Flux · Stable Diffusion · Imagen · and any OpenAI-compatible endpoint |
| 🎚️ **Manual model add** | For providers not exposing image models via `/v1/models`, add models manually |
| 🔌 **REST API** | Add/remove/probe draw sources at runtime; draw via `POST /dsh-draw-router/draw` |
| 💾 **Persistent config** | Sources persist to `draw-config.json`, survive restarts |
| 🔒 **Key masking** | API responses never expose full API keys |

### 🧠 How it works

```
User: "帮我画一张流程图，展示API调用过程"
         │
         ▼
Agent calls draw_image(source="sensenova", prompt="...")
         │
         ▼
Plugin calls GET {baseURL}/v1/models → auto-detect image models
         │
         ▼
Plugin calls POST {baseURL}/v1/images/generations
         │
         ▼
Returns image URL → agent displays it in conversation
```

**Model detection works by name pattern matching** — no hardcoded model lists. The plugin recognizes 30+ patterns including `image`, `draw`, `generation`, `flux`, `sd-3`, `hunyuan`, `seedream`, `agnes-image`, `step-image`, `qwen-image`, `wan`, `imagen`, `gpt-image`, `dall`, `t2i`, `i2i` and more.

Each provider's API quirks are handled automatically (per official docs):

| Provider | Auto-detected models | Special handling |
|---|---|---|
| **SenseNova** (商汤) | `sensenova-u1-fast` | Standard OpenAI format |
| **StepFun** (阶跃) | `step-image-edit-2`, `step-2x-large` | `steps`, `cfg_scale`, `negative_prompt` |
| **Agnes** | `agnes-image-2.1-flash`, `2.0-flash` | `size` tiers `1K-4K`, `ratio` |
| **TokenRhythm / Qwen** | Manual add | Standard OpenAI format |
| **DashScope** (阿里云百炼) | `wanx-v1`, `wan2.6-t2i` | Async task + polling |
| **GPT Image** | `gpt-image-1.5`, `dall-e-3` | Standard OpenAI format |
| **Flux** | `flux-2-pro`, `flux.1-dev` | Standard OpenAI format |
| **Stable Diffusion** | `sd-3.5-large`, `stable-image-ultra` | Standard OpenAI format |
| **Hunyuan** (混元) | `hunyuan-image-3.0` | Standard OpenAI format |
| **Seedream** (即梦/豆包) | `seedream-4.x` | Standard OpenAI format |
| **Imagen** | `imagen-4` | Standard OpenAI format |

### 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DeepSeek Harness (DSH)                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              dsh-draw-router (plugin)               │    │
│  │                                                     │    │
│  │  ┌──────────────┐   ┌────────────────────────────┐  │    │
│  │  │ Agent Tools  │   │     REST API (webServer)   │  │    │
│  │  │              │   │                            │  │    │
│  │  │ draw_image   │   │ GET  /dsh-draw-router/     │  │    │
│  │  │ draw_list_   │   │      sources              │  │    │
│  │  │   sources    │   │ POST /dsh-draw-router/     │  │    │
│  │  └──────┬───────┘   │      sources              │  │    │
│  │         │           │ POST /dsh-draw-router/     │  │    │
│  │         │           │      draw                 │  │    │
│  │  ┌──────▼───────────────────────────────┐        │    │
│  │  │        Draw Router Core              │        │    │
│  │  │  - Source registry (baseURL+apiKey)  │        │    │
│  │  │  - Model discovery (GET /v1/models)  │        │    │
│  │  │  - Pattern matching (30+ patterns)   │        │    │
│  │  │  - Per-provider API adaptation       │        │    │
│  │  │  - draw-config.json persistence      │        │    │
│  │  └──────┬───────────────────────────────┘        │    │
│  │         │                                          │    │
│  └─────────┼──────────────────────────────────────────┘    │
│            ▼                                               │
│  ┌────────────────────────────────────────────────┐        │
│  │          Provider Image APIs                    │        │
│  │  SenseNova · StepFun · Agnes · Qwen · Flux ...  │        │
│  └────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 📦 Installation

Two installation methods are supported.

#### Method A: File-based installation (推荐 / Recommended)

Clone the repo and copy files:

```bash
# 1. Clone
git clone https://github.com/xiaozhe7772222/dsh-draw-router.git
cd dsh-draw-router

# 2. Copy plugin files
mkdir -p ~/.dsh/profiles/web/plugins/dsh-draw-router
cp -r lib package.json cordis.patch.yml ~/.dsh/profiles/web/plugins/dsh-draw-router/

# 3. Link to node_modules (so DSH bundle loader can find it)
ln -sfn ../plugins/dsh-draw-router ~/.dsh/profiles/web/node_modules/dsh-draw-router

# 4. Add to bundles in ~/.dsh/profiles/web/package.json
#    (add "dsh-draw-router" to the bundles array)
```

#### Method B: Terminal command installation (终端命令安装)

Install directly via the DSH CLI:

```bash
# If you have published the plugin to npm registry:
cd ~/.dsh/profiles/web
dsh plugin add dsh-draw-router --profile web

# Or install from local package:
dsh plugin add /path/to/dsh-draw-router --profile web
```

After either method, restart DSH:

```bash
npx @deepseek-ai/dsh web
```

Verify it's working:

```bash
# Check the HTTP server is up
curl http://127.0.0.1:3080/dsh-draw-router/sources

# Should return: {"sources":{}}
```

### ⚙️ Configuration

#### Option 1: Static config via `cordis.patch.yml`

```yaml
- insert:
    - id: draw-router
      name: dsh-draw-router
      inject: [tools, webServer]
      config:
        sources:
          stepfun:
            baseUrl: https://api.stepfun.com/v1
            apiKey: your-stepfun-key
          sensenova:
            baseUrl: https://token.sensenova.cn/v1
            apiKey: your-sensenova-key
          agnes:
            baseUrl: https://apihub.agnes-ai.com/v1
            apiKey: your-agnes-key
```

> **baseURL hint**: give the API root (e.g. `https://api.stepfun.com/v1`). The plugin appends `/images/generations` and `/models` automatically.

#### Option 2: REST API (runtime)

```bash
# Add a source (auto-probes models)
curl -X POST http://127.0.0.1:3080/dsh-draw-router/sources \
  -H 'Content-Type: application/json' \
  -d '{"action":"add","name":"stepfun","baseUrl":"https://api.stepfun.com/v1","apiKey":"sk-xxx"}'

# List sources + detected models
curl http://127.0.0.1:3080/dsh-draw-router/sources

# Add a manual model (for providers not exposing image models via /v1/models)
curl -X POST http://127.0.0.1:3080/dsh-draw-router/sources \
  -H 'Content-Type: application/json' \
  -d '{"action":"addModel","name":"tokenrhythm","model":"qwen-image-2.0"}'

# Generate an image
curl -X POST http://127.0.0.1:3080/dsh-draw-router/draw \
  -H 'Content-Type: application/json' \
  -d '{"source":"sensenova","prompt":"a cute cat","size":"2048x2048"}'
```

### 🔌 REST API Reference

| Endpoint | Method | Body | Description |
|---|---|---|---|
| `/dsh-draw-router/sources` | GET | — | List all sources + detected image models |
| `/dsh-draw-router/sources` | POST | `{action:"add", name, baseUrl, apiKey}` | Add a source & probe models |
| `/dsh-draw-router/sources` | POST | `{action:"remove", name}` | Remove a source |
| `/dsh-draw-router/sources` | POST | `{action:"probe", name}` | Re-probe models |
| `/dsh-draw-router/sources` | POST | `{action:"addModel", name, model}` | Add a manual model |
| `/dsh-draw-router/sources` | POST | `{action:"removeModel", name, model}` | Remove a model |
| `/dsh-draw-router/draw` | POST | `{source, prompt, model?, size?, ratio?, n?, response_format?}` | Generate an image |

### 🛠️ Troubleshooting (故障排查)

#### Installation issues (安装问题)

**1. `cannot resolve profile bundle "dsh-draw-router"`**
> running `dsh web` fails with this during boot.

The bundle loader can't find the plugin. Fix:
```bash
# Ensure the symlink exists
ln -sfn ../plugins/dsh-draw-router ~/.dsh/profiles/web/node_modules/dsh-draw-router

# And confirm "dsh-draw-router" is in the bundles array of package.json
# (as a string, NOT as an object)
```

**2. `failed to apply loader entry draw-router: unsupported JSON schema`**
> Plugin loads but the agent tool schema fails validation.

This happens if you modified the source. The `output.schema` must include `additionalProperties: false` (or `true`), and optional parameters must **not** have `required: false`. Use the shipped `lib/index.js` as-is.

**3. Plugin loads but `draw_image` tool is not in chat**
> Agent can't see the draw tools.

The `tools` service must be available. Check `inject: [tools, webServer]` in `cordis.patch.yml` is intact, then restart DSH. Also verify with:
```bash
cd ~ && DSH_SKINS_DIR=... npx -y @deepseek-ai/dsh --profile web --dump-config 2>/dev/null | grep -A3 draw-router
```

#### Runtime issues (运行问题)

**4. Adding a source returns `imageModels: []`**
> Auto-detection found no draw models.

Some providers (e.g. TokenRhythm) don't expose image models via `/v1/models` — only chat models. Fix: add models manually.
```bash
curl -X POST http://127.0.0.1:3080/dsh-draw-router/sources \
  -H 'Content-Type: application/json' \
  -d '{"action":"addModel","name":"tokenrhythm","model":"qwen-image-2.0"}'
```

**5. Draw fails with HTTP 402 / quota_exceeded**
> The provider account has no balance.

This is an **account billing issue**, not a plugin bug. Top up the provider account or switch to another source:
```bash
curl -X POST http://127.0.0.1:3080/dsh-draw-router/draw \
  -H 'Content-Type: application/json' \
  -d '{"source":"sensenova","prompt":"a cat","size":"2048x2048"}'
```

**6. Draw fails with `field Size invalid`**
> The size value isn't supported by the provider's model.

Different providers support different sizes:
- **SenseNova** `sensenova-u1-fast`: `2048x2048`, `1664x2496`, `2752x1536`, etc.
- **StepFun**: `1024x1024`, `768x768`, `1280x800`
- **Agnes**: `1K`/`2K`/`3K`/`4K` + `ratio`

If in doubt, omit `size` and let the provider use its default.

**7. Draw fails with HTTP 401 / 403**
> The API key is invalid or missing.

Check the source's key via the masked value, and re-add with the correct key:
```bash
curl -X POST http://127.0.0.1:3080/dsh-draw-router/sources \
  -H 'Content-Type: application/json' \
  -d '{"action":"remove","name":"bad-source"}'
# then add again with correct apiKey
```

**8. Requests time out**
> Large images or slow providers can take 30-120s.

The plugin uses a 120s request timeout. If your provider is slow, retry once — image generation naturally takes time.

**9. Settings card not visible in Web UI**
> The plugin works (REST API responds) but no settings card shows.

Client bundles load from `lib/client.js`. Make sure:
- `package.json` has `"client": { "platform": "web" }`
- Restart DSH with a clean cache (hard refresh browser: Ctrl+Shift+R)
- If it still fails, the plugin's **server-side tools still work** — configure via REST API instead.

**10. `draw-config.json` corrupted**
> Persistence file is broken after a crash.

Delete it and restart — sources configured via `cordis.patch.yml` will reload, and you can re-add runtime sources.

### 🗂️ Project structure

```
dsh-draw-router/
├── lib/
│   ├── index.js      # Server: model discovery, draw logic, agent tools, REST API
│   └── client.js     # Client: settings panel card (optional)
├── package.json      # Package metadata + DSH bundle declaration
├── cordis.patch.yml  # Static config example
├── draw-config.json  # Runtime persistence (gitignored)
├── README.md
├── CHANGELOG.md
└── LICENSE
```

### 🏷️ Topics

`deepseek-harness` · `dsh` · `dsh-plugin` · `draw` · `image-generation` · `text-to-image` · `sensenova` · `stepfun` · `agnes` · `qwen` · `wanxiang` · `tongyi` · `flux` · `imagen` · `stable-diffusion` · `hunyuan` · `seedream` · `jimeng` · `doubao` · `gpt-image` · `dall-e` · `openai` · `midjourney` · `kling` · `cogview`

### 📄 License

MIT License — free to use, modify, distribute. **Never commit your real API keys to a public repo.**

---

## 中文文档

### 问题

**DeepSeek Harness (DSH)** 是一个强大的 LLM Agent 框架，但它**没有内置的生图能力**。你无法让 agent 画图、创建图表或生成视觉内容——它根本不会。

**dsh-draw-router** 作为一个**统一的图像生成路由器**解决了这个问题。它向 DSH agent 注册了 `draw_image` 和 `draw_list_sources` 工具，让 agent 像执行 bash 命令一样自然地生图——在对话中一句话就够了。

### ✨ 功能特性

| 功能 | 说明 |
|---|---|
| 🎨 **Agent 原生生图** | Agent 可按需生图——一句"画一张图"即可 |
| 🔍 **自动识别模型** | 填入任意 OpenAI 兼容的 `baseURL` + API Key → 插件调用 `GET /v1/models` 自动识别绘图模型（不预设模型名） |
| 🏭 **多厂商支持** | 商汤 · 阶跃 · Agnes · 千问 · 通义万相 · 即梦/Seedream · 混元 · GPT Image · Flux · Stable Diffusion · Imagen · 以及任意 OpenAI 兼容端点 |
| 🎚️ **手动添加模型** | 对于不通过 `/v1/models` 暴露绘图模型的厂商，可手动添加模型 |
| 🔌 **REST API** | 运行时增删绘图源、探测模型、直接生图 |
| 💾 **配置持久化** | 绘图源持久化到 `draw-config.json`，重启后依然有效 |
| 🔒 **Key 脱敏** | API 响应永不暴露完整 API Key |

### 🧠 工作原理

```
用户: "帮我画一张流程图，展示API调用过程"
         │
         ▼
Agent 调用 draw_image(source="sensenova", prompt="...")
         │
         ▼
插件调用 GET {baseURL}/v1/models → 自动识别绘图模型
         │
         ▼
插件调用 POST {baseURL}/v1/images/generations
         │
         ▼
返回图片 URL → agent 在对话中展示图片
```

**模型识别通过名称关键词匹配**——没有硬编码模型列表。插件识别 30+ 种模式，包括 `image`、`draw`、`generation`、`flux`、`sd-3`、`hunyuan`、`seedream`、`agnes-image`、`step-image`、`qwen-image`、`wan`、`imagen`、`gpt-image`、`dall`、`t2i`、`i2i` 等。

每个厂商的 API 差异按官方文档自动处理：

| 厂商 | 自动识别的模型 | 特殊处理 |
|---|---|---|
| **商汤 SenseNova** | `sensenova-u1-fast` | 标准 OpenAI 格式 |
| **阶跃 StepFun** | `step-image-edit-2`, `step-2x-large` | `steps`, `cfg_scale`, `negative_prompt` |
| **Agnes** | `agnes-image-2.1-flash`, `2.0-flash` | `size` 档位 `1K-4K`, `ratio` |
| **TokenRhythm / 千问** | 手动添加 | 标准 OpenAI 格式 |
| **阿里云百炼 DashScope** | `wanx-v1`, `wan2.6-t2i` | 异步任务 + 轮询 |
| **GPT Image** | `gpt-image-1.5`, `dall-e-3` | 标准 OpenAI 格式 |
| **Flux** | `flux-2-pro`, `flux.1-dev` | 标准 OpenAI 格式 |
| **Stable Diffusion** | `sd-3.5-large`, `stable-image-ultra` | 标准 OpenAI 格式 |
| **腾讯混元** | `hunyuan-image-3.0` | 标准 OpenAI 格式 |
| **即梦/豆包/Seedream** | `seedream-4.x` | 标准 OpenAI 格式 |
| **Google Imagen** | `imagen-4` | 标准 OpenAI 格式 |

### 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                   DeepSeek Harness (DSH)                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              dsh-draw-router（插件）                 │    │
│  │                                                     │    │
│  │  ┌──────────────┐   ┌────────────────────────────┐  │    │
│  │  │  Agent 工具   │   │    REST API (webServer)    │  │    │
│  │  │              │   │                            │  │    │
│  │  │ draw_image   │   │ GET  /dsh-draw-router/     │  │    │
│  │  │ draw_list_   │   │      sources              │  │    │
│  │  │   sources    │   │ POST /dsh-draw-router/     │  │    │
│  │  └──────┬───────┘   │      sources              │  │    │
│  │         │           │ POST /dsh-draw-router/     │  │    │
│  │         │           │      draw                 │  │    │
│  │  ┌──────▼───────────────────────────────┐        │    │
│  │  │         绘图路由器核心                 │        │    │
│  │  │  - 绘图源注册表 (baseURL+apiKey)      │        │    │
│  │  │  - 模型发现 (GET /v1/models)          │        │    │
│  │  │  - 模式匹配 (30+ 种模式)              │        │    │
│  │  │  - 厂商专属 API 适配                  │        │    │
│  │  │  - draw-config.json 持久化            │        │    │
│  │  └──────┬───────────────────────────────┘        │    │
│  │         │                                          │    │
│  └─────────┼──────────────────────────────────────────┘    │
│            ▼                                               │
│  ┌────────────────────────────────────────────────┐        │
│  │            厂商图像 API                        │        │
│  │  商汤 · 阶跃 · Agnes · 千问 · Flux ...           │        │
│  └────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 📦 安装

支持两种安装方式。

#### 方式一：文件安装（推荐）

克隆仓库并复制文件：

```bash
# 1. 克隆
git clone https://github.com/xiaozhe7772222/dsh-draw-router.git
cd dsh-draw-router

# 2. 复制插件文件
mkdir -p ~/.dsh/profiles/web/plugins/dsh-draw-router
cp -r lib package.json cordis.patch.yml ~/.dsh/profiles/web/plugins/dsh-draw-router/

# 3. 软链到 node_modules（让 DSH bundle 加载器能找到）
ln -sfn ../plugins/dsh-draw-router ~/.dsh/profiles/web/node_modules/dsh-draw-router

# 4. 在 ~/.dsh/profiles/web/package.json 的 bundles 数组中添加 "dsh-draw-router"
```

#### 方式二：终端命令安装

通过 DSH CLI 直接安装：

```bash
# 如果插件已发布到 npm registry：
cd ~/.dsh/profiles/web
dsh plugin add dsh-draw-router --profile web

# 或从本地包安装：
dsh plugin add /path/to/dsh-draw-router --profile web
```

两种方式任选其一后，重启 DSH：

```bash
npx @deepseek-ai/dsh web
```

验证是否安装成功：

```bash
# 检查 HTTP 服务
curl http://127.0.0.1:3080/dsh-draw-router/sources

# 应返回：{"sources":{}}
```

### ⚙️ 配置说明

#### 方式一：静态配置（cordis.patch.yml）

```yaml
- insert:
    - id: draw-router
      name: dsh-draw-router
      inject: [tools, webServer]
      config:
        sources:
          stepfun:
            baseUrl: https://api.stepfun.com/v1
            apiKey: your-stepfun-key
          sensenova:
            baseUrl: https://token.sensenova.cn/v1
            apiKey: your-sensenova-key
          agnes:
            baseUrl: https://apihub.agnes-ai.com/v1
            apiKey: your-agnes-key
```

> **baseURL 提示**：填 API 根地址（如 `https://api.stepfun.com/v1`）。插件会自动补全 `/images/generations` 和 `/models`。

#### 方式二：REST API（运行时）

```bash
# 添加绘图源（自动探测模型）
curl -X POST http://127.0.0.1:3080/dsh-draw-router/sources \
  -H 'Content-Type: application/json' \
  -d '{"action":"add","name":"stepfun","baseUrl":"https://api.stepfun.com/v1","apiKey":"sk-xxx"}'

# 列出绘图源 + 已识别的模型
curl http://127.0.0.1:3080/dsh-draw-router/sources

# 手动添加模型（用于不通过 /v1/models 暴露绘图模型的厂商）
curl -X POST http://127.0.0.1:3080/dsh-draw-router/sources \
  -H 'Content-Type: application/json' \
  -d '{"action":"addModel","name":"tokenrhythm","model":"qwen-image-2.0"}'

# 直接生图
curl -X POST http://127.0.0.1:3080/dsh-draw-router/draw \
  -H 'Content-Type: application/json' \
  -d '{"source":"sensenova","prompt":"一只可爱的猫","size":"2048x2048"}'
```

### 🔌 REST API 参考

| 端点 | 方法 | Body | 说明 |
|---|---|---|---|
| `/dsh-draw-router/sources` | GET | — | 列出所有绘图源 + 已识别的绘图模型 |
| `/dsh-draw-router/sources` | POST | `{action:"add", name, baseUrl, apiKey}` | 添加绘图源并探测模型 |
| `/dsh-draw-router/sources` | POST | `{action:"remove", name}` | 移除绘图源 |
| `/dsh-draw-router/sources` | POST | `{action:"probe", name}` | 重新探测模型 |
| `/dsh-draw-router/sources` | POST | `{action:"addModel", name, model}` | 手动添加模型 |
| `/dsh-draw-router/sources` | POST | `{action:"removeModel", name, model}` | 移除模型 |
| `/dsh-draw-router/draw` | POST | `{source, prompt, model?, size?, ratio?, n?, response_format?}` | 生成图片 |

### 🛠️ 故障排查

#### 安装问题

**1. 启动报错 `cannot resolve profile bundle "dsh-draw-router"`**
> 启动 DSH 时 bundle 加载器找不到插件。

解决：
```bash
# 确保软链存在
ln -sfn ../plugins/dsh-draw-router ~/.dsh/profiles/web/node_modules/dsh-draw-router

# 确认 package.json 的 bundles 数组中有 "dsh-draw-router"（字符串格式，不是对象）
```

**2. 启动报错 `unsupported JSON schema`**
> 插件加载时工具 schema 验证失败。

说明你修改了源码。`output.schema` 必须包含 `additionalProperties: false`（或 `true`），可选参数**不能**有 `required: false`。请使用原版 `lib/index.js`。

**3. 插件加载成功但 `draw_image` 工具不可用**
> Agent 看不到绘图工具。

检查 `cordis.patch.yml` 中的 `inject: [tools, webServer]` 是否完整，然后重启 DSH。也可通过以下命令验证：
```bash
cd ~ && DSH_SKINS_DIR=... npx -y @deepseek-ai/dsh --profile web --dump-config 2>/dev/null | grep -A3 draw-router
```

#### 运行问题

**4. 添加绘图源后返回 `imageModels: []`**
> 自动探测没有找到绘图模型。

有些厂商（如 TokenRhythm）不通过 `/v1/models` 暴露绘图模型。解决：手动添加模型。
```bash
curl -X POST http://127.0.0.1:3080/dsh-draw-router/sources \
  -H 'Content-Type: application/json' \
  -d '{"action":"addModel","name":"tokenrhythm","model":"qwen-image-2.0"}'
```

**5. 生图失败 HTTP 402 / quota_exceeded**
> 厂商账户余额不足。

这是**账户计费问题**，不是插件 bug。给厂商充值或切换到其他绘图源：
```bash
curl -X POST http://127.0.0.1:3080/dsh-draw-router/draw \
  -H 'Content-Type: application/json' \
  -d '{"source":"sensenova","prompt":"一只猫","size":"2048x2048"}'
```

**6. 生图失败 `field Size invalid`**
> 尺寸参数不被该厂商的模型支持。

不同厂商支持的尺寸不同：
- **商汤** `sensenova-u1-fast`：`2048x2048`、`1664x2496`、`2752x1536` 等
- **阶跃**：`1024x1024`、`768x768`、`1280x800`
- **Agnes**：`1K`/`2K`/`3K`/`4K` + `ratio`

如果不确定，省略 `size` 让厂商使用默认值。

**7. 生图失败 HTTP 401 / 403**
> API Key 无效或缺失。

通过脱敏值检查源 Key，重新添加正确的 Key：
```bash
curl -X POST http://127.0.0.1:3080/dsh-draw-router/sources \
  -H 'Content-Type: application/json' \
  -d '{"action":"remove","name":"bad-source"}'
# 然后用正确的 Key 重新添加
```

**8. 请求超时**
> 大图或慢厂商可能需要 30-120 秒。

插件使用 120 秒请求超时。如果厂商较慢，可重试一次——生图本身需要时间。

**9. 设置面板不显示**
> REST API 正常工作但设置卡片不显示。

Client bundle 从 `lib/client.js` 加载。确保：
- `package.json` 有 `"client": { "platform": "web" }`
- 重启 DSH 后浏览器硬刷新（Ctrl+Shift+R）
- 如果仍然不显示，**插件的服务端功能仍然正常**——通过 REST API 配置即可。

**10. `draw-config.json` 损坏**
> 崩溃后持久化文件损坏。

删除后重启——通过 `cordis.patch.yml` 配置的源会重新加载，运行时添加的源重新添加即可。

### 🗂️ 项目结构

```
dsh-draw-router/
├── lib/
│   ├── index.js      # 服务端：模型发现、绘图逻辑、agent 工具、REST API
│   └── client.js     # 客户端：设置面板卡片（可选）
├── package.json      # 包元数据 + DSH bundle 声明
├── cordis.patch.yml  # 静态配置示例
├── draw-config.json  # 运行时持久化（已 gitignore）
├── README.md
├── CHANGELOG.md
└── LICENSE
```

### 🏷️ 标签 (Topics)

`deepseek-harness` · `dsh` · `dsh-plugin` · `draw` · `image-generation` · `text-to-image` · `sensenova` · `stepfun` · `agnes` · `qwen` · `wanxiang` · `tongyi` · `flux` · `imagen` · `stable-diffusion` · `hunyuan` · `seedream` · `jimeng` · `doubao` · `gpt-image` · `dall-e` · `openai` · `midjourney` · `kling` · `cogview`

### 📄 许可证

MIT License — 自由使用、修改、分发。**请勿将你的真实 API Key 提交到公开仓库。**