/**
 * @local/dsh-qoder — Qoder 免费模型直连 DSH 的完整插件。
 *
 * 组成：
 *  1. 内置 Python 反代网关（gateway/，源自 qoder2api-hub MIT，COSY 签名 + 设备码 OAuth），
 *     由本插件按需拉起并托管（127.0.0.1:8790）。
 *  2. `llm` 适配器：provider 路由 `qoder`，把 DSH 的 GenerateOptions 翻译成 OpenAI
 *     Chat Completions 发给本地网关，再把上游 SSE 逐块翻译成 DSH StreamChunk
 *     （真流式 text/reasoning/tool-call，usage + finish 收尾）。
 *  3. 工具 `qoder_login`（start 出授权链接 / status 查账号）与 `qoder_gateway`
 *     （status / restart），爸爸在对话里就能完成登录和体检。
 *
 * 零第三方依赖：只用 node: 内置模块，全部 HTTP 走 node:http（宿主沙箱不保证全局 fetch）。
 */
import { spawn } from 'node:child_process'
import http from 'node:http'
import { appendFileSync, mkdirSync, openSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const GATEWAY_DIR = join(ROOT, 'gateway')
const STATE_DIR = join(ROOT, 'state')

const DEFAULTS = {
  port: 8790,
  apiKey: 'sk-dsh-qoder-9eA1xR',
  panelPassword: 'admin',
  realm: 'cn',
  autoStart: true,
  python: 'auto',
  startupTimeoutMs: 30000,
  streamDeadlineMs: 600000,
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// 运行时配置覆盖（设置页可改：外部模型地址 / API Key），落 state/config.json
// ---------------------------------------------------------------------------
const OVERRIDES_FILE = join(STATE_DIR, 'config.json')

function readOverrides() {
  try {
    const raw = JSON.parse(readFileSync(OVERRIDES_FILE, 'utf8'))
    const out = {}
    if (typeof raw.baseUrl === 'string' && raw.baseUrl.trim()) out.baseUrl = raw.baseUrl.trim().replace(/\/+$/, '')
    if (typeof raw.apiKey === 'string' && raw.apiKey.trim()) out.apiKey = raw.apiKey.trim()
    return out
  } catch { return {} }
}

function writeOverrides(patch) {
  const next = { ...readOverrides() }
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === undefined || v === null || v === '') delete next[k]
    else next[k] = v
  }
  mkdirSync(STATE_DIR, { recursive: true })
  writeFileSync(OVERRIDES_FILE, JSON.stringify(next, null, 2))
  return next
}

/** 网关 HTTP 基座：外部 baseUrl 优先，否则本地 127.0.0.1:port */
function baseOf(cfg) {
  if (cfg.baseUrl) {
    try {
      const u = new URL(cfg.baseUrl)
      return { host: u.hostname, port: Number(u.port) || (u.protocol === 'https:' ? 443 : 80), pathPrefix: u.pathname.replace(/\/+$/, '') }
    } catch {}
  }
  return { host: '127.0.0.1', port: cfg.port, pathPrefix: '' }
}

// ---------------------------------------------------------------------------
// 本地网关 HTTP（node:http，兼容宿主插件 realm；signal 透传取消）
// ---------------------------------------------------------------------------
function gwRequest(cfg, method, path, body, signal, panelToken, timeoutMs) {
  return new Promise((resolve, reject) => {
    const base = baseOf(cfg)
    const headers = { accept: 'application/json' }
    let data = null
    if (body !== undefined && body !== null) {
      data = Buffer.from(JSON.stringify(body))
      headers['content-type'] = 'application/json'
      headers['content-length'] = String(data.length)
    }
    if (cfg.apiKey) headers.authorization = 'Bearer ' + cfg.apiKey
    if (panelToken) headers['x-panel-token'] = panelToken
    const req = http.request(
      { host: base.host, port: base.port, path: base.pathPrefix + path, method, headers, signal, timeout: timeoutMs || 15000 },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          resolve({
            status: res.statusCode,
            text,
            json: () => { try { return JSON.parse(text) } catch { return null } },
          })
        })
        res.on('error', reject)
      },
    )
    req.on('timeout', () => req.destroy(new Error('gateway request timeout')))
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

function gwStream(cfg, payload, signal) {
  return new Promise((resolve, reject) => {
    const base = baseOf(cfg)
    const data = Buffer.from(JSON.stringify(payload))
    const headers = {
      'content-type': 'application/json',
      accept: 'text/event-stream',
      'content-length': String(data.length),
    }
    if (cfg.apiKey) headers.authorization = 'Bearer ' + cfg.apiKey
    const req = http.request(
      { host: base.host, port: base.port, path: base.pathPrefix + '/v1/chat/completions', method: 'POST', headers, signal },
      (res) => resolve(res),
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function healthy(cfg) {
  try {
    const r = await gwRequest(cfg, 'GET', '/health')
    return r.status === 200
  } catch {
    return false
  }
}

function pythonCandidates(cfg) {
  const explicit = cfg.python
  if (explicit && explicit !== 'auto') return [explicit]
  return process.platform === 'win32' ? ['python', 'python3', 'py'] : ['python3', 'python']
}

function spawnGateway(cfg, python) {
  mkdirSync(STATE_DIR, { recursive: true })
  const logFd = openSync(join(STATE_DIR, 'gateway.log'), 'a')
  const child = spawn(
    python,
    ['qoder_proxy.py', '--host', '127.0.0.1', '--port', String(cfg.port), '--api-key', cfg.apiKey, '--accounts-dir', cfg.accountsDir],
    { cwd: GATEWAY_DIR, detached: true, stdio: ['ignore', logFd, logFd] },
  )
  child.unref()
  writeFileSync(join(STATE_DIR, 'gateway.pid'), String(child.pid))
}

async function ensureGateway(cfg) {
  if (cfg.baseUrl) return { ok: true, detail: 'external baseUrl=' + cfg.baseUrl + '，不拉起本地网关' }
  if (await healthy(cfg)) return { ok: true, detail: 'running' }
  if (!cfg.autoStart) return { ok: false, detail: 'autoStart=false 且网关未运行' }
  const tried = []
  for (const python of pythonCandidates(cfg)) {
    tried.push(python)
    try {
      spawnGateway(cfg, python)
    } catch {
      continue
    }
    const budget = Math.min(cfg.startupTimeoutMs, 8000)
    const t0 = Date.now()
    while (Date.now() - t0 < budget) {
      await sleep(1000)
      if (await healthy(cfg)) return { ok: true, detail: 'started with ' + python }
    }
  }
  return { ok: false, detail: '网关未能启动（试过 ' + tried.join(', ') + '），看 state/gateway.log' }
}

// ---------------------------------------------------------------------------
// 面板会话（管理端点需要 X-Panel-Token；默认密码 admin，可被 config 覆盖）
// ---------------------------------------------------------------------------
function findToken(o) {
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      if (k.toLowerCase() === 'token' && typeof v === 'string' && v) return v
      const r = findToken(v)
      if (r) return r
    }
  }
  return ''
}

async function panelToken(cfg) {
  const cache = join(STATE_DIR, 'panel-token')
  try { if (existsSync(cache)) { const t = readFileSync(cache, 'utf8').trim(); if (t) return t } } catch {}
  const r = await gwRequest(cfg, 'POST', '/panel/login', { password: cfg.panelPassword })
  const tok = findToken(r.json())
  if (!tok) throw new Error('panel 登录失败 HTTP ' + r.status + ': ' + r.text.slice(0, 200))
  try { mkdirSync(STATE_DIR, { recursive: true }); writeFileSync(cache, tok) } catch {}
  return tok
}

// ---------------------------------------------------------------------------
// 模型清单（带 60s 缓存；网关未登录时也能列出官方目录）
// ---------------------------------------------------------------------------
let modelsCache = { at: 0, key: '', list: [] }

async function fetchModels(cfg, force) {
  const key = (cfg.baseUrl || 'local:' + cfg.port) + '|' + cfg.apiKey
  if (!force && modelsCache.key === key && modelsCache.list.length && Date.now() - modelsCache.at < 60000) return modelsCache.list
  try {
    const r = await gwRequest(cfg, 'GET', '/v1/models')
    if (r.status === 200) {
      const data = r.json()?.data || []
      const list = data
        .filter((m) => m && m.id)
        .map((m) => ({
          id: String(m.id),
          name: String(m.name || m.display_name || m.id),
          description: m.description ? String(m.description) : undefined,
          contextWindow: Number(m.max_input_tokens || m.context_length || 180000),
        }))
      if (list.length) modelsCache = { at: Date.now(), key, list }
      return modelsCache.list
    }
  } catch {}
  return modelsCache.list
}

// ---------------------------------------------------------------------------
// DSH 消息 → OpenAI Chat Completions
// ---------------------------------------------------------------------------
function textOf(content) {
  let s = ''
  for (const b of content || []) {
    if (b.type === 'text') s += b.text
    else if (b.type === 'image') s += '[image]'
    else if (b.type === 'file') s += '[file]'
  }
  return s
}

function buildPayload(cfg, options) {
  const messages = []
  if (options.system) messages.push({ role: 'system', content: options.system })
  for (const m of options.messages || []) {
    const content = m.content || []
    if (m.role === 'system') { messages.push({ role: 'system', content: textOf(content) }); continue }
    if (m.role === 'developer') continue
    if (m.role === 'user') { messages.push({ role: 'user', content: textOf(content) }); continue }
    if (m.role === 'assistant') {
      const text = textOf(content)
      const tcs = content
        .filter((b) => b.type === 'tool-call')
        .map((b) => ({ id: String(b.id), type: 'function', function: { name: b.name, arguments: b.arguments || '{}' } }))
      if (!text && !tcs.length) continue
      const msg = { role: 'assistant', content: text || null }
      if (tcs.length) msg.tool_calls = tcs
      messages.push(msg)
      continue
    }
    if (m.role === 'tool') {
      const callId = m.toolCallId ?? m.source?.callId ?? ''
      messages.push({ role: 'tool', tool_call_id: String(callId), content: textOf(content) })
      continue
    }
  }
  const payload = { model: options.model, messages, stream: true, stream_options: { include_usage: true } }
  if (options.tools && options.tools.length) {
    payload.tools = options.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description || '', parameters: t.parameters || { type: 'object', properties: {} } },
    }))
  }
  if (typeof options.temperature === 'number') payload.temperature = options.temperature
  if (options.maxTokens) payload.max_tokens = options.maxTokens
  if (options.stop && options.stop.length) payload.stop = options.stop
  return payload
}

// ---------------------------------------------------------------------------
// 上游 SSE → DSH StreamChunk（真流式）
// ---------------------------------------------------------------------------
async function* sseLines(res) {
  res.setEncoding('utf8')
  let buf = ''
  for await (const chunk of res) {
    buf += chunk.replace(/\r\n/g, '\n')
    let idx
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const raw = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      for (const line of raw.split('\n')) {
        if (line.startsWith('data:')) yield line.slice(5).trim()
      }
    }
  }
  const rest = buf.trim()
  if (rest.startsWith('data:')) yield rest.slice(5).trim()
}

function finishReasonOf(raw) {
  if (raw === 'tool_calls') return { kind: 'tool-calls' }
  if (raw === 'length') return { kind: 'max-tokens' }
  if (raw === 'aborted') return { kind: 'aborted', failure: { message: 'upstream aborted', code: 'ABORTED' } }
  return { kind: 'stop' }
}

async function* translate(res, cfg, options) {
  const blocks = []            // 按首现顺序
  const byKey = new Map()      // 'text' | 'reasoning' | tc:<i> → block
  let nextIndex = 0
  const usage = { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 }
  let finish = null
  const deadline = Date.now() + (cfg.streamDeadlineMs || 600000)

  const openBlock = (key, blockType) => {
    let b = byKey.get(key)
    if (!b) {
      b = { index: nextIndex++, blockType, key, text: '', id: '', name: '', args: '', opened: false }
      byKey.set(key, b)
      blocks.push(b)
    }
    if (!b.opened) { b.opened = true; return { type: 'block-start', index: b.index, blockType } }
    return null
  }

  for await (const data of sseLines(res)) {
    if (Date.now() > deadline) { res.destroy(); throw new Error('qoder 流式超过 ' + Math.round((cfg.streamDeadlineMs || 600000) / 1000) + 's 总时限') }
    if (options.signal?.aborted) { res.destroy(); throw new Error('aborted') }
    if (data === '[DONE]') break
    let obj
    try { obj = JSON.parse(data) } catch { continue }
    if (obj.error) {
      const msg = typeof obj.error === 'string' ? obj.error : obj.error.message || JSON.stringify(obj.error)
      throw new Error('qoder 上游错误: ' + msg)
    }
    if (obj.usage) {
      usage.inputTokens = Number(obj.usage.prompt_tokens ?? usage.inputTokens) || usage.inputTokens
      usage.outputTokens = Number(obj.usage.completion_tokens ?? usage.outputTokens) || usage.outputTokens
      usage.reasoningTokens = Number(obj.usage.completion_tokens_details?.reasoning_tokens ?? 0) || 0
      const tot = Number(obj.usage.total_tokens ?? 0)
      if (tot) usage.totalTokens = tot
    }
    const choice = obj.choices && obj.choices[0]
    if (!choice) continue
    const delta = choice.delta || {}
    if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
      const start = openBlock('reasoning', 'reasoning')
      if (start) yield start
      yield { type: 'reasoning-delta', index: byKey.get('reasoning').index, text: delta.reasoning_content }
    }
    if (typeof delta.content === 'string' && delta.content) {
      const start = openBlock('text', 'text')
      if (start) yield start
      const b = byKey.get('text')
      b.text += delta.content
      yield { type: 'text-delta', index: b.index, text: delta.content }
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const key = 'tc:' + (tc.index ?? 0)
        const start = openBlock(key, 'tool-call')
        if (start) yield start
        const b = byKey.get(key)
        if (tc.id && !b.id) { b.id = String(tc.id) }
        const name = tc.function?.name
        if (name && !b.name) b.name = String(name)
        const frag = tc.function?.arguments || ''
        b.args += frag
        yield { type: 'tool-call-delta', index: b.index, id: b.id || key, ...(b.name && !b.nameSent ? ((b.nameSent = true), { name: b.name }) : {}), argumentsDelta: frag }
      }
    }
    if (choice.finish_reason) finish = choice.finish_reason
  }

  for (const b of blocks) {
    if (!b.opened) continue
    if (b.blockType === 'text') yield { type: 'block-end', index: b.index, block: { type: 'text', text: b.text } }
    else if (b.blockType === 'reasoning') yield { type: 'block-end', index: b.index, block: { type: 'reasoning', text: b.text } }
    else yield { type: 'block-end', index: b.index, block: { type: 'tool-call', id: b.id, name: b.name, arguments: b.args || '{}' } }
  }
  yield { type: 'usage', usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, ...(usage.totalTokens ? { totalTokens: usage.totalTokens } : {}), ...(usage.reasoningTokens ? { reasoningTokens: usage.reasoningTokens } : {}) } }
  yield { type: 'finish', reason: finishReasonOf(finish) }
}

async function* runStream(cfg, options) {
  const st = await ensureGateway(cfg)
  if (!st.ok) throw new Error('qoder 网关不可用: ' + st.detail)
  const payload = buildPayload(cfg, options)
  let res
  try {
    res = await gwStream(cfg, payload, options.signal)
  } catch (e) {
    throw new Error('qoder 网关连接失败: ' + e.message)
  }
  if (res.statusCode !== 200) {
    const chunks = []
    for await (const c of res) chunks.push(c)
    const body = Buffer.concat(chunks).toString('utf8')
    throw new Error('qoder 网关 HTTP ' + res.statusCode + ': ' + body.slice(0, 400))
  }
  yield* translate(res, cfg, options)
}

// ---------------------------------------------------------------------------
// 插件装配
// ---------------------------------------------------------------------------
export const inject = ['llm', 'tools', 'webServer']

const objectOutput = {
  schema: { type: 'object', additionalProperties: true },
  render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 1) }],
}

export function apply(ctx, rawConfig = {}) {
  const base = { ...DEFAULTS, ...rawConfig }
  // cfg() 每次现读：设置页保存的覆盖（外部模型地址 / API Key）即时生效
  const cfg = () => ({ ...base, ...readOverrides() })

  // HMR 存活探针：宿主真正重新装配本模块时落一行标记（验证热加载是否生效）
  try {
    mkdirSync(STATE_DIR, { recursive: true })
    appendFileSync(join(STATE_DIR, 'apply.log'), new Date().toISOString() + ' apply pid=' + process.pid + '\n')
  } catch {}

  // 装配即后台探活/拉起，不阻塞激活
  ensureGateway(cfg()).then(() => {}).catch(() => {})

  const adapter = {
    providerInfo: (p) => ({ id: p, name: 'Qoder 免费模型' }),
    providerRetryPolicy: () => undefined,
    // 运行时对每条模型元数据做硬校验：provider 必须逐字等于路由名，
    // id 非空且不重复，name 非空，description 只能是 string 或 undefined。
    async listModels(provider) {
      const ms = await fetchModels(cfg())
      const seen = new Set()
      const out = []
      for (const m of ms) {
        const id = String(m.id || '').trim()
        if (!id || seen.has(id)) continue
        seen.add(id)
        const name = String(m.name || id).trim() || id
        const description = typeof m.description === 'string' && m.description ? m.description : undefined
        out.push({ provider, id, name, ...(description === undefined ? {} : { description }), inputModalities: ['text'] })
      }
      return out
    },
    async resolveModel(provider, model) {
      const ms = await fetchModels(cfg())
      const wanted = String(model || '')
      const hit = ms.find((m) => m.id === wanted) || ms.find((m) => String(m.id).toLowerCase() === wanted.toLowerCase())
      const name = String(hit?.name || wanted).trim() || wanted
      const description = typeof hit?.description === 'string' && hit.description ? hit.description : undefined
      const cw = Number(hit?.contextWindow)
      return {
        provider,
        id: wanted,
        name,
        ...(description === undefined ? {} : { description }),
        inputModalities: ['text'],
        context: { contextWindow: Number.isInteger(cw) && cw > 0 ? cw : 180000 },
        defaultMaxTokens: 8192,
      }
    },
    async prepareCall(p, model, signal) {
      const info = await this.resolveModel(p, model, signal)
      return { model: info, stream: (options) => runStream(cfg(), options) }
    },
    // imageRequestPricing / imageRequestTarget 走基类默认（本路由 text-only）。
    stream: (options) => runStream(cfg(), options),
  }

  const loginTool = {
    name: 'qoder_login',
    description: 'Qoder 设备码登录管理。action=start 生成浏览器授权链接（10 分钟有效，爸爸点开确认即可）；action=status 查询账号池与登录结果。',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['start', 'status'] },
        realm: { type: 'string', enum: ['cn', 'intl'], description: 'cn=国内版 qoder.com.cn（默认，免费额度充足）；intl=国际版 qoder.com' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: objectOutput,
    async execute(args) {
      try {
        if (args.action === 'start') {
          const c = cfg()
          const tok = await panelToken(c)
          const r = await gwRequest(c, 'POST', '/accounts/login/start', { realm: args.realm || c.realm, platform: 'CLI' }, undefined, tok)
          const d = r.json()
          if (r.status !== 200 || !d?.authUrl) return { ok: false, detail: d?.error?.message || 'HTTP ' + r.status + ' ' + r.text.slice(0, 200) }
          try { mkdirSync(STATE_DIR, { recursive: true }); writeFileSync(join(STATE_DIR, 'login-start.json'), JSON.stringify(d)) } catch {}
          return { ok: true, authUrl: d.authUrl, state: d.state, expiresInSec: 600, note: '爸爸用浏览器打开 authUrl 点确认授权即可，账号会自动落盘' }
        }
        const c = cfg()
        const h = await gwRequest(c, 'GET', '/health')
        const hd = h.json() || {}
        let list = []
        try {
          const tok = await panelToken(c)
          const a = await gwRequest(c, 'GET', '/accounts', undefined, undefined, tok)
          const ad = a.json() || {}
          list = (ad.accounts || ad.data || []).map((x) => ({ uid: x.uid, nickname: x.nickname, realm: x.realm, enabled: x.enabled, hasToken: !!(x.accessToken || x.hasRefreshToken) }))
        } catch {}
        const result = existsSync(join(STATE_DIR, 'login-result.json'))
        return { ok: true, gateway: hd.ok === true, accounts: hd.accounts, accounts_ready: hd.accounts_ready, realm: hd.realm, list, pollerSavedLogin: result }
      } catch (e) {
        return { ok: false, detail: e.message }
      }
    },
  }

  const gatewayTool = {
    name: 'qoder_gateway',
    description: '本地 Qoder 反代网关运维。action=status 探活+模型数+日志尾巴；action=restart 杀掉插件托管的进程并重新拉起。',
    parameters: {
      type: 'object',
      properties: { action: { type: 'string', enum: ['status', 'restart'] } },
      required: ['action'],
      additionalProperties: false,
    },
    output: objectOutput,
    async execute(args) {
      try {
        if (args.action === 'restart') {
          const pidFile = join(STATE_DIR, 'gateway.pid')
          if (existsSync(pidFile)) {
            const pid = parseInt(readFileSync(pidFile, 'utf8').trim(), 10)
            if (pid > 0) { try { process.kill(-pid, 'SIGTERM') } catch { try { process.kill(pid, 'SIGTERM') } catch {} } }
            await sleep(2000)
          }
          const st = await ensureGateway(cfg())
          return { ok: st.ok, detail: st.detail }
        }
        const c = cfg()
        const h = await gwRequest(c, 'GET', '/health')
        const ms = await fetchModels(c, true)
        let logTail = ''
        try {
          const p = join(STATE_DIR, 'gateway.log')
          if (existsSync(p)) logTail = readFileSync(p, 'utf8').split('\n').slice(-15).join('\n')
        } catch {}
        return { ok: h.status === 200, health: h.json(), models: ms.length, modelIds: ms.map((m) => m.id), logTail }
      } catch (e) {
        return { ok: false, detail: e.message }
      }
    },
  }

  // ---------------------------------------------------------------------------
  // 设置页 HTTP API（同源 /api/qoder/*，仅回环访问；转发本地网关管理端点）
  // ---------------------------------------------------------------------------
  const API_ROOT = '/api/qoder'

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = []
      req.on('data', (c) => { chunks.push(c); if (chunks.length > 512) req.destroy() })
      req.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        if (!text) return resolve({})
        try { resolve(JSON.parse(text)) } catch (e) { reject(new Error('invalid JSON body')) }
      })
      req.on('error', reject)
    })
  }

  function sendJson(res, status, data) {
    const body = JSON.stringify(data)
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(body)
  }

  function isLoopback(req) {
    try {
      const addr = req.socket?.remoteAddress || ''
      return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
    } catch { return false }
  }

  async function gatewayJson(method, path, body) {
    const c = cfg()
    const tok = await panelToken(c).catch(() => undefined)
    return gwRequest(c, method, path, body, undefined, tok)
  }

  /** 全模型健康检测：串行小对话探活（并发会触发上游风控 403），单次 45s 上限 */
  async function healthCheck() {
    const c = cfg()
    const ms = await fetchModels(c, true)
    const results = []
    for (const m of ms) {
      const t0 = Date.now()
      try {
        const r = await gwRequest(c, 'POST', '/v1/chat/completions', { model: m.id, messages: [{ role: 'user', content: 'ping' }], max_tokens: 8, stream: false }, undefined, undefined, 45000)
        const ms2 = Date.now() - t0
        const d = r.json()
        const reply = d?.choices?.[0]?.message?.content || d?.choices?.[0]?.message?.reasoning_content || ''
        results.push({ model: m.id, ok: r.status === 200, latencyMs: ms2, reply: String(reply).slice(0, 40), error: r.status === 200 ? undefined : r.text.slice(0, 160) })
      } catch (e) {
        results.push({ model: m.id, ok: false, latencyMs: Date.now() - t0, error: e.message })
      }
      await sleep(400)
    }
    return { checkedAt: new Date().toISOString(), results }
  }

  async function handleApi(req, res, url) {
    if (!isLoopback(req)) return sendJson(res, 403, { ok: false, error: { message: '仅本机可访问' } })
    const sub = url.pathname.slice(API_ROOT.length) || '/'
    const method = req.method || 'GET'

    if (method === 'GET' && sub === '/status') {
      const c = cfg()
      const out = { ok: true, external: !!c.baseUrl, overrides: readOverrides(), models: [] }
      try {
        const h = await gwRequest(c, 'GET', '/health')
        const hd = h.json() || {}
        out.gateway = { ok: h.status === 200, accounts: hd.accounts, ready: hd.accounts_ready, realm: hd.realm, external: !!c.baseUrl }
        out.models = (await fetchModels(c, true)).map((m) => ({ id: m.id, name: m.name, contextWindow: m.contextWindow, description: m.description }))
      } catch (e) { out.gateway = { ok: false, error: e.message } }
      return sendJson(res, 200, out)
    }
    if (method === 'GET' && sub === '/accounts') {
      try { const r = await gatewayJson('GET', '/accounts'); return sendJson(res, r.status, r.json()) }
      catch (e) { return sendJson(res, 502, { ok: false, error: { message: e.message } }) }
    }
    if (method === 'POST' && sub === '/login/start') {
      const body = await readBody(req).catch(() => ({}))
      try { const r = await gatewayJson('POST', '/accounts/login/start', { realm: body.realm || cfg().realm, platform: 'CLI' }); return sendJson(res, r.status, r.json()) }
      catch (e) { return sendJson(res, 502, { ok: false, error: { message: e.message } }) }
    }
    if (method === 'GET' && sub === '/login/poll') {
      const state = url.searchParams.get('state') || ''
      try { const r = await gatewayJson('GET', '/accounts/login/poll?state=' + encodeURIComponent(state)); return sendJson(res, r.status, r.json()) }
      catch (e) { return sendJson(res, 502, { ok: false, error: { message: e.message } }) }
    }
    if (method === 'POST' && sub === '/login/cancel') {
      const body = await readBody(req).catch(() => ({}))
      try { const r = await gatewayJson('POST', '/accounts/login/cancel', { state: body.state || '' }); return sendJson(res, r.status, r.json()) }
      catch (e) { return sendJson(res, 502, { ok: false, error: { message: e.message } }) }
    }
    if (method === 'POST' && sub === '/accounts/delete') {
      const body = await readBody(req).catch(() => ({}))
      if (!body.uid) return sendJson(res, 400, { ok: false, error: { message: 'uid required' } })
      try { const r = await gatewayJson('POST', '/accounts/delete', { uid: String(body.uid) }); return sendJson(res, r.status, r.json()) }
      catch (e) { return sendJson(res, 502, { ok: false, error: { message: e.message } }) }
    }
    if (method === 'POST' && sub === '/accounts/toggle') {
      const body = await readBody(req).catch(() => ({}))
      if (!body.uid) return sendJson(res, 400, { ok: false, error: { message: 'uid required' } })
      try { const r = await gatewayJson('POST', '/accounts/set', { uid: String(body.uid), enabled: !!body.enabled }); return sendJson(res, r.status, r.json()) }
      catch (e) { return sendJson(res, 502, { ok: false, error: { message: e.message } }) }
    }
    if (method === 'POST' && sub === '/accounts/refresh') {
      const body = await readBody(req).catch(() => ({}))
      try { const r = await gatewayJson('POST', '/accounts/refresh', body.uid ? { uid: String(body.uid) } : {}); return sendJson(res, r.status, r.json()) }
      catch (e) { return sendJson(res, 502, { ok: false, error: { message: e.message } }) }
    }
    if (method === 'POST' && sub === '/accounts/test') {
      const body = await readBody(req).catch(() => ({}))
      if (!body.uid) return sendJson(res, 400, { ok: false, error: { message: 'uid required' } })
      try { const r = await gatewayJson('POST', '/accounts/test', { uid: String(body.uid), model: body.model || 'auto' }); return sendJson(res, r.status, r.json()) }
      catch (e) { return sendJson(res, 502, { ok: false, error: { message: e.message } }) }
    }
    if (method === 'POST' && sub === '/accounts/checkin') {
      const body = await readBody(req).catch(() => ({}))
      try { const r = await gatewayJson('POST', '/accounts/checkin', body.uid ? { uid: String(body.uid) } : {}); return sendJson(res, r.status, r.json()) }
      catch (e) { return sendJson(res, 502, { ok: false, error: { message: e.message } }) }
    }
    if (method === 'GET' && sub === '/accounts/export') {
      try { const r = await gatewayJson('GET', '/accounts/export?secrets=1'); return sendJson(res, r.status, r.json()) }
      catch (e) { return sendJson(res, 502, { ok: false, error: { message: e.message } }) }
    }
    if (method === 'POST' && sub === '/accounts/import') {
      const body = await readBody(req).catch(() => { return null })
      if (body === null) return sendJson(res, 400, { ok: false, error: { message: 'invalid JSON body' } })
      try { const r = await gatewayJson('POST', '/accounts/import', body); return sendJson(res, r.status, r.json()) }
      catch (e) { return sendJson(res, 502, { ok: false, error: { message: e.message } }) }
    }
    if (method === 'POST' && sub === '/accounts/import/pat') {
      const body = await readBody(req).catch(() => ({}))
      if (!String(body.pat || '').trim()) return sendJson(res, 400, { ok: false, error: { message: 'pat required' } })
      try { const r = await gatewayJson('POST', '/accounts/import/pat', { pat: String(body.pat).trim(), realm: body.realm || cfg().realm }); return sendJson(res, r.status, r.json()) }
      catch (e) { return sendJson(res, 502, { ok: false, error: { message: e.message } }) }
    }
    if (method === 'POST' && sub === '/accounts/import/desktop') {
      const body = await readBody(req).catch(() => ({}))
      const payload = body.all ? { all: true } : (body.path ? { path: String(body.path) } : {})
      try { const r = await gatewayJson('POST', '/accounts/import/desktop', payload); return sendJson(res, r.status, r.json()) }
      catch (e) { return sendJson(res, 502, { ok: false, error: { message: e.message } }) }
    }
    if (method === 'GET' && sub === '/config') {
      return sendJson(res, 200, { ok: true, overrides: readOverrides(), defaults: { port: base.port, apiKey: base.apiKey, realm: base.realm } })
    }
    if (method === 'POST' && sub === '/config') {
      const body = await readBody(req).catch(() => null)
      if (body === null) return sendJson(res, 400, { ok: false, error: { message: 'invalid JSON body' } })
      const next = writeOverrides({ baseUrl: body.baseUrl, apiKey: body.apiKey })
      modelsCache = { at: 0, key: '', list: [] }
      ensureGateway(cfg()).then(() => {}).catch(() => {})
      return sendJson(res, 200, { ok: true, overrides: next })
    }
    if (method === 'POST' && sub === '/health-check') {
      try { return sendJson(res, 200, { ok: true, ...(await healthCheck()) }) }
      catch (e) { return sendJson(res, 502, { ok: false, error: { message: e.message } }) }
    }
    return sendJson(res, 404, { ok: false, error: { message: 'no such qoder api route: ' + method + ' ' + sub } })
  }

  ctx.effect(function* () {
    const reg = ctx.llm.registerAdapter(['qoder'], adapter)
    ctx.tools.register(loginTool)
    ctx.tools.register(gatewayTool)
    const route = ctx.webServer?.register?.({
      kind: 'prefix',
      path: API_ROOT,
      handler: (req, res) => {
        const url = new URL(req.url || ('http://x' + (req.url || '/')), 'http://x')
        handleApi(req, res, url).catch((e) => {
          try { sendJson(res, 500, { ok: false, error: { message: e.message } }) } catch {}
        })
      },
    })
    yield () => { try { route?.() } catch {} ; reg() }
  }, 'dsh-qoder')
}
