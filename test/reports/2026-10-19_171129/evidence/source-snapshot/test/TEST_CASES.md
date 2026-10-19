# 测试用例执行入口与需求追踪

适用版本、环境、准入/退出标准见 [测试计划](TEST_PLAN.md)。本目录提供完整的详细用例与现有测试代码定位；[自动化索引](AUTOMATION.md) 可按证据编号查找英文测试标题、源码行号及执行命令。

## 1. 用例清单

| 文件 | 内容 | 编号前缀 |
| --- | --- | --- |
| [核心用例](cases/core.md) | reactive、effect、computed/getter、batch、watch、数组、类、异常及异步边界 | CORE |
| [持久化用例](cases/storage.md) | 恢复、数据范围、观察、异步冲突、串行写入、错误、浏览器后端 | STORE |
| [React 基础用例](cases/react.md) | 组件、props、Hooks、类字段、提交、Suspense、StrictMode、SSR | REACT |
| [片段与表单用例](cases/ui.md) | Chip 全系列、useModel、Model、defineModel、引用定位 | UI |
| [加载状态用例](cases/loading.md) | useLoading、@loading 的模式、并发、异常、生命周期、字段保护 | LOAD |
| [类型与发布用例](cases/package.md) | 声明、正反类型、导出、ESM/CJS、真实 tarball、README 示例 | PKG |
| [兼容性与质量用例](cases/quality.md) | 真实浏览器、IndexedDB、跨平台、性能、资源、随机序列、场景链路 | QUAL |

所有用例均有编号、优先级、目标、前置/数据、步骤、可观察预期及证据。每行列出的参数须逐项执行；同一行任一参数失败，该行不能判为通过。执行结果及缺陷编号另填 [基线/执行记录](BASELINE.md) 的模板，不写入预期列。

证据列含义：

- `A: 编号`：已有自动化直接覆盖本行主要断言；本次完整套件实测结果见 BASELINE。既有测试内的所有断言继续有效，不以此表的简述删减测试。
- `P: 编号；补充…`：已有相关自动化，但本行增加的参数、环境或断言尚未完整验证，必须补充执行，不计为整行已通过。
- `M: 方法`：设计用例，当前无直接自动化；按本行步骤人工或新增脚本执行并留证。

`A` 不是“所有浏览器已通过”，也不是代码覆盖率。N/X/S/B/R/F/L 是现有 node:test 编号；T/D/PKG/BUILD 是类型、产物与包级证据，均可在 AUTOMATION.md 查到。内部白盒用例不代表内部函数属于公共 API。

## 2. 公共夹具与断言规则

### F0：核心状态与计数器

每行新建数据，不在不同用例间共用 root。默认 `state = reactive({count:1, flag:true, a:1, b:10, child:{n:1}, list:[1,2,3]})`。`seen` 存回调值/元组，`runs` 记录函数次数，`writes` 存 `[key, JSON字符串]`，`getCalls` 记录计算次数。

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reactive, effect, computed, batch, watch } from '../src/index.js'

test('示例：净变化只通知最终值', t => {
    const state = reactive({ count: 1 })
    const seen: number[] = []
    const stop = effect(() => { seen.push(state.count) })
    t.after(stop)
    batch(() => { state.count = 2; state.count = 3 })
    assert.deepEqual(seen, [1, 3])
    batch(() => { state.count = 4; state.count = 3 })
    assert.deepEqual(seen, [1, 3])
})
```

示例按 `test/` 下 `.ts` 路径书写；现有核心文件是 `test.ts`，补充脚本可按计划中的 tsx 方式执行。核心计数包含 effect 首次执行；watch 默认不含初次 callback。比引用用 `assert.equal`，比 ±0/NaN 用 `Object.is`，比属性存在性用 `Object.hasOwn`，不得仅以打印输出判定。

### F1：同步存储适配器

复用 [storage.ts 测试文件](storage.ts) 中的 `memory`/`persisted` 模式：Map 保存字符串或缺失 null；独立记录 get/set 次数、key、字符串、this。缓存预置使用 JSON 原始字符串，不能把 JS 对象误传给 adapter。每用例使用新 adapter；相同 key 的冲突用例才共用对象。`stopStorage` 只能从内部源码用于测试清理，不是使用者可调用的公开销毁 API。

默认有效缓存 `{"count":8,"profile":{"theme":"dark"}}`；初值 `{count:1, enabled:true, profile:{theme:'light', size:10}}`。恢复时预期保留 enabled，替换整个 profile，size 消失；纯恢复 set 次数为 0。

### F2：受控异步/故障注入

```ts
function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail })
    return { promise, resolve, reject }
}
const turn = () => new Promise<void>(resolve => setImmediate(resolve))
```

为每次 get/set/load 分配独立 deferred，由用例明确 resolve/reject；调用后先断言“未完成”状态，再完成、等待一个队列边界、断言结果。对拒绝先建立 `assert.rejects`/catch 再 reject，避免制造测试自身的未处理拒绝。记录 `activeWrites/maxActiveWrites`；同绑定 `maxActiveWrites` 必须为 1。浏览器可等待由 adapter 暴露的完成 Promise；库本身没有 ready/flush。

故障对象 `const E = new Error('case-id')` 用严格引用比较；多错误比较 `AggregateError.errors` 的顺序。同步 throw、异步 reject、then getter throw、thenable 重复 resolve/reject 分开覆盖。console mock 只在目标用例内有效，结束必须恢复。

### F3：React/DOM

复用 [dom.ts](dom.ts)、[react.tsx](react.tsx)、[react-features.tsx](react-features.tsx)、[react-loading.tsx](react-loading.tsx) 的 mounted/act 模式。先初始化 jsdom globals，再加载 react-dom/client；每例 createRoot，所有 React 操作经 `await act(...)`，finally 中 unmount 并移除容器。SSR 使用无 window 的服务端渲染环境并在 finally 恢复 globals。

需要精确渲染次数时：关闭 StrictMode，使用单一 root、无其他 state/context 更新，初次提交后清零增量，再测一次 props/store 操作。StrictMode 用例只断言最终 DOM、有效回调次数、清理及重连，不要求固定 render 次数。

输入测试按现有 `inputValue` helper 调用原生 value setter 并派发 input/change；checkbox/radio 用 click；select 更新 selected 并派发 change。不要仅调用假的 onChange 代替所有真实事件用例。Suspense 使用可控 Promise 和 `startTransition` 保留旧提交，分别验证候选未提交与成功提交后的行为。

### F4：类与加载状态

核心类测试：有构造参数、实例/静态字段、getter、原型方法、继承/super、符号方法，分别采用 `@reactive`、`@reactive()`、`reactive(Class)`。React 类测试：继承 Component/PureComponent，经 RC/RCC 包装，保留 ref 供测试字段；在 componentDidMount 之后启动任务。

加载模式表：布尔 false→有请求 true→全部完成 false；初始 true 在未调用前为 true，完成首组后为 false；数字基线 n→n+未完成数→n。useLoading 的 stacksCount 初始始终 0；@loading 不额外返回 stacksCount。普通返回/thenable 的运行时验证使用 JS 或明确的运行时调用桥接，不删除 TypeScript 对装饰器同步方法的负例。

### F5：安装/浏览器/资源

安装包测试经 `npm run test:package` 创建独立临时目录，禁用 NODE_PATH 外溢；失败保留日志与临时路径。真实浏览器用独立测试页面和专用同源 Storage key；浏览器版本、OS、React 版本、bundle 模式记入记录。性能每组预热 3 次，至少测量 10 次，记录中位数/P95和输入规模；先比较同机同配置上一个已接受版本。

所有用例结束后 stop effect/watch、unmount root、完成或取消测试自己的 deferred、关闭 jsdom、恢复 globals/console。存储测试仅删除专用测试 key；清理失败也必须登记。不得依赖按时间触发的 FinalizationRegistry 来判功能通过。

## 3. 需求—实现—用例矩阵

| 需求来源 | 功能 | 用例位置 | 自动化层 |
| --- | --- | --- | --- |
| design 2.1；README reactive/数组 | 代理、深层、数组、类装饰器 | CORE-004～006、031～052、068～071 | N、X、D-CORE |
| design 2.2 | effect/依赖/清理 | CORE-001～003、009～014、055、061 | N |
| design 2.3 | computed/getter | CORE-015～032、059～060、068～069 | N、X、T-CORE |
| design 2.4 | 净变化、同步/异步、方法批次 | CORE-007～014、018～025、038～045、051～058 | N |
| design 2.5 | watch | CORE-062～067、072 | N、T-CORE |
| design 3.1 | RC/RFC/RCC、memo、类字段 | REACT-001～002、016～018、025～035 | R、L、F22、T-REACT |
| design 3.2 | useReactive/useWatch | REACT-008、019～024、028～029 | R、T-REACT |
| design 3.3 | 响应式 props/提交 | REACT-003～015、026～027；LOAD-006；UI-006、015 | R、F、L19 |
| design 3.4 | Chip/Strict/Async/工厂 | UI-001～009 | F23～F29、D-REACT |
| design 3.5 | Model/useModel/defineModel | UI-010～026 | X02～X04、F14～F21、T-REACT |
| design 3.6 | useLoading | LOAD-001～014 | F03～F13、T-REACT |
| design 3.7 | loading/类字段生命周期 | LOAD-015～035；REACT-030～035 | L、T-REACT |
| design 4.1 | localStorage/sessionStorage | STORE-001～010、029～034；QUAL-001～003 | S、B、F01～F02 |
| design 4.2 | 自定义 adapter、竞态、数据范围 | STORE-011～028、035～040 | S、D-STORAGE、T-LF |
| README 安装/类型/开发验证 | 包与类型/版本兼容 | PKG-001～016 | T、D、BUILD、PKG |
| implementation 生命周期/性能/边界 | 泄漏、压力、安全、真实环境、端到端 | QUAL-001～016 | 现有部分回归 + 待执行补充 |

此矩阵表示需求已纳入测试设计。详细执行率以逐行实际记录为准，不能由矩阵直接得出全部通过。
