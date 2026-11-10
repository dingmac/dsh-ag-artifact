/**
 * client/page.jsx — 「产出规范」设置页（浏览器半侧）。
 *
 * 职责：
 *   - 读 configForms 的 settings 命名空间 `ag-artifact`（value/base/user/revision/writable）；
 *   - 把当前生效值放进可编辑草稿，实时做五层路径试算；
 *   - 只读审阅态（confirmed=false）点「确认并启用」，之后点「保存」；
 *   - 保存走 scope.mutate(ops, revision)：最小字段集 + 修订号防并发覆盖。
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { previewPath } from '../lib/core/preview.js'
import { diffOps, normalizeDraft, typeRows } from '../lib/core/draft.js'
import { validateTemplates } from '../lib/core/text.js'

const STYLE = `
.agx {
  --agx-line: color-mix(in srgb, currentColor 13%, transparent);
  --agx-line-strong: color-mix(in srgb, currentColor 20%, transparent);
  --agx-fill: color-mix(in srgb, currentColor 2.5%, transparent);
  --agx-soft: color-mix(in srgb, currentColor 5%, transparent);
  --agx-accent: #4f7cf7;
  --agx-ok: #2fb344;
  --agx-warn: #d99a00;
  --agx-danger: #d4514e;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 2px 2px 28px;
  font-size: 13px;
  line-height: 1.55;
  color: inherit;
}
.agx *, .agx *::before, .agx *::after { box-sizing: border-box; }
.agx-card {
  border: 1px solid var(--agx-line);
  border-radius: 12px;
  padding: 16px 18px;
  background: var(--agx-fill);
}
.agx-hero { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
.agx-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.agx-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13px; font-weight: 600; letter-spacing: .2px; }
.agx-index {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 6px;
  font-size: 10px; font-weight: 600; letter-spacing: 0;
  background: var(--agx-soft); border: 1px solid var(--agx-line);
  opacity: .9;
}
.agx-desc { margin: 0; font-size: 11.5px; opacity: .55; }
.agx-hint { font-size: 11px; opacity: .55; line-height: 1.5; }
.agx-muted { opacity: .6; }
.agx-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
.agx-tag {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 9px; border-radius: 999px; font-size: 11px;
  border: 1px solid var(--agx-line-strong); background: var(--agx-soft);
}
.agx-tag.warn { border-color: color-mix(in srgb, var(--agx-warn) 45%, transparent); background: color-mix(in srgb, var(--agx-warn) 12%, transparent); }
.agx-tag.ok { border-color: color-mix(in srgb, var(--agx-ok) 45%, transparent); background: color-mix(in srgb, var(--agx-ok) 12%, transparent); }
.agx-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: .5; flex: none; }
.agx-dot.ok { background: var(--agx-ok); opacity: 1; }
.agx-dot.warn { background: var(--agx-warn); opacity: 1; }
.agx-dot.danger { background: var(--agx-danger); opacity: 1; }
.agx-banner {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 11px 13px; border-radius: 10px; line-height: 1.6;
  border: 1px solid color-mix(in srgb, var(--agx-warn) 40%, transparent);
  background: color-mix(in srgb, var(--agx-warn) 9%, transparent);
}
.agx-banner.error { border-color: color-mix(in srgb, var(--agx-danger) 45%, transparent); background: color-mix(in srgb, var(--agx-danger) 9%, transparent); }
.agx-banner.ok { border-color: color-mix(in srgb, var(--agx-ok) 42%, transparent); background: color-mix(in srgb, var(--agx-ok) 8%, transparent); }
.agx-banner .agx-dot { margin-top: 7px; }
.agx-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px 18px; }
.agx-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.agx-field > label { font-size: 11.5px; opacity: .74; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.agx-field > small { font-size: 11px; opacity: .5; line-height: 1.5; }
.agx-reset {
  margin-left: auto;
  border: 0; background: none; color: var(--agx-accent); font: inherit; font-size: 11px;
  cursor: pointer; padding: 0; opacity: .85;
}
.agx-reset:hover { opacity: 1; text-decoration: underline; }
.agx-input, .agx-select {
  width: 100%; height: 32px; padding: 0 9px;
  border-radius: 8px; border: 1px solid var(--agx-line-strong);
  background: color-mix(in srgb, currentColor 3.5%, transparent);
  color: inherit; font: inherit;
  transition: border-color .12s ease, background .12s ease, box-shadow .12s ease;
}
.agx-input:hover:not(:disabled), .agx-select:hover:not(:disabled) { border-color: color-mix(in srgb, currentColor 32%, transparent); }
.agx-input:focus, .agx-select:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--agx-accent) 70%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--agx-accent) 18%, transparent);
}
.agx-input:disabled, .agx-select:disabled { opacity: .55; }
.agx-input[aria-invalid="true"] { border-color: color-mix(in srgb, var(--agx-danger) 60%, transparent); }
.agx-field > label.agx-check { display: flex; align-items: center; justify-content: flex-start; gap: 8px; height: 32px; font-size: 12px; opacity: 1; }
.agx-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 32px; padding: 0 14px; border-radius: 8px;
  border: 1px solid var(--agx-line-strong); background: transparent;
  color: inherit; font: inherit; cursor: pointer;
  transition: background .12s ease, border-color .12s ease, opacity .12s ease;
}
.agx-btn:hover:not(:disabled) { background: var(--agx-soft); }
.agx-btn:focus-visible { outline: 2px solid color-mix(in srgb, var(--agx-accent) 60%, transparent); outline-offset: 1px; }
.agx-btn[disabled] { opacity: .42; cursor: not-allowed; }
.agx-btn.primary { background: var(--agx-accent); border-color: var(--agx-accent); color: #fff; }
.agx-btn.primary:hover:not(:disabled) { background: color-mix(in srgb, var(--agx-accent) 88%, black); }
.agx-btn.small { height: 26px; padding: 0 9px; font-size: 11.5px; }
.agx-btn.danger { color: var(--agx-danger); border-color: color-mix(in srgb, var(--agx-danger) 35%, transparent); }
.agx-btn.danger:hover:not(:disabled) { background: color-mix(in srgb, var(--agx-danger) 10%, transparent); }
.agx-table { width: 100%; border-collapse: collapse; }
.agx-table th {
  text-align: left; font-weight: 500; font-size: 11px; opacity: .55;
  padding: 4px 8px 6px; border-bottom: 1px solid var(--agx-line);
}
.agx-table td { padding: 5px 8px 5px 0; vertical-align: middle; }
.agx-table tr:hover td { background: color-mix(in srgb, currentColor 2%, transparent); }
.agx-table td.agx-act { width: 52px; text-align: right; padding-right: 0; }
.agx-empty {
  padding: 18px; text-align: center; border: 1px dashed var(--agx-line-strong);
  border-radius: 8px; font-size: 12px; opacity: .55;
}
.agx-path {
  margin-top: 10px; padding: 11px 13px; border-radius: 9px;
  background: color-mix(in srgb, currentColor 4%, transparent);
  border: 1px solid var(--agx-line);
  word-break: break-all; line-height: 1.9;
}
.agx-path .root { opacity: .5; }
.agx-path .sep { opacity: .35; }
.agx-path .seg { color: var(--agx-accent); font-weight: 600; }
.agx-actions { display: flex; align-items: center; gap: 8px; }
.agx-foot {
  position: sticky; bottom: 0; z-index: 2;
  display: flex; align-items: center; justify-content: flex-end; gap: 10px;
  margin: 0 -2px; padding: 12px 6px calc(12px + env(safe-area-inset-bottom));
  background: linear-gradient(to top, color-mix(in srgb, currentColor 7%, transparent), transparent);
  backdrop-filter: blur(8px);
}
.agx-foot .agx-status { margin-right: auto; font-size: 11.5px; opacity: .65; display: flex; align-items: center; gap: 6px; }
.agx-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.agx-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 6px; font-size: 11px;
  border: 1px solid var(--agx-line); background: var(--agx-soft);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.agx-chip .arrow { opacity: .4; }
@media (max-width: 640px) {
  .agx-card { padding: 14px; }
  .agx-foot { flex-wrap: wrap; }
  .agx-foot .agx-status { width: 100%; }
}
`

/** 字段定义：顺序即表单顺序。 */
const TEMPLATE_FIELDS = [
  { key: 'templateTask', label: '第 1 层 · 任务主文件夹', hint: '变量 {workspace}', fallback: '{workspace}' },
  { key: 'templateCategory', label: '第 2 层 · 任务分类', hint: '变量 {category}', fallback: '{category}' },
  { key: 'templateTypeDir', label: '第 3 层 · 大类', hint: '变量 {typeDir}', fallback: '{typeDir}' },
  { key: 'templateBatch', label: '第 4 层 · 小类（版本容器）', hint: '变量 {topic} {batch}', fallback: '{topic}_批次{batch}' },
  { key: 'templateFile', label: '第 5 层 · 文件名', hint: '变量 {topic} {date} {n} {ext}；必须含 {n}', fallback: '{topic}[_{date}]_v{n}{ext}' },
]

/** 判断路径是否是绝对路径（POSIX 或 Windows 盘符）。 */
function isAbsolutePath(value) {
  return /^([/\\]|[A-Za-z]:[\\/])/.test(String(value ?? '').trim())
}

/** 本地校验草稿，返回 { field, message } 列表。 */
function collectErrors(draft) {
  const errors = []
  if (!isAbsolutePath(draft.agHome)) errors.push({ field: 'agHome', message: '产出根目录必须是绝对路径' })
  if (!String(draft.templateFile).includes('{n}')) errors.push({ field: 'templateFile', message: '文件名模板必须包含 {n}' })
  if (!String(draft.templateBatch).includes('{batch}')) errors.push({ field: 'templateBatch', message: '小类模板必须包含 {batch}' })
  if (!Number.isInteger(draft.maxDepth) || draft.maxDepth < 5) errors.push({ field: 'maxDepth', message: '层级必须是不小于 5 的整数' })
  if (!Number.isInteger(draft.verifyMaxIssues) || draft.verifyMaxIssues < 1) errors.push({ field: 'verifyMaxIssues', message: '自查上限必须是正整数' })
  if (!['today', 'file-mtime', 'none'].includes(draft.dateSource)) errors.push({ field: 'dateSource', message: '日期来源取值非法' })
  if (!['reuse', 'new', 'explicit'].includes(draft.batchPolicy)) errors.push({ field: 'batchPolicy', message: '批次策略取值非法' })
  const entries = Object.entries(draft.typeDirs ?? {})
  if (entries.some(([key]) => key.trim().length === 0)) errors.push({ field: 'typeDirs', message: '类型名不能为空' })
  if (entries.some(([key, value]) => String(value).trim().length === 0)) {
    errors.push({ field: 'typeDirs', message: `类型「${entries.find(([, value]) => String(value).trim() === '')[0]}」的目录名不能为空` })
  }
  return errors
}

/** 保存前把草稿收敛成合法值（输入框可能是空串）。 */
function cleanDraft(draft) {
  return {
    ...draft,
    maxDepth: Number(draft.maxDepth),
    verifyMaxIssues: Number(draft.verifyMaxIssues),
    ignoreDirs: (draft.ignoreDirs ?? []).map((item) => String(item).trim()).filter(Boolean),
    typeDirs: Object.fromEntries(
      Object.entries(draft.typeDirs ?? {})
        .map(([key, value]) => [String(key).trim(), String(value).trim()])
        .filter(([key, value]) => key.length > 0 && value.length > 0),
    ),
    defaultExt: Object.fromEntries(
      Object.entries(draft.defaultExt ?? {})
        .map(([key, value]) => [String(key).trim(), String(value).trim()])
        .filter(([key, value]) => key.length > 0 && value.length > 0),
    ),
  }
}

/** 订阅 settings 命名空间快照。 */
function useScopeSnapshot(scope) {
  const subscribe = useCallback((listener) => scope.subscribe(listener), [scope])
  const getSnapshot = useCallback(() => scope.getSnapshot(), [scope])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** 复制按钮（浏览器剪贴板）。 */
function CopyButton({ text, label = '复制' }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <button type="button" className="agx-btn small" onClick={copy} disabled={!text}>
      {copied ? '已复制' : label}
    </button>
  )
}

/** 类型目录行：类型名用本地缓冲，失焦时才重命名，避免逐字符重排与重名覆盖。 */
function TypeRow({ row, disabled, extensions, onRename, onDirChange, onExtChange, onRemove }) {
  const [name, setName] = useState(row.type)
  useEffect(() => setName(row.type), [row.type])
  const commit = () => {
    const next = name.trim()
    if (!next || next === row.type) {
      setName(row.type)
      return
    }
    const done = onRename(row.type, next)
    if (!done) setName(row.type)
  }
  return (
    <tr>
      <td>
        <input
          className="agx-input"
          value={name}
          disabled={disabled}
          aria-label="类型名"
          onChange={(event) => setName(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') {
              setName(row.type)
              event.currentTarget.blur()
            }
          }}
        />
      </td>
      <td>
        <input
          className="agx-input"
          value={row.dir}
          disabled={disabled}
          aria-label="大类目录"
          onChange={(event) => onDirChange(row.type, event.target.value)}
        />
      </td>
      <td>
        <input
          className="agx-input agx-mono"
          value={extensions[row.type] ?? ''}
          placeholder=".md"
          disabled={disabled}
          aria-label="默认扩展名"
          onChange={(event) => onExtChange(row.type, event.target.value)}
        />
      </td>
      <td className="agx-act">
        <button type="button" className="agx-btn small danger" disabled={disabled} onClick={() => onRemove(row.type)}>
          删除
        </button>
      </td>
    </tr>
  )
}

/** 产出规范设置页。 */
export function ArtifactPage(props) {
  const scope = props.scope
  const snapshot = useScopeSnapshot(scope)
  const [draft, setDraft] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [sample, setSample] = useState({ task: '范式转移', category: '库存对账', type: '报告', topic: '差异分析' })
  const fieldId = useId()
  const messageTimer = useRef(null)

  const ready = snapshot.status === 'ready' && snapshot.value !== undefined
  const value = snapshot.value

  useEffect(() => {
    if (!ready || dirty) return
    setDraft(normalizeDraft(value))
  }, [ready, value, dirty])

  useEffect(() => () => clearTimeout(messageTimer.current), [])

  const current = draft ?? normalizeDraft(value)
  const writable = snapshot.writable !== false
  const pendingConfirm = current.confirmed !== true
  const errors = collectErrors(current)
  const errorFields = new Set(errors.map((error) => error.field))
  const activeType = Object.hasOwn(current.typeDirs, sample.type)
    ? sample.type
    : (Object.keys(current.typeDirs)[0] ?? '')
  const preview = useMemo(() => {
    try {
      return previewPath(current, { ...sample, type: activeType })
    } catch (error) {
      return { path: `（试算失败：${error?.message ?? error}）`, segments: [], relative: '', root: '' }
    }
  }, [current, sample, activeType])

  const flash = useCallback((next) => {
    setMessage(next)
    clearTimeout(messageTimer.current)
    if (next && next.tone !== 'error') {
      messageTimer.current = setTimeout(() => setMessage(null), 4000)
    }
  }, [])

  const update = useCallback((field, next) => {
    setDraft((previous) => ({ ...(previous ?? normalizeDraft(value)), [field]: next }))
    setDirty(true)
    setMessage(null)
  }, [value])

  const setTypeDir = useCallback((type, dir) => {
    setDraft((previous) => {
      const base = previous ?? normalizeDraft(value)
      return { ...base, typeDirs: { ...base.typeDirs, [type]: dir } }
    })
    setDirty(true)
    setMessage(null)
  }, [value])

  const renameType = useCallback((oldType, nextType) => {
    if (Object.hasOwn(current.typeDirs, nextType)) return false
    setDraft((previous) => {
      const base = previous ?? normalizeDraft(value)
      const rebuilt = {}
      for (const [key, dir] of Object.entries(base.typeDirs)) rebuilt[key === oldType ? nextType : key] = dir
      const extensions = { ...base.defaultExt }
      if (Object.hasOwn(extensions, oldType)) {
        extensions[nextType] = extensions[oldType]
        delete extensions[oldType]
      }
      return { ...base, typeDirs: rebuilt, defaultExt: extensions }
    })
    setDirty(true)
    setMessage(null)
    return true
  }, [value, current.typeDirs])

  const removeType = useCallback((type) => {
    setDraft((previous) => {
      const base = previous ?? normalizeDraft(value)
      const typeDirs = { ...base.typeDirs }
      const defaultExt = { ...base.defaultExt }
      delete typeDirs[type]
      delete defaultExt[type]
      return { ...base, typeDirs, defaultExt }
    })
    setDirty(true)
    setMessage(null)
  }, [value])

  const addType = useCallback(() => {
    setDraft((previous) => {
      const base = previous ?? normalizeDraft(value)
      let index = Object.keys(base.typeDirs).length + 1
      let type = `类型${index}`
      while (Object.hasOwn(base.typeDirs, type)) type = `类型${++index}`
      return { ...base, typeDirs: { ...base.typeDirs, [type]: type } }
    })
    setDirty(true)
    setMessage(null)
  }, [value])

  const resetTemplate = useCallback((field, fallback) => {
    update(field, fallback)
  }, [update])

  const discard = useCallback(() => {
    setDraft(normalizeDraft(value))
    setDirty(false)
    flash({ tone: 'ok', text: '已还原为当前生效配置' })
  }, [value, flash])

  const save = useCallback(async () => {
    if (!ready || !writable || saving) return
    const cleaned = cleanDraft(current)
    const problems = collectErrors(cleaned)
    if (problems.length > 0) {
      flash({ tone: 'error', text: problems[0].message })
      return
    }
    const ops = diffOps(value, cleaned)
    if (pendingConfirm) ops.push({ op: 'set', path: ['confirmed'], value: true })
    if (ops.length === 0) {
      flash({ tone: 'ok', text: '没有需要保存的改动' })
      return
    }
    setSaving(true)
    try {
      const ok = await scope.mutate(ops, snapshot.revision)
      if (ok) setDirty(false)
      flash(
        ok
          ? { tone: 'ok', text: pendingConfirm ? '已确认并启用' : '已保存' }
          : { tone: 'error', text: '配置已被其他窗口修改，草稿已保留，请刷新页面后重试' },
      )
    } catch (error) {
      flash({ tone: 'error', text: `保存失败：${error?.message ?? error}` })
    } finally {
      setSaving(false)
    }
  }, [ready, writable, saving, current, value, pendingConfirm, scope, snapshot.revision, flash])

  if (!ready) {
    return (
      <div className="agx">
        <style>{STYLE}</style>
        <div className="agx-card agx-muted">
          {snapshot.status === 'loading' ? '正在读取配置…' : '配置尚不可用（该设置页只在 Host 提供 ag-artifact 命名空间时出现）。'}
        </div>
      </div>
    )
  }

  const typeList = typeRows(current.typeDirs)
  const importedAt = current.importedAt ? String(current.importedAt).replace('T', ' ').slice(0, 19) : ''

  return (
    <div className="agx">
      <style>{STYLE}</style>

      {pendingConfirm && (
        <div className="agx-banner">
          <span className="agx-dot warn" />
          <div>
            <strong>待确认：</strong>
            当前配置来自{current.importedFrom ? <code className="agx-mono"> {current.importedFrom} </code> : '现有设置'}
            的首次接管{importedAt ? `（${importedAt}）` : ''}。请核对下面的根目录与目录规则，确认后点右下角「确认并启用」。
            旧配置文件不会被修改。
          </div>
        </div>
      )}

      {message && (
        <div className={`agx-banner ${message.tone === 'error' ? 'error' : 'ok'}`} role="status">
          <span className={`agx-dot ${message.tone === 'error' ? 'danger' : 'ok'}`} />
          <div>{message.text}</div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="agx-banner error">
          <span className="agx-dot danger" />
          <div>{errors[0].message}</div>
        </div>
      )}

      <div className="agx-hero">
        <section className="agx-card">
          <div className="agx-head">
            <h3 className="agx-title"><span className="agx-index">01</span>当前状态</h3>
            <span className={`agx-tag ${current.confirmed ? 'ok' : 'warn'}`}>
              <span className={`agx-dot ${current.confirmed ? 'ok' : 'warn'}`} />
              {current.confirmed ? '已确认' : '审阅中'}
            </span>
          </div>
          <div className="agx-field">
            <label htmlFor={`${fieldId}-agHome`}>产出根目录（绝对路径）</label>
            <input
              id={`${fieldId}-agHome`}
              className="agx-input agx-mono"
              value={current.agHome}
              disabled={!writable}
              aria-invalid={errorFields.has('agHome')}
              placeholder="/Volumes/NASData/dingmac/DSH产出"
              onChange={(event) => update('agHome', event.target.value)}
            />
            <small className="agx-hint">所有产出物落在这里；留空时回退读取 ag_config.json 的 paths.AG_HOME。</small>
          </div>
          <div className="agx-field" style={{ marginTop: 10 }}>
            <label>配置来源</label>
            <div style={{ fontSize: 12, opacity: 0.75, wordBreak: 'break-all' }}>
              {current.importedFrom ? `首次接管自 ${current.importedFrom}` : '插件配置（profile patch）'}
              {importedAt ? ` · ${importedAt}` : ''}
            </div>
          </div>
        </section>

        <section className="agx-card">
          <div className="agx-head">
            <h3 className="agx-title"><span className="agx-index">02</span>路径样例</h3>
            <CopyButton text={preview.path} label="复制路径" />
          </div>
          <div className="agx-path agx-mono">
            {preview.segments && preview.segments.length > 0 ? (
              preview.segments.map((segment, index) => (
                <span key={`${segment}-${index}`}>{index === 0 && preview.root ? <span className="root">{preview.root}/</span> : null}{index > 0 ? <span className="sep">/</span> : null}<span className="seg">{segment}</span></span>
              ))
            ) : (
              preview.path
            )}
          </div>
          <p className="agx-hint" style={{ marginTop: 8 }}>
            按当前规则 + 下方试算参数实时生成；批次号与版本号在真实落盘时由目录扫描决定。
          </p>
        </section>
      </div>

      <section className="agx-card">
        <div className="agx-head">
          <h3 className="agx-title"><span className="agx-index">03</span>目录规则（固定五层）</h3>
          <span className="agx-hint">方括号段为可选段</span>
        </div>
        <div className="agx-grid">
          {TEMPLATE_FIELDS.map((field) => (
            <div className="agx-field" key={field.key}>
              <label htmlFor={`${fieldId}-${field.key}`}>
                {field.label}
                <button
                  type="button"
                  className="agx-reset"
                  disabled={!writable}
                  onClick={() => resetTemplate(field.key, field.fallback)}
                >
                  恢复默认
                </button>
              </label>
              <input
                id={`${fieldId}-${field.key}`}
                className="agx-input agx-mono"
                value={current[field.key]}
                disabled={!writable}
                aria-invalid={errorFields.has(field.key)}
                onChange={(event) => update(field.key, event.target.value)}
              />
              <small>{field.hint}</small>
            </div>
          ))}
        </div>
        <div className="agx-chips">
          <span className="agx-chip">{current.templateTask}</span>
          <span className="arrow">/</span>
          <span className="agx-chip">{current.templateCategory}</span>
          <span className="arrow">/</span>
          <span className="agx-chip">{current.templateTypeDir}</span>
          <span className="arrow">/</span>
          <span className="agx-chip">{current.templateBatch}</span>
          <span className="arrow">/</span>
          <span className="agx-chip">{current.templateFile}</span>
        </div>
      </section>

      <div className="agx-hero">
        <section className="agx-card">
          <div className="agx-head">
            <h3 className="agx-title"><span className="agx-index">04</span>类型目录</h3>
            <button type="button" className="agx-btn small" disabled={!writable} onClick={addType}>+ 新增</button>
          </div>
          {typeList.length === 0 ? (
            <div className="agx-empty">还没有类型。点「+ 新增」添加，例如 报告 → 报告。</div>
          ) : (
            <table className="agx-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>类型</th>
                  <th>大类目录</th>
                  <th style={{ width: '26%' }}>默认扩展名</th>
                  <th className="agx-act" />
                </tr>
              </thead>
              <tbody>
                {typeList.map((row) => (
                  <TypeRow
                    key={row.type}
                    row={row}
                    disabled={!writable}
                    extensions={current.defaultExt}
                    onRename={renameType}
                    onDirChange={setTypeDir}
                    onExtChange={(type, ext) => update('defaultExt', { ...current.defaultExt, [type]: ext })}
                    onRemove={removeType}
                  />
                ))}
              </tbody>
            </table>
          )}
          <p className="agx-hint" style={{ marginTop: 8 }}>
            类型是 artifact_save/artifact_place 的 `type` 参数；`default` 可作未知类型的兜底目录。
          </p>
        </section>

        <section className="agx-card">
          <div className="agx-head">
            <h3 className="agx-title"><span className="agx-index">05</span>策略</h3>
          </div>
          <div className="agx-grid">
            <div className="agx-field">
              <label htmlFor={`${fieldId}-dateSource`}>日期来源</label>
              <select
                id={`${fieldId}-dateSource`}
                className="agx-select"
                value={current.dateSource}
                disabled={!writable}
                onChange={(event) => update('dateSource', event.target.value)}
              >
                <option value="today">today（当前时间）</option>
                <option value="file-mtime">file-mtime（源文件时间）</option>
                <option value="none">none（不写日期）</option>
              </select>
            </div>
            <div className="agx-field">
              <label htmlFor={`${fieldId}-dateFormat`}>日期格式</label>
              <input
                id={`${fieldId}-dateFormat`}
                className="agx-input agx-mono"
                value={current.dateFormat}
                disabled={!writable}
                onChange={(event) => update('dateFormat', event.target.value)}
              />
            </div>
            <div className="agx-field">
              <label htmlFor={`${fieldId}-batchPolicy`}>批次策略</label>
              <select
                id={`${fieldId}-batchPolicy`}
                className="agx-select"
                value={current.batchPolicy}
                disabled={!writable}
                onChange={(event) => update('batchPolicy', event.target.value)}
              >
                <option value="reuse">reuse（复用最新批次）</option>
                <option value="new">new（每次新建批次）</option>
                <option value="explicit">explicit（必须显式指定）</option>
              </select>
            </div>
            <div className="agx-field">
              <label htmlFor={`${fieldId}-maxDepth`}>最大层级</label>
              <input
                id={`${fieldId}-maxDepth`}
                className="agx-input"
                type="number"
                min={5}
                value={Number.isFinite(current.maxDepth) ? current.maxDepth : ''}
                disabled={!writable}
                aria-invalid={errorFields.has('maxDepth')}
                onChange={(event) => update('maxDepth', event.target.value === '' ? '' : Number(event.target.value))}
              />
            </div>
            <div className="agx-field">
              <label htmlFor={`${fieldId}-staging`}>暂存目录</label>
              <input
                id={`${fieldId}-staging`}
                className="agx-input agx-mono"
                value={current.stagingDir}
                disabled={!writable}
                onChange={(event) => update('stagingDir', event.target.value)}
              />
            </div>
            <div className="agx-field">
              <label htmlFor={`${fieldId}-verify`}>自查问题上限</label>
              <input
                id={`${fieldId}-verify`}
                className="agx-input"
                type="number"
                min={1}
                value={Number.isFinite(current.verifyMaxIssues) ? current.verifyMaxIssues : ''}
                disabled={!writable}
                aria-invalid={errorFields.has('verifyMaxIssues')}
                onChange={(event) => update('verifyMaxIssues', event.target.value === '' ? '' : Number(event.target.value))}
              />
            </div>
            <div className="agx-field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor={`${fieldId}-ignore`}>忽略目录（逗号分隔）</label>
              <input
                id={`${fieldId}-ignore`}
                className="agx-input agx-mono"
                value={(current.ignoreDirs ?? []).join(', ')}
                disabled={!writable}
                onChange={(event) => update('ignoreDirs', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))}
              />
            </div>
            <div className="agx-field" style={{ gridColumn: '1 / -1' }}>
              <label>严格类型目录</label>
              <label className="agx-check">
                <input
                  type="checkbox"
                  checked={current.strictTypeDir}
                  disabled={!writable}
                  onChange={(event) => update('strictTypeDir', event.target.checked)}
                />
                第 3 层目录必须命中类型目录表
              </label>
            </div>
          </div>
        </section>
      </div>

      <section className="agx-card">
        <div className="agx-head">
          <h3 className="agx-title"><span className="agx-index">06</span>路径试算</h3>
          <span className="agx-hint">只读预览，不写盘</span>
        </div>
        <div className="agx-grid">
          <div className="agx-field">
            <label>任务</label>
            <input className="agx-input" value={sample.task} onChange={(event) => setSample({ ...sample, task: event.target.value })} />
          </div>
          <div className="agx-field">
            <label>分类</label>
            <input className="agx-input" value={sample.category} onChange={(event) => setSample({ ...sample, category: event.target.value })} />
          </div>
          <div className="agx-field">
            <label>类型</label>
            <select
              className="agx-select"
              value={activeType}
              onChange={(event) => setSample({ ...sample, type: event.target.value })}
            >
              {Object.keys(current.typeDirs).length === 0 ? <option value="">（无类型）</option> : null}
              {Object.keys(current.typeDirs).map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="agx-field">
            <label>主题</label>
            <input className="agx-input" value={sample.topic} onChange={(event) => setSample({ ...sample, topic: event.target.value })} />
          </div>
        </div>
        <div className="agx-path agx-mono">
          {preview.segments && preview.segments.length > 0 ? (
            preview.segments.map((segment, index) => (
              <span key={`sample-${segment}-${index}`}>{index === 0 && preview.root ? <span className="root">{preview.root}/</span> : null}{index > 0 ? <span className="sep">/</span> : null}<span className="seg">{segment}</span></span>
            ))
          ) : (
            preview.path
          )}
        </div>
      </section>

      <div className="agx-foot">
        <span className="agx-status">
          <span className={`agx-dot ${dirty ? 'warn' : 'ok'}`} />
          {dirty ? '有未保存改动' : '已同步'}
          {snapshot.user && Object.keys(snapshot.user).length > 0 ? ' · 已覆盖默认值' : ''}
          {typeof snapshot.revision === 'number' ? ` · 修订 ${snapshot.revision}` : ''}
        </span>
        <button type="button" className="agx-btn" disabled={!dirty || saving} onClick={discard}>还原</button>
        <button
          type="button"
          className="agx-btn primary"
          disabled={!writable || saving || errors.length > 0}
          title={errors.length > 0 ? errors[0].message : undefined}
          onClick={save}
        >
          {saving ? '保存中…' : pendingConfirm ? '确认并启用' : '保存'}
        </button>
      </div>
    </div>
  )
}
