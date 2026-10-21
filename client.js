window.__ModuleLoader__.load({
	id: 'dsh-qoder',
	factory(require) {
		const React = require('react')
		const h = React.createElement
		const { useState, useEffect, useRef, useCallback } = React

		const NS = 'settings.qoder'
		const API = '/api/qoder'

		const zh = {
			nav: 'Qoder 免费模型网关',
			title: 'Qoder 免费模型网关',
			sub: '内置账号开箱即用（先用我的）；也可以添加个人账号、分享账号池、管理模型与检测健康。',
			retry: '重试',
			loadErr: '加载失败',
			gw: '网关状态',
			gwOk: '本地网关运行中',
			gwExternal: '外部模型地址',
			gwDown: '网关未就绪',
			ready: '就绪账号',
			modelCount: '可用模型',
			accounts: '账号池',
			builtIn: '内置账号（先用我的）',
			personal: '个人账号',
			addAccount: '添加个人账号',
			shareAll: '分享全部账号',
			importBtn: '导入账号',
			importTitle: '粘贴分享的账号 JSON（数组或单个对象）',
			importGo: '开始导入',
			importCancel: '取消',
			nickname: '昵称',
			realm: '区服',
			state: '状态',
			enabled: '已启用',
			disabled: '已停用',
			expires: 'Token 到期',
			lastError: '最近错误',
			test: '测试',
			refresh: '刷新Token',
			enable: '启用',
			disable: '停用',
			del: '删除',
			delConfirm: '确定删除该账号？',
			testOk: '测试通过',
			testFail: '测试失败',
			refreshing: '刷新中…',
			loginTitle: '添加个人账号（设备码授权）',
			loginStep1: '第 1 步：点击下面的链接，用你的 Qoder 账号登录并确认授权（10 分钟内有效）。',
			loginOpen: '打开授权页面',
			loginStep2: '第 2 步：授权完成后本页会自动检测并保存账号，无需其他操作。',
			loginWaiting: '等待授权完成…',
			loginOk: '授权成功，账号已自动保存！',
			loginExpired: '授权链接已过期，请重新发起。',
			loginErr: '授权失败：',
			loginCancel: '取消本次登录',
			models: '模型',
			ctx: '上下文',
			health: '模型健康检测',
			healthGo: '检测全部模型',
			healthBusy: '检测中（每个模型发一条 ping）…',
			healthHint: '会对每个模型真实请求一次极小对话；免费档（Flash 系列）不消耗额度，付费档消耗极少。',
			healthOk: '正常',
			healthFail: '异常',
			latency: '延迟',
			adv: '模型地址与 Key',
			advHint: '留空 = 使用内置本地网关。填外部地址可把模型路由指向任意 OpenAI 兼容端点（保存后立即生效，无需重启）。',
			baseUrl: '模型地址 (Base URL)',
			apiKey: 'API Key',
			apiKeyPh: '留空 = 内置 Key',
			baseUrlPh: '留空 = 本地网关 (127.0.0.1)',
			save: '保存',
			saved: '已保存，立即生效',
			usingExternal: '当前使用外部地址：',
			usingLocal: '当前使用内置本地网关',
			extWarn: '使用外部模型地址时，账号池管理仅对本地网关有效。',
			ok: '成功',
			fail: '失败',
			none: '暂无账号',
			exported: '已导出账号 JSON（含 refreshToken，导入即用）',
			copied: '已复制',
			checkin: '每日签到',
			checkinBusy: '签到中…',
			checkinDone: '签到完成',
			checkinNone: '今天没有可领的签到奖励（可能已签过）',
			quota: '额度',
			quotaExhausted: '额度用尽',
			quotaExhaustedModel: '额度用尽·该模型需付费',
			quotaReset: '周期重置',
			timeout: '请求超时',
			checkinHint: '免费档（Flash 系列）不消耗额度；付费档与 auto 需要剩余额度。',
			authHint: '授权页需先登录 Qoder；登录后会跳回设备确认页，务必在确认页点「确认授权」。链接 10 分钟内有效。',
			expiresIn: '有效期剩余',
			manualCheck: '我已完成授权，立即检测',
			sessionLost: '授权会话已失效，请重新发起登录',
			pollNetErr: '轮询异常，请重试：',
			loginManualOk: '检测到授权成功！',
			importJson: 'JSON 导入',
			importPat: 'PAT 导入',
			patTitle: '粘贴 pt- 开头的个人访问令牌（Qoder 设置页生成）',
			patGo: '导入 PAT',
			patOk: 'PAT 导入成功',
			desktopScan: '扫描本机客户端凭证',
			desktopScanBusy: '扫描中…',
			desktopImportAll: '导入全部有效凭证',
			desktopNone: '本机未检测到已登录的 Qoder 桌面端 / CLI 凭证',
			desktopValid: '有效',
			desktopInvalid: '不可用',
		}
		const en = {
			nav: 'Qoder Free-Model Gateway',
			title: 'Qoder Free-Model Gateway',
			sub: 'Built-in account works out of the box; add personal accounts, share the pool, manage models and run health checks.',
			retry: 'Retry',
			loadErr: 'Load failed',
			gw: 'Gateway status',
			gwOk: 'Local gateway running',
			gwExternal: 'External base URL',
			gwDown: 'Gateway not ready',
			ready: 'Ready accounts',
			modelCount: 'Models',
			accounts: 'Account pool',
			builtIn: 'Built-in account (use mine first)',
			personal: 'Personal accounts',
			addAccount: 'Add personal account',
			shareAll: 'Share all accounts',
			importBtn: 'Import accounts',
			importTitle: 'Paste shared account JSON (array or single object)',
			importGo: 'Import',
			importCancel: 'Cancel',
			nickname: 'Nickname',
			realm: 'Realm',
			state: 'State',
			enabled: 'Enabled',
			disabled: 'Disabled',
			expires: 'Token expires',
			lastError: 'Last error',
			test: 'Test',
			refresh: 'Refresh token',
			enable: 'Enable',
			disable: 'Disable',
			del: 'Delete',
			delConfirm: 'Delete this account?',
			testOk: 'Test passed',
			testFail: 'Test failed',
			refreshing: 'Refreshing…',
			loginTitle: 'Add personal account (device-code auth)',
			loginStep1: 'Step 1: open the link below, sign in with your Qoder account and confirm (valid 10 minutes).',
			loginOpen: 'Open authorization page',
			loginStep2: 'Step 2: after granting, this page detects and saves the account automatically.',
			loginWaiting: 'Waiting for authorization…',
			loginOk: 'Authorized! Account saved automatically.',
			loginExpired: 'Link expired, please start again.',
			loginErr: 'Authorization failed: ',
			loginCancel: 'Cancel login',
			models: 'Models',
			ctx: 'Context',
			health: 'Model health check',
			healthGo: 'Check all models',
			healthBusy: 'Checking (one ping per model)…',
			healthHint: 'Sends a tiny real request per model; free Flash models cost nothing, paid tiers cost a negligible amount.',
			healthOk: 'OK',
			healthFail: 'FAIL',
			latency: 'Latency',
			adv: 'Model base URL & API key',
			advHint: 'Empty = built-in local gateway. Point at any OpenAI-compatible endpoint; applies immediately, no restart.',
			baseUrl: 'Model base URL',
			apiKey: 'API Key',
			apiKeyPh: 'Empty = built-in key',
			baseUrlPh: 'Empty = local gateway (127.0.0.1)',
			save: 'Save',
			saved: 'Saved, effective immediately',
			usingExternal: 'Using external base URL: ',
			usingLocal: 'Using built-in local gateway',
			extWarn: 'With an external base URL, pool management only affects the local gateway.',
			ok: 'OK',
			fail: 'Failed',
			none: 'No accounts yet',
			exported: 'Exported account JSON (includes refreshTokens, import-ready)',
			copied: 'Copied',
			checkin: 'Daily check-in',
			checkinBusy: 'Checking in…',
			checkinDone: 'Check-in done',
			checkinNone: 'No check-in reward available today (maybe already claimed)',
			quota: 'Quota',
			quotaExhausted: 'Quota exhausted',
			quotaExhaustedModel: 'Quota exhausted · paid model',
			quotaReset: 'resets',
			timeout: 'Timeout',
			checkinHint: 'Free Flash models cost nothing; paid tiers and auto need remaining quota.',
			authHint: 'Sign in to Qoder on the auth page first; after sign-in it returns to the device confirm page — be sure to click Confirm there. Valid for 10 minutes.',
			expiresIn: 'Expires in',
			manualCheck: 'I already authorized — check now',
			sessionLost: 'Authorization session lost, please start again',
			pollNetErr: 'Polling error, please retry: ',
			loginManualOk: 'Authorization detected!',
			importJson: 'JSON import',
			importPat: 'PAT import',
			patTitle: 'Paste a pt- personal access token (created in Qoder settings)',
			patGo: 'Import PAT',
			patOk: 'PAT imported',
			desktopScan: 'Scan local client credentials',
			desktopScanBusy: 'Scanning…',
			desktopImportAll: 'Import all valid credentials',
			desktopNone: 'No signed-in Qoder desktop / CLI credential found on this machine',
			desktopValid: 'valid',
			desktopInvalid: 'unusable',
		}
		let T = (k) => zh[k] || k

		// ------------------------------------------------------------------ api
		async function apiGet(path) {
			const r = await fetch(API + path, { headers: { accept: 'application/json' } })
			const body = await r.json().catch(() => null)
			if (!r.ok || (body && body.ok === false)) throw new Error(body?.error?.message || ('HTTP ' + r.status))
			return body
		}
		async function apiPost(path, payload) {
			const r = await fetch(API + path, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload || {}),
			})
			const body = await r.json().catch(() => null)
			if (!r.ok || (body && body.ok === false)) throw new Error(body?.error?.message || ('HTTP ' + r.status))
			return body
		}

		// -------------------------------------------------------------- styles
		const S = {
			wrap: { display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 860 },
			card: { background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
			title: { fontSize: 15, fontWeight: 600, color: 'var(--dsw-alias-label-primary)', margin: 0 },
			sub: { fontSize: 12.5, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)', margin: 0 },
			row: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
			grow: { flex: 1 },
			btn: { border: '1px solid var(--dsw-alias-border-l2)', background: 'transparent', color: 'var(--dsw-alias-label-primary)', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, cursor: 'pointer' },
			btnPrimary: { border: '1px solid var(--dsw-alias-brand-primary)', background: 'var(--dsw-alias-brand-primary)', color: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 12.5, cursor: 'pointer' },
			btnDanger: { border: '1px solid var(--dsw-alias-border-l2)', background: 'transparent', color: 'var(--dsw-alias-state-error-primary)', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, cursor: 'pointer' },
			btnDis: { opacity: 0.45, cursor: 'default', pointerEvents: 'none' },
			badgeOk: { fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--dsw-alias-state-success-primary) 18%, transparent)', color: 'var(--dsw-alias-state-success-primary)' },
			badgeErr: { fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--dsw-alias-state-error-primary) 18%, transparent)', color: 'var(--dsw-alias-state-error-primary)' },
			badgeIdle: { fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--dsw-alias-state-warn-primary) 18%, transparent)', color: 'var(--dsw-alias-state-warn-primary)' },
			kv: { display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--dsw-alias-label-secondary)' },
			kvV: { color: 'var(--dsw-alias-label-primary)' },
			acct: { display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8, padding: '10px 12px', background: 'var(--dsw-alias-bg-layer-2)' },
			link: { color: 'var(--dsw-alias-brand-primary)', textDecoration: 'none', wordBreak: 'break-all' },
			input: { background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8, padding: '7px 10px', fontSize: 12.5, color: 'var(--dsw-alias-label-primary)', width: '100%', boxSizing: 'border-box' },
			label: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginBottom: 4 },
			mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 },
			msgOk: { fontSize: 12.5, color: 'var(--dsw-alias-state-success-primary)' },
			msgErr: { fontSize: 12.5, color: 'var(--dsw-alias-state-error-primary)', wordBreak: 'break-all' },
			ta: { background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8, padding: 10, fontSize: 12, color: 'var(--dsw-alias-label-primary)', width: '100%', minHeight: 110, boxSizing: 'border-box', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
			hr: { border: 'none', borderTop: '1px solid var(--dsw-alias-border-l1)', margin: 0 },
			healthRow: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, padding: '4px 0' },
		}
		const btn = (primary, disabled) => ({ ...(primary ? S.btnPrimary : S.btn), ...(disabled ? S.btnDis : {}) })

		function fmtTime(iso) {
			if (!iso) return '-'
			try { return new Date(iso).toLocaleString() } catch { return String(iso) }
		}
		function fmtCtx(n) {
			n = Number(n)
			if (!Number.isFinite(n) || n <= 0) return '-'
			return n >= 1000000 ? (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + 'M' : Math.round(n / 1000) + 'K'
		}
		function fmtUnix(ts) {
			const n = Number(ts)
			if (!Number.isFinite(n) || n <= 0) return '-'
			try { return new Date(n * 1000).toLocaleString() } catch { return String(ts) }
		}
		function shortErr(e) {
			const s = String(e || '')
			if (s.includes('"code":"112"')) return T('quotaExhaustedModel')
			if (/timeout/i.test(s)) return T('timeout')
			if (s.includes('no usable account')) return T('quotaExhausted')
			return s.slice(0, 90)
		}

		// ----------------------------------------------------------- components
		function Msg({ msg }) {
			if (!msg) return null
			return h('div', { style: msg.kind === 'err' ? S.msgErr : S.msgOk }, msg.text)
		}

		function AccountCard({ a, busy, onToggle, onDelete, onTest, onRefresh }) {
			const errText = a.lastError ? String(a.lastError) : ''
			return h('div', { style: S.acct },
				h('div', { style: S.row },
					h('span', { style: { ...S.kvV, fontWeight: 600 } }, a.nickname || a.uid?.slice(0, 8)),
					a.realm ? h('span', { style: S.kv }, a.realm) : null,
					h('span', { style: a.enabled ? S.badgeOk : S.badgeIdle }, a.enabled ? T('enabled') : T('disabled')),
					a.inCooldown ? h('span', { style: S.badgeErr }, 'cooldown') : null,
					h('div', { style: S.grow }),
					h('button', { style: btn(false, busy === 'test:' + a.uid), onClick: () => onTest(a) }, busy === 'test:' + a.uid ? T('test') + '…' : T('test')),
					h('button', { style: btn(false, busy === 'refresh:' + a.uid), onClick: () => onRefresh(a) }, busy === 'refresh:' + a.uid ? T('refreshing') : T('refresh')),
					h('button', { style: btn(false, busy === 'toggle:' + a.uid), onClick: () => onToggle(a) }, a.enabled ? T('disable') : T('enable')),
					h('button', { style: btn(true, false), onClick: () => { if (window.confirm(T('delConfirm'))) onDelete(a) } }, T('del')),
				),
				h('div', { style: S.row },
					h('span', { style: S.kv }, 'uid: ', h('span', { style: { ...S.kvV, ...S.mono } }, a.uid || '-')),
					h('span', { style: S.kv }, T('expires') + ': ', h('span', { style: S.kvV }, fmtTime(a.expiresAt))),
					a.credits && a.credits.size != null ? h('span', { style: S.kv },
						T('quota') + ': ',
						h('span', { style: S.kvV }, `${a.credits.remain ?? '?'}/${a.credits.size}`),
						a.credits.exceeded ? h('span', { style: { ...S.badgeErr, marginLeft: 6 } }, T('quotaExhausted') + ' · ' + T('quotaReset') + ' ' + fmtUnix(a.credits.expires_at)) : null,
					) : null,
				),
				errText ? h('div', { style: S.msgErr }, T('lastError') + ': ' + errText.slice(0, 120)) : null,
			)
		}

		function QoderSection() {
			const [status, setStatus] = useState(null)
			const [accounts, setAccounts] = useState(null)
			const [loadErr, setLoadErr] = useState('')
			const [busy, setBusy] = useState('')
			const [msg, setMsg] = useState(null)
			const [login, setLogin] = useState(null)
			const [importOpen, setImportOpen] = useState(false)
			const [importMode, setImportMode] = useState('json')
			const [importText, setImportText] = useState('')
			const [patText, setPatText] = useState('')
			const [desktop, setDesktop] = useState(null)
			const [desktopBusy, setDesktopBusy] = useState(false)
			const [health, setHealth] = useState(null)
			const [cfgForm, setCfgForm] = useState({ baseUrl: '', apiKey: '' })
			const loginRef = useRef(null)
			loginRef.current = login

			const flash = useCallback((kind, text) => {
				setMsg({ kind, text })
				if (kind === 'ok') setTimeout(() => setMsg((m) => (m && m.text === text ? null : m)), 5000)
			}, [])

			const refresh = useCallback(async () => {
				setLoadErr('')
				try {
					const [st, ac, cf] = await Promise.all([
						apiGet('/status').catch((e) => ({ error: e.message })),
						apiGet('/accounts').catch(() => null),
						apiGet('/config').catch(() => null),
					])
					if (st && st.error) throw new Error(st.error)
					setStatus(st)
					if (ac) setAccounts(ac.accounts || ac.data || [])
					if (cf) setCfgForm({ baseUrl: cf.overrides?.baseUrl || '', apiKey: cf.overrides?.apiKey || '' })
				} catch (e) {
					setLoadErr(e.message || String(e))
				}
			}, [])

			useEffect(() => { refresh() }, [refresh])

			// 登录轮询：每 2s 查一次；ok → 自动保存并刷新；expired/unknown/连续失败 → 停止并提示
			useEffect(() => {
				if (!login?.state) return
				let stop = false
				let fails = 0
				const deadline = (login.startedAt || Date.now()) + 600000
				const iv = setInterval(async () => {
					if (stop || !loginRef.current?.state) return
					if (Date.now() > deadline) {
						stop = true
						setLogin(null)
						flash('err', T('loginExpired'))
						return
					}
					try {
						const r = await apiGet('/login/poll?state=' + encodeURIComponent(loginRef.current.state))
						fails = 0
						const st = r.status
						if (st === 'ok') {
							stop = true
							setLogin(null)
							flash('ok', T('loginOk'))
							refresh()
						} else if (st === 'expired') {
							stop = true
							setLogin(null)
							flash('err', T('loginExpired'))
						} else if (st === 'error') {
							stop = true
							setLogin(null)
							flash('err', T('loginErr') + (r.message || 'unknown'))
						} else if (st === 'unknown') {
							stop = true
							setLogin(null)
							flash('err', T('sessionLost'))
						}
					} catch (e) {
						fails += 1
						if (fails >= 4) {
							stop = true
							setLogin(null)
							flash('err', T('pollNetErr') + (e.message || ''))
						}
					}
				}, 2000)
				return () => { stop = true; clearInterval(iv) }
			}, [login?.state, flash, refresh])

			// 登录面板倒计时（1s 心跳，仅渲染用）
			const [now, setNow] = useState(Date.now())
			useEffect(() => {
				if (!login?.state) return
				const iv = setInterval(() => setNow(Date.now()), 1000)
				return () => clearInterval(iv)
			}, [login?.state])

			const startLogin = async () => {
				setMsg(null)
				try {
					const r = await apiPost('/login/start', { realm: 'cn' })
					setLogin({ state: r.state, authUrl: r.authUrl, startedAt: Date.now() })
				} catch (e) {
					flash('err', T('loginErr') + e.message)
				}
			}
			const manualCheck = async () => {
				const cur = loginRef.current
				if (!cur?.state) return
				setMsg(null)
				try {
					const r = await apiGet('/login/poll?state=' + encodeURIComponent(cur.state))
					if (r.status === 'ok') {
						setLogin(null)
						flash('ok', T('loginManualOk'))
						refresh()
					} else {
						const ac = await apiGet('/accounts').catch(() => null)
						const list = (ac && (ac.accounts || ac.data)) || []
						flash('err', T('loginErr') + (r.message || r.status || 'pending'))
						setAccounts(list)
					}
				} catch (e) { flash('err', T('pollNetErr') + e.message) }
			}
			const cancelLogin = async () => {
				const cur = loginRef.current
				setLogin(null)
				if (cur?.state) { try { await apiPost('/login/cancel', { state: cur.state }) } catch {} }
			}
			const shareAll = async () => {
				setMsg(null)
				try {
					const r = await fetch(API + '/accounts/export', { headers: { accept: 'application/json' } })
					if (!r.ok) throw new Error('HTTP ' + r.status)
					const doc = await r.json()
					const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
					const a = document.createElement('a')
					a.href = URL.createObjectURL(blob)
					a.download = 'qoder-accounts-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json'
					document.body.appendChild(a)
					a.click()
					a.remove()
					setTimeout(() => URL.revokeObjectURL(a.href), 30000)
					flash('ok', T('exported'))
				} catch (e) {
					flash('err', e.message)
				}
			}
			const doImport = async () => {
				setMsg(null)
				let parsed
				try { parsed = JSON.parse(importText) } catch (e) { return flash('err', 'JSON 解析失败: ' + e.message) }
				setBusy('import')
				try {
					await apiPost('/accounts/import', { data: parsed })
					flash('ok', T('ok'))
					setImportOpen(false)
					setImportText('')
					refresh()
				} catch (e) {
					flash('err', e.message)
				} finally {
					setBusy('')
				}
			}
			const toggle = async (a) => {
				setBusy('toggle:' + a.uid)
				try { await apiPost('/accounts/toggle', { uid: a.uid, enabled: !a.enabled }); refresh() }
				catch (e) { flash('err', e.message) }
				finally { setBusy('') }
			}
			const del = async (a) => {
				setBusy('del:' + a.uid)
				try { await apiPost('/accounts/delete', { uid: a.uid }); refresh() }
				catch (e) { flash('err', e.message) }
				finally { setBusy('') }
			}
			const testOne = async (a) => {
				setBusy('test:' + a.uid)
				try {
					const r = await apiPost('/accounts/test', { uid: a.uid })
					flash(r.ok ? 'ok' : 'err', (r.ok ? T('testOk') : T('testFail')) + ' · ' + (r.reply || r.error || '') + (r.elapsed_ms ? ' · ' + r.elapsed_ms + 'ms' : ''))
				} catch (e) { flash('err', T('testFail') + ': ' + e.message) }
				finally { setBusy('') }
			}
			const refreshOne = async (a) => {
				setBusy('refresh:' + a.uid)
				try {
					const r = await apiPost('/accounts/refresh', { uid: a.uid })
					const row = r.results?.[0]
					flash(row?.ok ? 'ok' : 'err', (row?.ok ? T('ok') : T('fail')) + (row?.error ? ': ' + row.error : ''))
					refresh()
				} catch (e) { flash('err', e.message) }
				finally { setBusy('') }
			}
			const runHealth = async () => {
				setMsg(null)
				setBusy('health')
				try { setHealth(await apiPost('/health-check')) }
				catch (e) { flash('err', e.message) }
				finally { setBusy('') }
			}
			const checkinAll = async () => {
				setMsg(null)
				setBusy('checkin')
				try {
					const r = await apiPost('/accounts/checkin', {})
					const rows = r.results || []
					const earned = rows.reduce((s, x) => s + (Number(x.earned_credit) || 0), 0)
					const lines = rows.map((x) => `${x.nickname || x.uid?.slice(0, 8)}: ${x.ok ? '+' + (x.earned_credit || 0) : (x.message || x.msg || T('checkinNone'))}`)
					flash(earned > 0 ? 'ok' : 'err', T('checkinDone') + (earned > 0 ? ' +' + earned : '') + (lines.length ? ' · ' + lines.join(' / ') : ''))
					refresh()
				} catch (e) { flash('err', e.message) }
				finally { setBusy('') }
			}
			const doImportPat = async () => {
				setMsg(null)
				if (!patText.trim()) return flash('err', T('patTitle'))
				setBusy('pat')
				try {
					await apiPost('/accounts/import/pat', { pat: patText.trim(), realm: 'cn' })
					flash('ok', T('patOk'))
					setPatText('')
					setImportOpen(false)
					refresh()
				} catch (e) { flash('err', e.message) }
				finally { setBusy('') }
			}
			const scanDesktop = async () => {
				setMsg(null)
				setDesktopBusy(true)
				try { setDesktop(await apiPost('/accounts/import/desktop', {})) }
				catch (e) { flash('err', e.message) }
				finally { setDesktopBusy(false) }
			}
			const importDesktopAll = async () => {
				setMsg(null)
				setBusy('desktopAll')
				try {
					const r = await apiPost('/accounts/import/desktop', { all: true })
					flash('ok', T('ok') + ' · ' + ((r.imported || []).length) + ' / ' + ((r.accounts || []).length))
					setImportOpen(false)
					setDesktop(null)
					refresh()
				} catch (e) { flash('err', e.message) }
				finally { setBusy('') }
			}
			const saveCfg = async () => {
				setMsg(null)
				try {
					await apiPost('/config', { baseUrl: cfgForm.baseUrl.trim(), apiKey: cfgForm.apiKey.trim() })
					flash('ok', T('saved'))
					refresh()
				} catch (e) { flash('err', e.message) }
			}

			const gw = status?.gateway
			const external = !!status?.external
			const accountList = accounts || []

			if (loadErr) {
				return h('div', { style: S.wrap },
					h('div', { style: S.card },
						h('div', { style: S.msgErr }, T('loadErr') + ': ' + loadErr),
						h('div', null, h('button', { style: btn(false), onClick: refresh }, T('retry'))),
					),
				)
			}

			return h('div', { style: S.wrap },
				// ---- 标题 + 网关状态 ----
				h('div', { style: S.card },
					h('h3', { style: S.title }, T('title')),
					h('p', { style: S.sub }, T('sub')),
					h('div', { style: S.row },
						h('span', { style: gw?.ok ? S.badgeOk : S.badgeErr }, external ? T('gwExternal') : (gw?.ok ? T('gwOk') : T('gwDown'))),
						external && status?.overrides?.baseUrl ? h('span', { style: { ...S.mono, fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)' } }, status.overrides.baseUrl) : null,
						gw?.ok ? h('span', { style: S.kv }, T('ready') + ': ', h('span', { style: S.kvV }, String(gw.ready ?? gw.accounts ?? '-'))) : null,
						status?.models?.length ? h('span', { style: S.kv }, T('modelCount') + ': ', h('span', { style: S.kvV }, String(status.models.length))) : null,
					),
					h(Msg, { msg }),
				),

				// ---- 账号池 ----
				h('div', { style: S.card },
					h('div', { style: S.row },
						h('h3', { style: { ...S.title, ...S.grow } }, T('accounts')),
						h('button', { style: btn(true, !!login), onClick: startLogin }, '+ ' + T('addAccount')),
						h('button', { style: btn(false, busy === 'checkin'), onClick: checkinAll }, busy === 'checkin' ? T('checkinBusy') : T('checkin')),
						h('button', { style: btn(false), onClick: shareAll }, T('shareAll')),
						h('button', { style: btn(false), onClick: () => setImportOpen((v) => !v) }, T('importBtn')),
					),
					h('div', { style: S.sub }, T('checkinHint')),
					external ? h('div', { style: { ...S.sub, color: 'var(--dsw-alias-state-warn-primary)' } }, T('extWarn')) : null,
					login ? h('div', { style: S.acct },
						h('div', { style: { ...S.title, fontSize: 13.5 } }, T('loginTitle')),
						h('div', { style: S.sub }, T('loginStep1')),
						h('div', null, h('a', { style: S.link, href: login.authUrl, target: '_blank', rel: 'noreferrer' }, T('loginOpen') + ' →')),
						h('div', { style: S.sub }, T('loginStep2')),
						h('div', { style: { ...S.sub, color: 'var(--dsw-alias-state-warn-primary)' } }, T('authHint')),
						h('div', { style: S.row },
							h('span', { style: S.badgeIdle }, T('loginWaiting')),
							h('span', { style: { ...S.mono, fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)' } },
								T('expiresIn') + ' ' + Math.max(0, Math.ceil((600000 - (now - (login.startedAt || now))) / 1000)) + 's'),
							h('div', { style: S.grow }),
							h('button', { style: btn(false), onClick: manualCheck }, T('manualCheck')),
							h('button', { style: btn(false), onClick: cancelLogin }, T('loginCancel')),
						),
					) : null,
					importOpen ? h('div', { style: S.acct },
						h('div', { style: S.row },
							h('button', { style: btn(importMode === 'json'), onClick: () => setImportMode('json') }, T('importJson')),
							h('button', { style: btn(importMode === 'pat'), onClick: () => setImportMode('pat') }, T('importPat')),
							h('div', { style: S.grow }),
							h('button', { style: btn(false, desktopBusy), onClick: scanDesktop }, desktopBusy ? T('desktopScanBusy') : T('desktopScan')),
						),
						importMode === 'json' ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
							h('div', { style: S.sub }, T('importTitle')),
							h('textarea', { style: S.ta, value: importText, onChange: (e) => setImportText(e.target.value), placeholder: '[{"nickname":"...","refreshToken":"..."}]' }),
							h('div', { style: S.row },
								h('button', { style: btn(true, busy === 'import'), onClick: doImport }, busy === 'import' ? '…' : T('importGo')),
								h('button', { style: btn(false), onClick: () => setImportOpen(false) }, T('importCancel')),
							),
						) : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
							h('div', { style: S.sub }, T('patTitle')),
							h('input', { style: S.input, type: 'password', value: patText, placeholder: 'pt-xxxxxxxx', onChange: (e) => setPatText(e.target.value) }),
							h('div', { style: S.row },
								h('button', { style: btn(true, busy === 'pat'), onClick: doImportPat }, busy === 'pat' ? '…' : T('patGo')),
								h('button', { style: btn(false), onClick: () => setImportOpen(false) }, T('importCancel')),
							),
						),
						desktop ? (desktop.detected && desktop.detected.length
							? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
								h('div', { style: S.sub }, T('desktopScan') + ': ' + desktop.detected.length),
								desktop.detected.map((c, i) => h('div', { style: S.kv, key: i },
									h('span', { style: { ...S.mono, fontSize: 11 } }, (c.path || '').slice(-70)),
									h('span', { style: c.valid ? S.badgeOk : S.badgeIdle }, c.valid ? T('desktopValid') : T('desktopInvalid')),
									c.realm ? h('span', null, c.realm) : null,
								)),
								h('div', null, h('button', { style: btn(true, busy === 'desktopAll'), onClick: importDesktopAll }, busy === 'desktopAll' ? '…' : T('desktopImportAll'))),
							)
							: h('div', { style: S.sub }, T('desktopNone'))) : null,
					) : null,
					accountList.length === 0
						? h('div', { style: S.sub }, T('none'))
						: accountList.map((a) => h(AccountCard, {
							key: a.uid, a, busy,
							onToggle: toggle, onDelete: del, onTest: testOne, onRefresh: refreshOne,
						})),
				),

				// ---- 模型 + 健康 ----
				h('div', { style: S.card },
					h('div', { style: S.row },
						h('h3', { style: { ...S.title, ...S.grow } }, T('models')),
						h('button', { style: btn(true, busy === 'health'), onClick: runHealth }, busy === 'health' ? T('healthBusy') : T('healthGo')),
					),
					h('div', { style: S.sub }, T('healthHint')),
					(status?.models || []).map((m) => {
						const r = health?.results?.find((x) => x.model === m.id)
						return h('div', { style: S.healthRow, key: m.id },
							h('span', { style: { ...S.kvV, fontWeight: 500, minWidth: 190 } }, m.name || m.id),
							h('span', { style: { ...S.mono, fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)' } }, m.id),
							h('span', { style: S.kv }, T('ctx') + ' ', h('span', { style: S.kvV }, fmtCtx(m.contextWindow))),
							h('div', { style: S.grow }),
							r ? h('span', { style: r.ok ? S.badgeOk : S.badgeErr }, (r.ok ? T('healthOk') : T('healthFail')) + (r.ok && r.latencyMs != null ? ' · ' + r.latencyMs + 'ms' : '')) : null,
							r && !r.ok ? h('span', { style: S.msgErr }, shortErr(r.error)) : null,
						)
					}),
				),

				// ---- 模型地址与 Key ----
				h('div', { style: S.card },
					h('h3', { style: S.title }, T('adv')),
					h('div', { style: S.sub }, T('advHint')),
					h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
						h('div', null,
							h('div', { style: S.label }, T('baseUrl')),
							h('input', { style: S.input, value: cfgForm.baseUrl, placeholder: T('baseUrlPh'), onChange: (e) => setCfgForm((f) => ({ ...f, baseUrl: e.target.value })) }),
						),
						h('div', null,
							h('div', { style: S.label }, T('apiKey')),
							h('input', { style: S.input, type: 'password', value: cfgForm.apiKey, placeholder: T('apiKeyPh'), onChange: (e) => setCfgForm((f) => ({ ...f, apiKey: e.target.value })) }),
						),
					),
					h('div', { style: S.row },
						h('button', { style: btn(true), onClick: saveCfg }, T('save')),
						h('span', { style: S.kv }, status ? (external ? T('usingExternal') + (status.overrides?.baseUrl || '') : T('usingLocal')) : ''),
					),
				),
			)
		}

		// -------------------------------------------------------------- registration
		return {
			inject: ['slots', 'locale'],
			apply(ctx) {
				ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-qoder: dictionaries')
				ctx.effect(() => {
					const bind = () => { try { const b = ctx.locale.bind(NS); return (k) => { const v = b(k); return v && v !== k ? v : (zh[k] || en[k] || k) } } catch { return (k) => zh[k] || k } }
					T = bind()
					return ctx.slots.inject('settings.section', () => ctx.slots.register({
						name: 'settings.section',
						id: 'qoder',
						order: 22,
						label: () => T('nav'),
						locale: NS,
					}, QoderSection))
				}, 'dsh-qoder: settings page')
			},
		}
	},
})
