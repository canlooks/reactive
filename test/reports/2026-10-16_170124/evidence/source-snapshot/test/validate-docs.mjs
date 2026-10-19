import assert from 'node:assert/strict'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Documentation checks only; behavioral test entry points remain unchanged.
const testDir = dirname(fileURLToPath(import.meta.url))
const suites = [
    ['N', 'test.ts', 'npm run test:node'],
    ['X', 'reference.ts', 'npm run test:node'],
    ['S', 'storage.ts', 'npm run test:node'],
    ['B', 'storage-browser.ts', 'npm run test:node'],
    ['R', 'react.tsx', 'npm run test:react'],
    ['F', 'react-features.tsx', 'npm run test:react'],
    ['L', 'react-loading.tsx', 'npm run test:react'],
]
const entries = []
for (const [prefix, file, command] of suites) {
    const source = await readFile(resolve(testDir, file), 'utf8')
    let index = 0
    for (const match of source.matchAll(/^test\('([^']+)'/gm)) {
        const id = `${prefix}${String(++index).padStart(2, '0')}`
        const line = source.slice(0, match.index).split('\n').length
        entries.push({ id, file, command, title: match[1], line })
    }
    assert.ok(index, `No test declarations found in ${file}`)
}

const inventory = [
    '# 现有自动化测试索引', '',
    '由 `node test/validate-docs.mjs --inventory` 从当前源码生成。编号是本次交付的定位编号，不是新增的测试。增删测试后需同步检查用例映射。', '',
    '运行说明见 [测试计划](TEST_PLAN.md)，详细场景见 [测试用例入口](TEST_CASES.md)，本次实测结果见 [基线记录](BASELINE.md)。', '',
    `共 ${entries.length} 个 node:test 声明。一个声明可能覆盖多组输入；数量不是代码覆盖率，也不等于详细用例数量。`, '',
    '| 编号 | 测试源码及当前行号 | 原始测试标题 | 执行入口 |',
    '| --- | --- | --- | --- |',
    ...entries.map(e => `| ${e.id} | [${e.file}](${e.file})：${e.line} | ${e.title} | \`${e.command}\` |`), '',
    '## 构建、类型与包级检查', '',
    '| 证据代号 | 文件 | 验证范围 |',
    '| --- | --- | --- |',
    '| T-CORE | [核心类型配置](types/tsconfig.json) | esm/commonjs、computed、watch、storage 的 .mts/.cts 正反类型用例；无 DOM、无额外 types |',
    '| T-REACT | [React 类型配置](types/react/tsconfig.json) | ESM/CJS、JSX、Model、Chip、useLoading、loading 的正反类型用例 |',
    '| T-LF | [localforage 类型示例](storage-localforage.ts) | localforage 薄包装编译检查；不是 IndexedDB 运行时测试 |',
    '| D-CORE | [核心断言](smoke-assertions.cjs)、[ESM 入口](smoke.mjs)、[CJS 入口](smoke.cjs) | 根导出、计算值、方法装饰器、模块共享与 SSR |',
    '| D-STORAGE | [存储冒烟](storage-smoke.cjs) | 同步/异步存储与双方向混合入口 |',
    '| D-REACT | [React 冒烟](react-smoke.mjs) | 十九个导出、别名、组件/Model/Chip/加载状态 |',
    '| PKG | [隔离打包脚本](../scripts/test-package.mjs) | tarball 白名单、无 React/localforage 核心消费者、React 18.3.1/工作区 19 隔离消费者 |',
    '| BUILD | [构建脚本](../scripts/build.mjs) | ESM/CJS、声明、Node 条件入口 |', '',
].join('\n')
if (process.argv.includes('--inventory')) {
    await writeFile(resolve(testDir, 'AUTOMATION.md'), inventory)
    console.log(`Generated AUTOMATION.md: ${entries.length} tests`)
    process.exit(0)
}
assert.equal(await readFile(resolve(testDir, 'AUTOMATION.md'), 'utf8'), inventory, 'AUTOMATION.md is stale; regenerate and review mappings')

const files = ['TEST_PLAN.md', 'TEST_CASES.md', 'BASELINE.md', 'AUTOMATION.md',
    ...(await readdir(resolve(testDir, 'cases'))).filter(f => f.endsWith('.md')).map(f => `cases/${f}`)]
const knownEvidence = new Set([...entries.map(e => e.id), 'T-CORE', 'T-REACT', 'T-LF', 'D-CORE', 'D-STORAGE', 'D-REACT', 'PKG', 'BUILD'])
const caseIds = new Set()
const usedEvidence = new Set()
let pending = 0
for (const file of files) {
    const path = resolve(testDir, file)
    const content = await readFile(path, 'utf8')
    assert.equal((content.match(/^```/gm) ?? []).length % 2, 0, `Unclosed code fence: ${file}`)
    for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
        const target = match[1].split('#')[0]
        if (!target || /^(https?:|mailto:)/.test(target)) continue
        await readFile(resolve(dirname(path), target))
    }
    if (!file.startsWith('cases/')) continue
    for (const line of content.split('\n')) {
        const match = /^\| ((?:CORE|STORE|REACT|UI|LOAD|PKG|QUAL)-\d{3}) \|/.exec(line)
        if (!match) continue
        assert.ok(!caseIds.has(match[1]), `Duplicate ID: ${match[1]}`)
        caseIds.add(match[1])
        const cells = line.split('|').slice(1, -1).map(v => v.trim())
        assert.equal(cells.length, 7, `Expected 7 columns: ${match[1]}`)
        assert.ok(cells.every(Boolean), `Empty cell: ${match[1]}`)
        assert.match(cells[1], /^P[012]$/)
        const evidence = cells[6]
        assert.match(evidence, /^(A|P|M):/)
        if (!evidence.startsWith('A:')) pending++
        for (const ref of evidence.slice(2).matchAll(/\b(?:[NXSBRFL]\d{2}|T-CORE|T-REACT|T-LF|D-CORE|D-STORAGE|D-REACT|PKG|BUILD)\b/g)) {
            assert.ok(knownEvidence.has(ref[0]), `Unknown evidence ${ref[0]} in ${match[1]}`)
            usedEvidence.add(ref[0])
        }
    }
}
const unused = entries.filter(e => !usedEvidence.has(e.id))
assert.deepEqual(unused.map(e => e.id), [], 'Existing automated tests lack a detailed-case mapping')
console.log(`Validated ${files.length} Markdown files, ${caseIds.size} detailed cases, ${entries.length} mapped automated tests; ${pending} cases need additional execution.`)
