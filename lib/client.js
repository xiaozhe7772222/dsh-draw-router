// dsh-draw-router client: settings panel card for managing draw sources
// Designed & built by 小哲 (xiaozhe7772222) 🐧
// Author: 小哲 (xiaozhe7772222) 🐧 · Maintainer: 小哲 (xiaozhe7772222) 🐧
window.__ModuleLoader__.load({
  id: 'dsh-draw-router',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const { useState, useCallback, useEffect } = React

    const zh = {
      nav: '生图配置', desc: '管理绘图源与模型，模型自动探测，也可手动添加。',
    }

    function installStyles() {
      const css = document.createElement('style')
      css.textContent = `
        .drw-card { font-family: inherit; }
        .drw-source { margin-bottom: 14px; padding: 12px; border: 1px solid var(--dsw-alias-border-l2, #ddd); border-radius: 8px; }
        .drw-source-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .drw-source-name { font-weight: 600; font-size: 13px; }
        .drw-source-url { font-size: 11px; opacity: .6; word-break: break-all; }
        .drw-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 12px; }
        .drw-model { flex: 1; font-family: monospace; font-size: 11px; }
        .drw-x { cursor: pointer; opacity: .45; font-size: 10px; padding: 2px 4px; }
        .drw-x:hover { opacity: 1; }
        .drw-field { display: flex; gap: 6px; margin: 4px 0; }
        .drw-field input { flex: 1; min-width: 0; padding: 4px 8px; font-size: 12px; border: 1px solid var(--dsw-alias-border-l2, #ddd); border-radius: 4px; background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-primary, #333); }
        .drw-btn { padding: 4px 10px; font-size: 12px; border: 1px solid var(--dsw-alias-border-l2, #ddd); border-radius: 4px; background: var(--dsw-alias-interactive-bg, #f0f0f0); color: var(--dsw-alias-label-primary, #333); cursor: pointer; }
        .drw-btn.primary { background: var(--dsw-alias-state-business-primary, #1976d2); border-color: var(--dsw-alias-state-business-primary, #1976d2); color: #fff; }
        .drw-msg { font-size: 11px; margin-top: 6px; padding: 4px 8px; border-radius: 4px; }
        .drw-msg.ok { background: #e8f5e9; color: #2e7d32; }
        .drw-msg.err { background: #ffebee; color: #c62828; }
      `
      document.head.appendChild(css)
      return () => css.remove()
    }

    async function postSources(body) {
      const r = await fetch('/dsh-draw-router/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      return r.json()
    }
    async function getSources() {
      const r = await fetch('/dsh-draw-router/sources')
      return r.json()
    }

    function DrawSettingsCard() {
      const [state, setState] = useState({ sources: {}, loading: true, msg: null, newSource: {}, newModel: {} })
      const refresh = useCallback(async () => {
        const d = await getSources()
        setState((s) => ({ ...s, sources: d.sources || {}, loading: false }))
      }, [])
      useEffect(() => { refresh() }, [refresh])
      const showMsg = (t, text) => { setState((s) => ({ ...s, msg: { type: t, text } })); setTimeout(() => setState((s) => ({ ...s, msg: null })), 3000) }

      const handleAdd = async () => {
        const { name, baseUrl, apiKey } = state.newSource
        if (!name || !baseUrl) return showMsg('err', '名称和地址必填')
        const r = await postSources({ action: 'add', name, baseUrl, apiKey })
        if (r.ok) { showMsg('ok', `已添加 ${name}，识别 ${r.imageModels?.length || 0} 个模型`); refresh() }
        else showMsg('err', r.error || '失败')
      }
      const handleRemove = async (name) => { await postSources({ action: 'remove', name }); refresh() }
      const handleProbe = async (name) => { await postSources({ action: 'probe', name }); refresh() }
      const handleAddModel = async (name) => {
        const m = (state.newModel[name] || '').trim()
        if (!m) return
        await postSources({ action: 'addModel', name, model: m }); refresh()
      }
      const handleRemoveModel = async (n, m) => { await postSources({ action: 'removeModel', name: n, model: m }); refresh() }

      const names = Object.keys(state.sources)
      return React.createElement('div', { className: 'drw-card' },
        React.createElement('h3', { style: { margin: '0 0 8px', fontSize: '14px', fontWeight: 600 } }, '🎨 生图配置'),
        React.createElement('p', { style: { margin: '0 0 12px', fontSize: '12px', opacity: .7 } }, '管理绘图源，模型自动探测。'),

        names.map((n) => {
          const s = state.sources[n]; const models = s.imageModels || []
          return React.createElement('div', { key: n, className: 'drw-source' },
            React.createElement('div', { className: 'drw-source-head' },
              React.createElement('div', null,
                React.createElement('div', { className: 'drw-source-name' }, n),
                React.createElement('div', { className: 'drw-source-url' }, s.baseUrl)),
              React.createElement('button', { className: 'drw-btn', onClick: () => handleRemove(n) }, '移除')),
            React.createElement('div', { style: { fontSize: '11px', opacity: .6, marginBottom: '4px' } }, '模型：'),
            models.map((m, i) => React.createElement('div', { key: m + i, className: 'drw-row' },
              React.createElement('span', { className: 'drw-model' }, m),
              React.createElement('button', { className: 'drw-x', onClick: () => handleRemoveModel(n, m) }, '✕'))),
            React.createElement('div', { className: 'drw-field' },
              React.createElement('input', { placeholder: '手动添加模型名', value: state.newModel[n] || '', onChange: (e) => setState((s) => ({ ...s, newModel: { ...s.newModel, [n]: e.target.value } })), onKeyDown: (e) => { if (e.key === 'Enter') handleAddModel(n) } }),
              React.createElement('button', { className: 'drw-btn', onClick: () => handleAddModel(n) }, '添加')),
            React.createElement('button', { className: 'drw-btn', onClick: () => handleProbe(n) }, '探测模型'))
        }),
        names.length === 0 && React.createElement('p', { style: { opacity: .5, fontSize: '12px' } }, '暂无绘图源'),

        React.createElement('div', { className: 'drw-source', style: { borderStyle: 'dashed' } },
          React.createElement('div', { className: 'drw-source-head' }, React.createElement('span', { className: 'drw-source-name' }, '添加绘图源')),
          React.createElement('div', { className: 'drw-field' }, React.createElement('input', { placeholder: '源名称', value: state.newSource.name || '', onChange: (e) => setState((s) => ({ ...s, newSource: { ...s.newSource, name: e.target.value } })) })),
          React.createElement('div', { className: 'drw-field' }, React.createElement('input', { placeholder: 'API 地址', value: state.newSource.baseUrl || '', onChange: (e) => setState((s) => ({ ...s, newSource: { ...s.newSource, baseUrl: e.target.value } })) })),
          React.createElement('div', { className: 'drw-field' }, React.createElement('input', { type: 'password', placeholder: 'API Key', value: state.newSource.apiKey || '', onChange: (e) => setState((s) => ({ ...s, newSource: { ...s.newSource, apiKey: e.target.value } })) })),
          React.createElement('button', { className: 'drw-btn primary', onClick: handleAdd }, '保存')),
        state.msg && React.createElement('div', { className: `drw-msg ${state.msg.type}` }, state.msg.text))
    }

    function apply(ctx) {
      ctx.effect(installStyles, 'dsh-draw-router: styles')
      ctx.slots.inject('settings.section', function* () {
        yield ctx.slots.register({
          name: 'settings.section',
          id: 'dsh-draw-router-settings',
          key: 'dsh-draw-router-settings',
          order: 60,
          label: () => zh.nav,
          inject: () => ({}),
        }, DrawSettingsCard)
      })
    }

    exports.apply = apply
    exports.inject = ['settingsScope', 'slots']
    return module.exports
  },
})