/**
 * lib/tools.js — 三个模型工具：artifact_save / artifact_place / artifact_verify。
 *
 * 这三个工具都在 Host 进程内用 node:fs 直接读写，因此不受会话文件沙箱的工作区限制：
 * 产出根目录在会话工作区之外也能落盘（这正是当前流程每次都要审批的痛点）。
 */
import { randomBytes } from 'node:crypto'
import { copyFile, mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path'
import { effectiveConfig } from './config.js'
import { resolveTarget } from './path.js'
import { verifyTree } from './verify.js'

const TEXT_HINT = '文本产出走 artifact_save；脚本/二进制产出先写到会话工作区的暂存目录，再用 artifact_place 移入。'

/** 取当前会话工作目录：优先 workingDirectory 服务，回退 SessionHeader.cwd。 */
async function cwdOf(ctx, exec) {
  const service = typeof ctx.get === 'function' ? ctx.get('workingDirectory', false) : ctx.workingDirectory
  if (exec?.agent && service !== undefined) {
    try {
      return await service.ensure(exec.agent, exec.signal)
    } catch {
      /* 回退 */
    }
  }
  return exec?.agent?.session?.header?.cwd ?? process.cwd()
}

/** 逐级创建目录，返回本次真正新建的目录（用于报告，不创建多余空目录）。 */
async function ensureDirTracked(dir) {
  const missing = []
  let current = dir
  for (;;) {
    try {
      const info = await stat(current)
      if (!info.isDirectory()) throw new Error(`路径已存在但不是目录：${current}`)
      break
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      missing.unshift(current)
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
  }
  const created = []
  for (const path of missing) {
    await mkdir(path)
    created.push(path)
  }
  return created
}

/** 同目录临时文件名：写完再 rename，避免留下半截文件。 */
function tmpPath(target) {
  const suffix = randomBytes(4).toString('hex')
  return join(dirname(target), `.tmp-${basename(target)}-${process.pid}-${Date.now()}-${suffix}`)
}

/** 判断路径是否已存在（只区分 ENOENT）。 */
async function pathExists(target) {
  try {
    await stat(target)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

/**
 * 解析一个不会覆盖已有文件的落盘计划：目标已存在就自动 +1，最多重试 8 次。
 * @param {object} cfg
 * @param {object} request
 * @param {{ explicitVersion?: boolean, attempts?: number }} [options]
 * @returns {Promise<object>}
 */
async function allocatePlan(cfg, request, { explicitVersion = false, attempts = 8 } = {}) {
  let next = { ...request }
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const plan = resolveTarget(cfg, next)
    if (!(await pathExists(plan.filePath))) return plan
    if (explicitVersion) throw new Error(`artifact: 目标版本已存在，拒绝覆盖：${plan.filePath}`)
    next = { ...next, version: plan.version + 1 }
  }
  throw new Error('artifact: 无法分配未占用的版本号（连续冲突）')
}

/**
 * 写临时文件 → 复查目标 → rename，保证不覆盖已有版本。
 * @param {{ cfg: object, request: object, explicitVersion?: boolean, writeTemp: (temp: string) => Promise<void> }} options
 * @returns {Promise<{ plan: object, created: string[] }>}
 */
async function commitPlan({ cfg, request, explicitVersion = false, writeTemp }) {
  let currentRequest = { ...request }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const plan = await allocatePlan(cfg, currentRequest, { explicitVersion })
    const created = await ensureDirTracked(plan.dir)
    const temp = tmpPath(plan.filePath)
    try {
      await writeTemp(temp)
      if (await pathExists(plan.filePath)) {
        await unlink(temp).catch(() => {})
        if (explicitVersion) throw new Error(`artifact: 目标版本已存在，拒绝覆盖：${plan.filePath}`)
        currentRequest = { ...currentRequest, version: plan.version + 1 }
        continue
      }
      await rename(temp, plan.filePath)
      return { plan, created }
    } catch (error) {
      await unlink(temp).catch(() => {})
      throw error
    }
  }
  throw new Error('artifact: 无法分配未占用的版本号（连续冲突）')
}

/** 把工具参数整理成 resolveTarget 的请求。 */
function buildRequest(args, cwd, extra = {}) {
  return {
    task: args.task ?? basename(cwd),
    category: args.category,
    type: args.type,
    topic: args.topic,
    batch: args.batch,
    version: args.version,
    date: args.date,
    ext: args.ext,
    ...extra,
  }
}

const writeOutput = {
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      path: { type: 'string', required: true },
      dir: { type: 'string', required: true },
      version: { type: 'integer', required: true },
      batch: { type: 'integer', required: true },
      bytes: { type: 'integer' },
      created: { type: 'array', items: { type: 'string' } },
      warnings: { type: 'array', items: { type: 'string' } },
      dry_run: { type: 'boolean' },
      moved: { type: 'boolean' },
      source: { type: 'string' },
    },
  },
  render: (_args, value) => [
    {
      type: 'text',
      text: value.dry_run
        ? `[dry-run] 目标路径：${value.path}（版本 v${value.version}，批次 ${value.batch}）`
        : `已写入 v${value.version}（批次 ${value.batch}）：${value.path}${value.moved ? '（已从暂存位置移入，源文件已删除）' : ''}`,
    },
  ],
}

/**
 * 注册三个产出物工具。
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {Record<string, any>} config - 插件 Config（可能含 volatile 引用）。
 * @param {Function} defineTool - 由入口注入的 `defineTool`（这样本文件可脱离 DSH 单测）。
 */
export function registerTools(ctx, config, defineTool) {
  if (typeof defineTool !== 'function') throw new Error('ag-artifact: registerTools 需要 defineTool 依赖')
  ctx.tools.register(
    defineTool({
      name: 'artifact_save',
      description:
        '把文本内容写入 AG 产出规范的五层路径，并自动分配下一个版本号（_vN+1）。' +
        '适用于 .md/.py/.sh/.html/.json/.csv 等文本产出。' +
        '目录与文件名会按插件配置清洗（禁用字符、空格、批次、日期、版本）。' +
        '落盘后应对最终文件调用 present 交付；需要先看落点时可传 dry_run=true。' +
        TEXT_HINT,
      parameters: {
        type: { type: 'string', required: true, description: '产出类型：脚本/报告/数据/截图/原型/参考（或插件配置的其它类型）' },
        category: { type: 'string', required: true, description: '第 2 层任务分类：业务主题名' },
        topic: { type: 'string', required: true, description: '交付物主题名，用于生成小类目录与文件名' },
        content: { type: 'string', required: true, description: '文件文本内容（UTF-8，无 BOM）' },
        task: { type: 'string', description: '第 1 层任务主文件夹；缺省用当前会话工作区名' },
        ext: { type: 'string', description: '扩展名，如 .md；缺省按产出类型取配置默认值' },
        batch: { type: 'number', description: '显式批次号；缺省按配置的 batchPolicy 决定' },
        version: { type: 'number', description: '显式版本号；一般不要传，插件会自动 +1' },
        date: { type: 'string', description: '显式日期串，覆盖 dateSource 计算结果' },
        dry_run: { type: 'boolean', description: '只解析目标路径，不写盘' },
      },
      output: writeOutput,
      async execute(args, exec) {
        const cfg = effectiveConfig(config)
        const cwd = await cwdOf(ctx, exec)
        const request = buildRequest(args, cwd)
        const explicitVersion = args.version !== undefined && args.version !== null
        if (args.dry_run) {
          const plan = await allocatePlan(cfg, request, { explicitVersion })
          return {
            path: plan.filePath,
            dir: plan.dir,
            version: plan.version,
            batch: plan.batch,
            created: [],
            warnings: plan.warnings,
            dry_run: true,
          }
        }
        exec.signal?.throwIfAborted?.()
        const { plan, created } = await commitPlan({
          cfg,
          request,
          explicitVersion,
          writeTemp: (temp) => writeFile(temp, String(args.content).replace(/^\uFEFF/, ''), 'utf8'),
        })
        const info = await stat(plan.filePath)
        return {
          path: plan.filePath,
          dir: plan.dir,
          version: plan.version,
          batch: plan.batch,
          bytes: info.size,
          created,
          warnings: plan.warnings,
        }
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'artifact_place',
      description:
        '把已经生成好的文件（.xlsx/.png/.pdf 等二进制，或任何已存在的文件）移入 AG 产出规范的五层路径，' +
        '自动分配版本号并（默认）删除源文件。脚本产出请先写到会话工作区的暂存目录，再用本工具移入；' +
        '不要用 bash 直接写产出根目录（在会话工作区之外，会被文件沙箱拒绝）。' +
        '落盘后应对最终文件调用 present 交付。',
      parameters: {
        source_path: { type: 'string', required: true, description: '已存在的源文件；相对路径按会话工作目录解析' },
        type: { type: 'string', required: true, description: '产出类型：脚本/报告/数据/截图/原型/参考（或插件配置的其它类型）' },
        category: { type: 'string', required: true, description: '第 2 层任务分类：业务主题名' },
        topic: { type: 'string', required: true, description: '交付物主题名，用于生成小类目录与文件名' },
        task: { type: 'string', description: '第 1 层任务主文件夹；缺省用当前会话工作区名' },
        ext: { type: 'string', description: '扩展名覆盖；缺省沿用源文件扩展名' },
        batch: { type: 'number', description: '显式批次号；缺省按配置的 batchPolicy 决定' },
        version: { type: 'number', description: '显式版本号；一般不要传' },
        date: { type: 'string', description: '显式日期串，覆盖 dateSource 计算结果' },
        copy: { type: 'boolean', description: 'true=复制（保留源文件）；缺省 false=移动' },
        dry_run: { type: 'boolean', description: '只解析目标路径，不移动文件' },
      },
      output: writeOutput,
      async execute(args, exec) {
        const cfg = effectiveConfig(config)
        const cwd = await cwdOf(ctx, exec)
        const source = isAbsolute(args.source_path) ? args.source_path : resolve(cwd, args.source_path)
        const sourceInfo = await stat(source)
        if (!sourceInfo.isFile()) throw new Error(`artifact_place: 源路径不是普通文件：${source}`)
        const request = buildRequest(args, cwd, {
          ext: args.ext ?? extname(source),
          sourcePath: source,
        })
        const explicitVersion = args.version !== undefined && args.version !== null
        const preliminary = resolveTarget(cfg, request)
        if (source === preliminary.filePath) {
          return {
            path: preliminary.filePath,
            dir: preliminary.dir,
            version: preliminary.version,
            batch: preliminary.batch,
            bytes: sourceInfo.size,
            created: [],
            warnings: preliminary.warnings,
            moved: false,
            source,
          }
        }
        if (args.dry_run) {
          const plan = await allocatePlan(cfg, request, { explicitVersion })
          return {
            path: plan.filePath,
            dir: plan.dir,
            version: plan.version,
            batch: plan.batch,
            created: [],
            warnings: plan.warnings,
            dry_run: true,
            source,
          }
        }
        exec.signal?.throwIfAborted?.()
        const { plan, created } = await commitPlan({
          cfg,
          request,
          explicitVersion,
          writeTemp: async (temp) => {
            await copyFile(source, temp)
            const copied = await stat(temp)
            if (copied.size !== sourceInfo.size) {
              throw new Error(`artifact_place: 拷贝大小校验失败（源 ${sourceInfo.size}B，目标 ${copied.size}B）`)
            }
          },
        })
        let moved = false
        if (args.copy !== true) {
          await unlink(source)
          moved = true
        }
        const info = await stat(plan.filePath)
        return {
          path: plan.filePath,
          dir: plan.dir,
          version: plan.version,
          batch: plan.batch,
          bytes: info.size,
          created,
          warnings: plan.warnings,
          moved,
          source,
        }
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'artifact_verify',
      description:
        '自查产出根目录是否符合 AG 五层规范（层级、目录名空格/禁用字符、小类 <主题>_批次N、文件名 _vN、空目录）。' +
        '只读、不修改文件。交付前调用；有 error 时先修正再交付。',
      parameters: {
        scope: { type: 'string', description: '只检查这个子目录；绝对路径或相对会话工作目录，缺省检查整个产出根目录' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            root: { type: 'string', required: true },
            ok: { type: 'boolean', required: true },
            files: { type: 'integer', required: true },
            dirs: { type: 'integer', required: true },
            truncated: { type: 'boolean', required: true },
            issues: {
              type: 'array',
              required: true,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  level: { type: 'string', required: true },
                  path: { type: 'string', required: true },
                  message: { type: 'string', required: true },
                },
              },
            },
          },
        },
        render: (_args, value) => {
          const lines = [
            value.ok ? `自查通过：${value.files} 个文件，${value.dirs} 个目录。` : `自查未通过：${value.issues.filter((issue) => issue.level === 'error').length} 个 error。`,
          ]
          for (const issue of value.issues.slice(0, 10)) lines.push(`- [${issue.level}] ${issue.path}：${issue.message}`)
          if (value.truncated) lines.push('（问题过多，已截断）')
          return [{ type: 'text', text: lines.join('\n') }]
        },
      },
      async execute(args, exec) {
        const cfg = effectiveConfig(config)
        const cwd = await cwdOf(ctx, exec)
        const scope = args.scope ? (isAbsolute(args.scope) ? args.scope : resolve(cwd, args.scope)) : undefined
        return verifyTree(cfg, scope)
      },
    }),
  )
}
