window.__ModuleLoader__.load({
	id: "dsh-ag-artifact",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __export = (target, all) => {
		  for (var name in all)
		    __defProp(target, name, { get: all[name], enumerable: true });
		};
		var __copyProps = (to, from, except, desc) => {
		  if (from && typeof from === "object" || typeof from === "function") {
		    for (let key of __getOwnPropNames(from))
		      if (!__hasOwnProp.call(to, key) && key !== except)
		        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
		  }
		  return to;
		};
		var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

		// client/index.jsx
		var index_exports = {};
		__export(index_exports, {
		  NS: () => NS,
		  apply: () => apply,
		  inject: () => inject
		});
		module.exports = __toCommonJS(index_exports);

		// client/page.jsx
		var import_react = require("react");

		// lib/core/text.js
		var FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/g;
		var MAX_SEGMENT = 64;
		function extnameOf(name) {
		  const value = String(name ?? "");
		  const index = value.lastIndexOf(".");
		  if (index <= 0 || index === value.length - 1) return "";
		  return value.slice(index);
		}
		function sanitizeSegment(input, { fallback = "\u672A\u547D\u540D", stripSpaces = true } = {}) {
		  let value = String(input ?? "").normalize("NFC").replace(FORBIDDEN, "");
		  if (stripSpaces) value = value.replace(/\s+/g, "_");
		  value = value.replace(/_{2,}/g, "_").replace(/^[.\s_]+|[.\s_]+$/g, "");
		  if (!value) value = fallback;
		  return value.slice(0, MAX_SEGMENT);
		}
		function sanitizeFileName(input, { fallback = "\u672A\u547D\u540D" } = {}) {
		  const raw = String(input ?? "").normalize("NFC");
		  const rawExt = extnameOf(raw);
		  const ext = rawExt.replace(FORBIDDEN, "").replace(/\s+/g, "");
		  let base = raw.slice(0, raw.length - rawExt.length).replace(FORBIDDEN, "");
		  base = base.replace(/\s+/g, "_").replace(/_{2,}/g, "_").replace(/^[.\s_]+|[.\s_]+$/g, "");
		  if (!base) base = fallback;
		  return (base.slice(0, MAX_SEGMENT) + ext).replace(/\.{2,}/g, ".");
		}
		function renderTemplate(template, vars = {}) {
		  const withOptional = String(template).replace(/\[([^[\]]*)\]/g, (_, inner) => {
		    const names = [...inner.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
		    const keep = names.every((name) => {
		      const value = vars[name];
		      return value !== void 0 && value !== null && String(value) !== "";
		    });
		    return keep ? inner : "";
		  });
		  return withOptional.replace(/\{(\w+)\}/g, (match, name) => {
		    const value = vars[name];
		    return value === void 0 || value === null ? match : String(value);
		  });
		}
		var pad2 = (value) => String(value).padStart(2, "0");
		function formatDate(date, format = "YYYYMMDD") {
		  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
		  return String(format).replace(/YYYY/g, String(date.getFullYear())).replace(/MM/g, pad2(date.getMonth() + 1)).replace(/DD/g, pad2(date.getDate())).replace(/HH/g, pad2(date.getHours())).replace(/mm/g, pad2(date.getMinutes())).replace(/ss/g, pad2(date.getSeconds()));
		}
		function normalizeExt(ext, defaultExt, type) {
		  let value = String(ext ?? "").trim();
		  if (!value) value = String(defaultExt?.[type] ?? defaultExt?.default ?? ".dat");
		  value = value.replace(/^\.+/, "").replace(/[^A-Za-z0-9]/g, "");
		  return value ? `.${value.toLowerCase()}` : ".dat";
		}

		// lib/core/preview.js
		var trimTrailingSlashes = (value) => String(value ?? "").replace(/[\\/]+$/, "");
		function previewPath(cfg, req = {}) {
		  const typeDirs = cfg.typeDirs ?? {};
		  const type = String(req.type ?? Object.keys(typeDirs).find((key) => key !== "default") ?? "\u62A5\u544A");
		  const typeDir = sanitizeSegment(renderTemplate(cfg.templateTypeDir ?? "{typeDir}", {
		    typeDir: sanitizeSegment(typeDirs[type] ?? typeDirs.default ?? type)
		  }));
		  const workspaceName = sanitizeSegment(req.task ?? "\u5F53\u524D\u5DE5\u4F5C\u533A");
		  const workspace = sanitizeSegment(renderTemplate(cfg.templateTask ?? "{workspace}", {
		    workspace: workspaceName,
		    task: workspaceName
		  }));
		  const category = sanitizeSegment(renderTemplate(cfg.templateCategory ?? "{category}", {
		    category: sanitizeSegment(req.category ?? "\u4EFB\u52A1\u5206\u7C7B")
		  }));
		  const topic = sanitizeSegment(req.topic ?? "\u4EA4\u4ED8\u4E3B\u9898");
		  const batch = Number.isSafeInteger(req.batch) && req.batch > 0 ? req.batch : 1;
		  const batchDir = sanitizeSegment(renderTemplate(cfg.templateBatch ?? "{topic}_\u6279\u6B21{batch}", { topic, batch }));
		  const date = req.date ?? (cfg.dateSource === "none" ? "" : formatDate(req.now ?? /* @__PURE__ */ new Date(), cfg.dateFormat ?? "YYYYMMDD"));
		  const ext = normalizeExt(req.ext, cfg.defaultExt ?? {}, type);
		  const version = Number.isSafeInteger(req.version) && req.version > 0 ? req.version : 1;
		  const fileName = sanitizeFileName(
		    renderTemplate(cfg.templateFile ?? "{topic}[_{date}]_v{n}{ext}", { topic, date, n: version, ext })
		  );
		  const segments = [workspace, category, typeDir, batchDir, fileName];
		  const root = trimTrailingSlashes(cfg.agHome);
		  const relative = segments.join("/");
		  return {
		    root,
		    workspace,
		    category,
		    typeDir,
		    batchDir,
		    fileName,
		    segments,
		    relative,
		    path: root ? `${root}/${relative}` : relative
		  };
		}

		// lib/core/draft.js
		var EDITABLE_FIELDS = [
		  "agHome",
		  "templateTask",
		  "templateCategory",
		  "templateTypeDir",
		  "templateBatch",
		  "templateFile",
		  "typeDirs",
		  "defaultExt",
		  "dateFormat",
		  "dateSource",
		  "batchPolicy",
		  "maxDepth",
		  "stagingDir",
		  "ignoreDirs",
		  "verifyMaxIssues",
		  "strictTypeDir"
		];
		function stableStringify(value) {
		  if (value === null || typeof value !== "object") return JSON.stringify(value);
		  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
		  const keys = Object.keys(value).sort();
		  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
		}
		function sameValue(left, right) {
		  return stableStringify(left) === stableStringify(right);
		}
		function normalizeDraft(value) {
		  const source = value ?? {};
		  return {
		    agHome: String(source.agHome ?? ""),
		    templateTask: String(source.templateTask ?? "{workspace}"),
		    templateCategory: String(source.templateCategory ?? "{category}"),
		    templateTypeDir: String(source.templateTypeDir ?? "{typeDir}"),
		    templateBatch: String(source.templateBatch ?? "{topic}_\u6279\u6B21{batch}"),
		    templateFile: String(source.templateFile ?? "{topic}[_{date}]_v{n}{ext}"),
		    typeDirs: { ...source.typeDirs ?? {} },
		    defaultExt: { ...source.defaultExt ?? {} },
		    dateFormat: String(source.dateFormat ?? "YYYYMMDD"),
		    dateSource: source.dateSource ?? "today",
		    batchPolicy: source.batchPolicy ?? "reuse",
		    maxDepth: Number(source.maxDepth ?? 5),
		    stagingDir: String(source.stagingDir ?? ".ag-staging"),
		    ignoreDirs: Array.isArray(source.ignoreDirs) ? [...source.ignoreDirs] : [],
		    verifyMaxIssues: Number(source.verifyMaxIssues ?? 50),
		    strictTypeDir: source.strictTypeDir !== false,
		    confirmed: source.confirmed === true,
		    importedFrom: String(source.importedFrom ?? ""),
		    importedAt: String(source.importedAt ?? "")
		  };
		}
		function diffOps(current, draft, fields = EDITABLE_FIELDS) {
		  const ops = [];
		  for (const field of fields) {
		    const before = current?.[field];
		    const after = draft?.[field];
		    if (sameValue(before, after)) continue;
		    if (after === void 0) ops.push({ op: "unset", path: [field] });
		    else ops.push({ op: "set", path: [field], value: after });
		  }
		  return ops;
		}
		function typeRows(typeDirs) {
		  return Object.entries(typeDirs ?? {}).map(([type, dir]) => ({ type, dir: String(dir) }));
		}

		// client/page.jsx
		var import_jsx_runtime = require("react/jsx-runtime");
		var STYLE = `
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
		`;
		var TEMPLATE_FIELDS = [
		  { key: "templateTask", label: "\u7B2C 1 \u5C42 \xB7 \u4EFB\u52A1\u4E3B\u6587\u4EF6\u5939", hint: "\u53D8\u91CF {workspace}", fallback: "{workspace}" },
		  { key: "templateCategory", label: "\u7B2C 2 \u5C42 \xB7 \u4EFB\u52A1\u5206\u7C7B", hint: "\u53D8\u91CF {category}", fallback: "{category}" },
		  { key: "templateTypeDir", label: "\u7B2C 3 \u5C42 \xB7 \u5927\u7C7B", hint: "\u53D8\u91CF {typeDir}", fallback: "{typeDir}" },
		  { key: "templateBatch", label: "\u7B2C 4 \u5C42 \xB7 \u5C0F\u7C7B\uFF08\u7248\u672C\u5BB9\u5668\uFF09", hint: "\u53D8\u91CF {topic} {batch}", fallback: "{topic}_\u6279\u6B21{batch}" },
		  { key: "templateFile", label: "\u7B2C 5 \u5C42 \xB7 \u6587\u4EF6\u540D", hint: "\u53D8\u91CF {topic} {date} {n} {ext}\uFF1B\u5FC5\u987B\u542B {n}", fallback: "{topic}[_{date}]_v{n}{ext}" }
		];
		function isAbsolutePath(value) {
		  return /^([/\\]|[A-Za-z]:[\\/])/.test(String(value ?? "").trim());
		}
		function collectErrors(draft) {
		  const errors = [];
		  if (!isAbsolutePath(draft.agHome)) errors.push({ field: "agHome", message: "\u4EA7\u51FA\u6839\u76EE\u5F55\u5FC5\u987B\u662F\u7EDD\u5BF9\u8DEF\u5F84" });
		  if (!String(draft.templateFile).includes("{n}")) errors.push({ field: "templateFile", message: "\u6587\u4EF6\u540D\u6A21\u677F\u5FC5\u987B\u5305\u542B {n}" });
		  if (!String(draft.templateBatch).includes("{batch}")) errors.push({ field: "templateBatch", message: "\u5C0F\u7C7B\u6A21\u677F\u5FC5\u987B\u5305\u542B {batch}" });
		  if (!Number.isInteger(draft.maxDepth) || draft.maxDepth < 5) errors.push({ field: "maxDepth", message: "\u5C42\u7EA7\u5FC5\u987B\u662F\u4E0D\u5C0F\u4E8E 5 \u7684\u6574\u6570" });
		  if (!Number.isInteger(draft.verifyMaxIssues) || draft.verifyMaxIssues < 1) errors.push({ field: "verifyMaxIssues", message: "\u81EA\u67E5\u4E0A\u9650\u5FC5\u987B\u662F\u6B63\u6574\u6570" });
		  if (!["today", "file-mtime", "none"].includes(draft.dateSource)) errors.push({ field: "dateSource", message: "\u65E5\u671F\u6765\u6E90\u53D6\u503C\u975E\u6CD5" });
		  if (!["reuse", "new", "explicit"].includes(draft.batchPolicy)) errors.push({ field: "batchPolicy", message: "\u6279\u6B21\u7B56\u7565\u53D6\u503C\u975E\u6CD5" });
		  const entries = Object.entries(draft.typeDirs ?? {});
		  if (entries.some(([key]) => key.trim().length === 0)) errors.push({ field: "typeDirs", message: "\u7C7B\u578B\u540D\u4E0D\u80FD\u4E3A\u7A7A" });
		  if (entries.some(([key, value]) => String(value).trim().length === 0)) {
		    errors.push({ field: "typeDirs", message: `\u7C7B\u578B\u300C${entries.find(([, value]) => String(value).trim() === "")[0]}\u300D\u7684\u76EE\u5F55\u540D\u4E0D\u80FD\u4E3A\u7A7A` });
		  }
		  return errors;
		}
		function cleanDraft(draft) {
		  return {
		    ...draft,
		    maxDepth: Number(draft.maxDepth),
		    verifyMaxIssues: Number(draft.verifyMaxIssues),
		    ignoreDirs: (draft.ignoreDirs ?? []).map((item) => String(item).trim()).filter(Boolean),
		    typeDirs: Object.fromEntries(
		      Object.entries(draft.typeDirs ?? {}).map(([key, value]) => [String(key).trim(), String(value).trim()]).filter(([key, value]) => key.length > 0 && value.length > 0)
		    ),
		    defaultExt: Object.fromEntries(
		      Object.entries(draft.defaultExt ?? {}).map(([key, value]) => [String(key).trim(), String(value).trim()]).filter(([key, value]) => key.length > 0 && value.length > 0)
		    )
		  };
		}
		function useScopeSnapshot(scope) {
		  const subscribe = (0, import_react.useCallback)((listener) => scope.subscribe(listener), [scope]);
		  const getSnapshot = (0, import_react.useCallback)(() => scope.getSnapshot(), [scope]);
		  return (0, import_react.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
		}
		function CopyButton({ text, label = "\u590D\u5236" }) {
		  const [copied, setCopied] = (0, import_react.useState)(false);
		  const timer = (0, import_react.useRef)(null);
		  (0, import_react.useEffect)(() => () => clearTimeout(timer.current), []);
		  const copy = async () => {
		    try {
		      await navigator.clipboard.writeText(text);
		      setCopied(true);
		      clearTimeout(timer.current);
		      timer.current = setTimeout(() => setCopied(false), 1500);
		    } catch {
		      setCopied(false);
		    }
		  };
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "agx-btn small", onClick: copy, disabled: !text, children: copied ? "\u5DF2\u590D\u5236" : label });
		}
		function TypeRow({ row, disabled, extensions, onRename, onDirChange, onExtChange, onRemove }) {
		  const [name, setName] = (0, import_react.useState)(row.type);
		  (0, import_react.useEffect)(() => setName(row.type), [row.type]);
		  const commit = () => {
		    const next = name.trim();
		    if (!next || next === row.type) {
		      setName(row.type);
		      return;
		    }
		    const done = onRename(row.type, next);
		    if (!done) setName(row.type);
		  };
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		      "input",
		      {
		        className: "agx-input",
		        value: name,
		        disabled,
		        "aria-label": "\u7C7B\u578B\u540D",
		        onChange: (event) => setName(event.target.value),
		        onBlur: commit,
		        onKeyDown: (event) => {
		          if (event.key === "Enter") event.currentTarget.blur();
		          if (event.key === "Escape") {
		            setName(row.type);
		            event.currentTarget.blur();
		          }
		        }
		      }
		    ) }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		      "input",
		      {
		        className: "agx-input",
		        value: row.dir,
		        disabled,
		        "aria-label": "\u5927\u7C7B\u76EE\u5F55",
		        onChange: (event) => onDirChange(row.type, event.target.value)
		      }
		    ) }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		      "input",
		      {
		        className: "agx-input agx-mono",
		        value: extensions[row.type] ?? "",
		        placeholder: ".md",
		        disabled,
		        "aria-label": "\u9ED8\u8BA4\u6269\u5C55\u540D",
		        onChange: (event) => onExtChange(row.type, event.target.value)
		      }
		    ) }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "agx-act", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "agx-btn small danger", disabled, onClick: () => onRemove(row.type), children: "\u5220\u9664" }) })
		  ] });
		}
		function ArtifactPage(props) {
		  const scope = props.scope;
		  const snapshot = useScopeSnapshot(scope);
		  const [draft, setDraft] = (0, import_react.useState)(null);
		  const [dirty, setDirty] = (0, import_react.useState)(false);
		  const [saving, setSaving] = (0, import_react.useState)(false);
		  const [message, setMessage] = (0, import_react.useState)(null);
		  const [sample, setSample] = (0, import_react.useState)({ task: "\u8303\u5F0F\u8F6C\u79FB", category: "\u5E93\u5B58\u5BF9\u8D26", type: "\u62A5\u544A", topic: "\u5DEE\u5F02\u5206\u6790" });
		  const fieldId = (0, import_react.useId)();
		  const messageTimer = (0, import_react.useRef)(null);
		  const ready = snapshot.status === "ready" && snapshot.value !== void 0;
		  const value = snapshot.value;
		  (0, import_react.useEffect)(() => {
		    if (!ready || dirty) return;
		    setDraft(normalizeDraft(value));
		  }, [ready, value, dirty]);
		  (0, import_react.useEffect)(() => () => clearTimeout(messageTimer.current), []);
		  const current = draft ?? normalizeDraft(value);
		  const writable = snapshot.writable !== false;
		  const pendingConfirm = current.confirmed !== true;
		  const errors = collectErrors(current);
		  const errorFields = new Set(errors.map((error) => error.field));
		  const activeType = Object.hasOwn(current.typeDirs, sample.type) ? sample.type : Object.keys(current.typeDirs)[0] ?? "";
		  const preview = (0, import_react.useMemo)(() => {
		    try {
		      return previewPath(current, { ...sample, type: activeType });
		    } catch (error) {
		      return { path: `\uFF08\u8BD5\u7B97\u5931\u8D25\uFF1A${error?.message ?? error}\uFF09`, segments: [], relative: "", root: "" };
		    }
		  }, [current, sample, activeType]);
		  const flash = (0, import_react.useCallback)((next) => {
		    setMessage(next);
		    clearTimeout(messageTimer.current);
		    if (next && next.tone !== "error") {
		      messageTimer.current = setTimeout(() => setMessage(null), 4e3);
		    }
		  }, []);
		  const update = (0, import_react.useCallback)((field, next) => {
		    setDraft((previous) => ({ ...previous ?? normalizeDraft(value), [field]: next }));
		    setDirty(true);
		    setMessage(null);
		  }, [value]);
		  const setTypeDir = (0, import_react.useCallback)((type, dir) => {
		    setDraft((previous) => {
		      const base = previous ?? normalizeDraft(value);
		      return { ...base, typeDirs: { ...base.typeDirs, [type]: dir } };
		    });
		    setDirty(true);
		    setMessage(null);
		  }, [value]);
		  const renameType = (0, import_react.useCallback)((oldType, nextType) => {
		    if (Object.hasOwn(current.typeDirs, nextType)) return false;
		    setDraft((previous) => {
		      const base = previous ?? normalizeDraft(value);
		      const rebuilt = {};
		      for (const [key, dir] of Object.entries(base.typeDirs)) rebuilt[key === oldType ? nextType : key] = dir;
		      const extensions = { ...base.defaultExt };
		      if (Object.hasOwn(extensions, oldType)) {
		        extensions[nextType] = extensions[oldType];
		        delete extensions[oldType];
		      }
		      return { ...base, typeDirs: rebuilt, defaultExt: extensions };
		    });
		    setDirty(true);
		    setMessage(null);
		    return true;
		  }, [value, current.typeDirs]);
		  const removeType = (0, import_react.useCallback)((type) => {
		    setDraft((previous) => {
		      const base = previous ?? normalizeDraft(value);
		      const typeDirs = { ...base.typeDirs };
		      const defaultExt = { ...base.defaultExt };
		      delete typeDirs[type];
		      delete defaultExt[type];
		      return { ...base, typeDirs, defaultExt };
		    });
		    setDirty(true);
		    setMessage(null);
		  }, [value]);
		  const addType = (0, import_react.useCallback)(() => {
		    setDraft((previous) => {
		      const base = previous ?? normalizeDraft(value);
		      let index = Object.keys(base.typeDirs).length + 1;
		      let type = `\u7C7B\u578B${index}`;
		      while (Object.hasOwn(base.typeDirs, type)) type = `\u7C7B\u578B${++index}`;
		      return { ...base, typeDirs: { ...base.typeDirs, [type]: type } };
		    });
		    setDirty(true);
		    setMessage(null);
		  }, [value]);
		  const resetTemplate = (0, import_react.useCallback)((field, fallback) => {
		    update(field, fallback);
		  }, [update]);
		  const discard = (0, import_react.useCallback)(() => {
		    setDraft(normalizeDraft(value));
		    setDirty(false);
		    flash({ tone: "ok", text: "\u5DF2\u8FD8\u539F\u4E3A\u5F53\u524D\u751F\u6548\u914D\u7F6E" });
		  }, [value, flash]);
		  const save = (0, import_react.useCallback)(async () => {
		    if (!ready || !writable || saving) return;
		    const cleaned = cleanDraft(current);
		    const problems = collectErrors(cleaned);
		    if (problems.length > 0) {
		      flash({ tone: "error", text: problems[0].message });
		      return;
		    }
		    const ops = diffOps(value, cleaned);
		    if (pendingConfirm) ops.push({ op: "set", path: ["confirmed"], value: true });
		    if (ops.length === 0) {
		      flash({ tone: "ok", text: "\u6CA1\u6709\u9700\u8981\u4FDD\u5B58\u7684\u6539\u52A8" });
		      return;
		    }
		    setSaving(true);
		    try {
		      const ok = await scope.mutate(ops, snapshot.revision);
		      if (ok) setDirty(false);
		      flash(
		        ok ? { tone: "ok", text: pendingConfirm ? "\u5DF2\u786E\u8BA4\u5E76\u542F\u7528" : "\u5DF2\u4FDD\u5B58" } : { tone: "error", text: "\u914D\u7F6E\u5DF2\u88AB\u5176\u4ED6\u7A97\u53E3\u4FEE\u6539\uFF0C\u8349\u7A3F\u5DF2\u4FDD\u7559\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u540E\u91CD\u8BD5" }
		      );
		    } catch (error) {
		      flash({ tone: "error", text: `\u4FDD\u5B58\u5931\u8D25\uFF1A${error?.message ?? error}` });
		    } finally {
		      setSaving(false);
		    }
		  }, [ready, writable, saving, current, value, pendingConfirm, scope, snapshot.revision, flash]);
		  if (!ready) {
		    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: STYLE }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "agx-card agx-muted", children: snapshot.status === "loading" ? "\u6B63\u5728\u8BFB\u53D6\u914D\u7F6E\u2026" : "\u914D\u7F6E\u5C1A\u4E0D\u53EF\u7528\uFF08\u8BE5\u8BBE\u7F6E\u9875\u53EA\u5728 Host \u63D0\u4F9B ag-artifact \u547D\u540D\u7A7A\u95F4\u65F6\u51FA\u73B0\uFF09\u3002" })
		    ] });
		  }
		  const typeList = typeRows(current.typeDirs);
		  const importedAt = current.importedAt ? String(current.importedAt).replace("T", " ").slice(0, 19) : "";
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx", children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: STYLE }),
		    pendingConfirm && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-banner", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "agx-dot warn" }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\u5F85\u786E\u8BA4\uFF1A" }),
		        "\u5F53\u524D\u914D\u7F6E\u6765\u81EA",
		        current.importedFrom ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", { className: "agx-mono", children: [
		          " ",
		          current.importedFrom,
		          " "
		        ] }) : "\u73B0\u6709\u8BBE\u7F6E",
		        "\u7684\u9996\u6B21\u63A5\u7BA1",
		        importedAt ? `\uFF08${importedAt}\uFF09` : "",
		        "\u3002\u8BF7\u6838\u5BF9\u4E0B\u9762\u7684\u6839\u76EE\u5F55\u4E0E\u76EE\u5F55\u89C4\u5219\uFF0C\u786E\u8BA4\u540E\u70B9\u53F3\u4E0B\u89D2\u300C\u786E\u8BA4\u5E76\u542F\u7528\u300D\u3002 \u65E7\u914D\u7F6E\u6587\u4EF6\u4E0D\u4F1A\u88AB\u4FEE\u6539\u3002"
		      ] })
		    ] }),
		    message && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `agx-banner ${message.tone === "error" ? "error" : "ok"}`, role: "status", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `agx-dot ${message.tone === "error" ? "danger" : "ok"}` }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: message.text })
		    ] }),
		    errors.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-banner error", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "agx-dot danger" }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: errors[0].message })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-hero", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "agx-card", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-head", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { className: "agx-title", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "agx-index", children: "01" }),
		            "\u5F53\u524D\u72B6\u6001"
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: `agx-tag ${current.confirmed ? "ok" : "warn"}`, children: [
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `agx-dot ${current.confirmed ? "ok" : "warn"}` }),
		            current.confirmed ? "\u5DF2\u786E\u8BA4" : "\u5BA1\u9605\u4E2D"
		          ] })
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-field", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${fieldId}-agHome`, children: "\u4EA7\u51FA\u6839\u76EE\u5F55\uFF08\u7EDD\u5BF9\u8DEF\u5F84\uFF09" }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		            "input",
		            {
		              id: `${fieldId}-agHome`,
		              className: "agx-input agx-mono",
		              value: current.agHome,
		              disabled: !writable,
		              "aria-invalid": errorFields.has("agHome"),
		              placeholder: "/Volumes/NASData/dingmac/DSH\u4EA7\u51FA",
		              onChange: (event) => update("agHome", event.target.value)
		            }
		          ),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { className: "agx-hint", children: "\u6240\u6709\u4EA7\u51FA\u7269\u843D\u5728\u8FD9\u91CC\uFF1B\u7559\u7A7A\u65F6\u56DE\u9000\u8BFB\u53D6 ag_config.json \u7684 paths.AG_HOME\u3002" })
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-field", style: { marginTop: 10 }, children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "\u914D\u7F6E\u6765\u6E90" }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 12, opacity: 0.75, wordBreak: "break-all" }, children: [
		            current.importedFrom ? `\u9996\u6B21\u63A5\u7BA1\u81EA ${current.importedFrom}` : "\u63D2\u4EF6\u914D\u7F6E\uFF08profile patch\uFF09",
		            importedAt ? ` \xB7 ${importedAt}` : ""
		          ] })
		        ] })
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "agx-card", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-head", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { className: "agx-title", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "agx-index", children: "02" }),
		            "\u8DEF\u5F84\u6837\u4F8B"
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CopyButton, { text: preview.path, label: "\u590D\u5236\u8DEF\u5F84" })
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "agx-path agx-mono", children: preview.segments && preview.segments.length > 0 ? preview.segments.map((segment, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
		          index === 0 && preview.root ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "root", children: [
		            preview.root,
		            "/"
		          ] }) : null,
		          index > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "sep", children: "/" }) : null,
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "seg", children: segment })
		        ] }, `${segment}-${index}`)) : preview.path }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "agx-hint", style: { marginTop: 8 }, children: "\u6309\u5F53\u524D\u89C4\u5219 + \u4E0B\u65B9\u8BD5\u7B97\u53C2\u6570\u5B9E\u65F6\u751F\u6210\uFF1B\u6279\u6B21\u53F7\u4E0E\u7248\u672C\u53F7\u5728\u771F\u5B9E\u843D\u76D8\u65F6\u7531\u76EE\u5F55\u626B\u63CF\u51B3\u5B9A\u3002" })
		      ] })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "agx-card", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-head", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { className: "agx-title", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "agx-index", children: "03" }),
		          "\u76EE\u5F55\u89C4\u5219\uFF08\u56FA\u5B9A\u4E94\u5C42\uFF09"
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "agx-hint", children: "\u65B9\u62EC\u53F7\u6BB5\u4E3A\u53EF\u9009\u6BB5" })
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "agx-grid", children: TEMPLATE_FIELDS.map((field) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-field", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { htmlFor: `${fieldId}-${field.key}`, children: [
		          field.label,
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		            "button",
		            {
		              type: "button",
		              className: "agx-reset",
		              disabled: !writable,
		              onClick: () => resetTemplate(field.key, field.fallback),
		              children: "\u6062\u590D\u9ED8\u8BA4"
		            }
		          )
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		          "input",
		          {
		            id: `${fieldId}-${field.key}`,
		            className: "agx-input agx-mono",
		            value: current[field.key],
		            disabled: !writable,
		            "aria-invalid": errorFields.has(field.key),
		            onChange: (event) => update(field.key, event.target.value)
		          }
		        ),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: field.hint })
		      ] }, field.key)) }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-chips", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "agx-chip", children: current.templateTask }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "arrow", children: "/" }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "agx-chip", children: current.templateCategory }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "arrow", children: "/" }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "agx-chip", children: current.templateTypeDir }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "arrow", children: "/" }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "agx-chip", children: current.templateBatch }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "arrow", children: "/" }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "agx-chip", children: current.templateFile })
		      ] })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-hero", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "agx-card", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-head", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { className: "agx-title", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "agx-index", children: "04" }),
		            "\u7C7B\u578B\u76EE\u5F55"
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "agx-btn small", disabled: !writable, onClick: addType, children: "+ \u65B0\u589E" })
		        ] }),
		        typeList.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "agx-empty", children: "\u8FD8\u6CA1\u6709\u7C7B\u578B\u3002\u70B9\u300C+ \u65B0\u589E\u300D\u6DFB\u52A0\uFF0C\u4F8B\u5982 \u62A5\u544A \u2192 \u62A5\u544A\u3002" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { className: "agx-table", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { style: { width: "30%" }, children: "\u7C7B\u578B" }),
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "\u5927\u7C7B\u76EE\u5F55" }),
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { style: { width: "26%" }, children: "\u9ED8\u8BA4\u6269\u5C55\u540D" }),
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "agx-act" })
		          ] }) }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: typeList.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		            TypeRow,
		            {
		              row,
		              disabled: !writable,
		              extensions: current.defaultExt,
		              onRename: renameType,
		              onDirChange: setTypeDir,
		              onExtChange: (type, ext) => update("defaultExt", { ...current.defaultExt, [type]: ext }),
		              onRemove: removeType
		            },
		            row.type
		          )) })
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "agx-hint", style: { marginTop: 8 }, children: "\u7C7B\u578B\u662F artifact_save/artifact_place \u7684 `type` \u53C2\u6570\uFF1B`default` \u53EF\u4F5C\u672A\u77E5\u7C7B\u578B\u7684\u515C\u5E95\u76EE\u5F55\u3002" })
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "agx-card", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "agx-head", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { className: "agx-title", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "agx-index", children: "05" }),
		          "\u7B56\u7565"
		        ] }) }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-grid", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-field", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${fieldId}-dateSource`, children: "\u65E5\u671F\u6765\u6E90" }),
		            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
		              "select",
		              {
		                id: `${fieldId}-dateSource`,
		                className: "agx-select",
		                value: current.dateSource,
		                disabled: !writable,
		                onChange: (event) => update("dateSource", event.target.value),
		                children: [
		                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "today", children: "today\uFF08\u5F53\u524D\u65F6\u95F4\uFF09" }),
		                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "file-mtime", children: "file-mtime\uFF08\u6E90\u6587\u4EF6\u65F6\u95F4\uFF09" }),
		                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "none", children: "none\uFF08\u4E0D\u5199\u65E5\u671F\uFF09" })
		                ]
		              }
		            )
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-field", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${fieldId}-dateFormat`, children: "\u65E5\u671F\u683C\u5F0F" }),
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		              "input",
		              {
		                id: `${fieldId}-dateFormat`,
		                className: "agx-input agx-mono",
		                value: current.dateFormat,
		                disabled: !writable,
		                onChange: (event) => update("dateFormat", event.target.value)
		              }
		            )
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-field", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${fieldId}-batchPolicy`, children: "\u6279\u6B21\u7B56\u7565" }),
		            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
		              "select",
		              {
		                id: `${fieldId}-batchPolicy`,
		                className: "agx-select",
		                value: current.batchPolicy,
		                disabled: !writable,
		                onChange: (event) => update("batchPolicy", event.target.value),
		                children: [
		                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "reuse", children: "reuse\uFF08\u590D\u7528\u6700\u65B0\u6279\u6B21\uFF09" }),
		                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "new", children: "new\uFF08\u6BCF\u6B21\u65B0\u5EFA\u6279\u6B21\uFF09" }),
		                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "explicit", children: "explicit\uFF08\u5FC5\u987B\u663E\u5F0F\u6307\u5B9A\uFF09" })
		                ]
		              }
		            )
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-field", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${fieldId}-maxDepth`, children: "\u6700\u5927\u5C42\u7EA7" }),
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		              "input",
		              {
		                id: `${fieldId}-maxDepth`,
		                className: "agx-input",
		                type: "number",
		                min: 5,
		                value: Number.isFinite(current.maxDepth) ? current.maxDepth : "",
		                disabled: !writable,
		                "aria-invalid": errorFields.has("maxDepth"),
		                onChange: (event) => update("maxDepth", event.target.value === "" ? "" : Number(event.target.value))
		              }
		            )
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-field", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${fieldId}-staging`, children: "\u6682\u5B58\u76EE\u5F55" }),
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		              "input",
		              {
		                id: `${fieldId}-staging`,
		                className: "agx-input agx-mono",
		                value: current.stagingDir,
		                disabled: !writable,
		                onChange: (event) => update("stagingDir", event.target.value)
		              }
		            )
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-field", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${fieldId}-verify`, children: "\u81EA\u67E5\u95EE\u9898\u4E0A\u9650" }),
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		              "input",
		              {
		                id: `${fieldId}-verify`,
		                className: "agx-input",
		                type: "number",
		                min: 1,
		                value: Number.isFinite(current.verifyMaxIssues) ? current.verifyMaxIssues : "",
		                disabled: !writable,
		                "aria-invalid": errorFields.has("verifyMaxIssues"),
		                onChange: (event) => update("verifyMaxIssues", event.target.value === "" ? "" : Number(event.target.value))
		              }
		            )
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-field", style: { gridColumn: "1 / -1" }, children: [
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: `${fieldId}-ignore`, children: "\u5FFD\u7565\u76EE\u5F55\uFF08\u9017\u53F7\u5206\u9694\uFF09" }),
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		              "input",
		              {
		                id: `${fieldId}-ignore`,
		                className: "agx-input agx-mono",
		                value: (current.ignoreDirs ?? []).join(", "),
		                disabled: !writable,
		                onChange: (event) => update("ignoreDirs", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))
		              }
		            )
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-field", style: { gridColumn: "1 / -1" }, children: [
		            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "\u4E25\u683C\u7C7B\u578B\u76EE\u5F55" }),
		            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "agx-check", children: [
		              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		                "input",
		                {
		                  type: "checkbox",
		                  checked: current.strictTypeDir,
		                  disabled: !writable,
		                  onChange: (event) => update("strictTypeDir", event.target.checked)
		                }
		              ),
		              "\u7B2C 3 \u5C42\u76EE\u5F55\u5FC5\u987B\u547D\u4E2D\u7C7B\u578B\u76EE\u5F55\u8868"
		            ] })
		          ] })
		        ] })
		      ] })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "agx-card", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-head", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { className: "agx-title", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "agx-index", children: "06" }),
		          "\u8DEF\u5F84\u8BD5\u7B97"
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "agx-hint", children: "\u53EA\u8BFB\u9884\u89C8\uFF0C\u4E0D\u5199\u76D8" })
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-grid", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-field", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "\u4EFB\u52A1" }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: "agx-input", value: sample.task, onChange: (event) => setSample({ ...sample, task: event.target.value }) })
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-field", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "\u5206\u7C7B" }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: "agx-input", value: sample.category, onChange: (event) => setSample({ ...sample, category: event.target.value }) })
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-field", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "\u7C7B\u578B" }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
		            "select",
		            {
		              className: "agx-select",
		              value: activeType,
		              onChange: (event) => setSample({ ...sample, type: event.target.value }),
		              children: [
		                Object.keys(current.typeDirs).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: "\uFF08\u65E0\u7C7B\u578B\uFF09" }) : null,
		                Object.keys(current.typeDirs).map((type) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: type, children: type }, type))
		              ]
		            }
		          )
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-field", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "\u4E3B\u9898" }),
		          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: "agx-input", value: sample.topic, onChange: (event) => setSample({ ...sample, topic: event.target.value }) })
		        ] })
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "agx-path agx-mono", children: preview.segments && preview.segments.length > 0 ? preview.segments.map((segment, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
		        index === 0 && preview.root ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "root", children: [
		          preview.root,
		          "/"
		        ] }) : null,
		        index > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "sep", children: "/" }) : null,
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "seg", children: segment })
		      ] }, `sample-${segment}-${index}`)) : preview.path })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "agx-foot", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "agx-status", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `agx-dot ${dirty ? "warn" : "ok"}` }),
		        dirty ? "\u6709\u672A\u4FDD\u5B58\u6539\u52A8" : "\u5DF2\u540C\u6B65",
		        snapshot.user && Object.keys(snapshot.user).length > 0 ? " \xB7 \u5DF2\u8986\u76D6\u9ED8\u8BA4\u503C" : "",
		        typeof snapshot.revision === "number" ? ` \xB7 \u4FEE\u8BA2 ${snapshot.revision}` : ""
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "agx-btn", disabled: !dirty || saving, onClick: discard, children: "\u8FD8\u539F" }),
		      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		        "button",
		        {
		          type: "button",
		          className: "agx-btn primary",
		          disabled: !writable || saving || errors.length > 0,
		          title: errors.length > 0 ? errors[0].message : void 0,
		          onClick: save,
		          children: saving ? "\u4FDD\u5B58\u4E2D\u2026" : pendingConfirm ? "\u786E\u8BA4\u5E76\u542F\u7528" : "\u4FDD\u5B58"
		        }
		      )
		    ] })
		  ] });
		}

		// client/index.jsx
		var NS = "settings.agArtifact";
		var inject = ["slots", "configForms"];
		function apply(ctx) {
		  const scope = ctx.configForms.get("ag-artifact");
		  ctx.effect(
		    () => () => {
		      scope.dispose?.();
		    },
		    "dsh-ag-artifact: form subscription"
		  );
		  ctx.effect(
		    () => ctx.configForms.whileServed(
		      ["ag-artifact"],
		      () => ctx.slots.inject(
		        "settings.section",
		        () => ctx.slots.register(
		          {
		            name: "settings.section",
		            id: "ag-artifact",
		            order: 60,
		            label: () => "\u4EA7\u51FA\u89C4\u8303",
		            inject: () => ({ scope })
		          },
		          ArtifactPage
		        )
		      )
		    ),
		    "dsh-ag-artifact: page"
		  );
		}

		return module.exports;
	}
});
