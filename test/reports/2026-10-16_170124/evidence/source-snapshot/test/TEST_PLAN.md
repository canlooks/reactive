# @canlooks/reactive 完整测试计划

版本：1.0；编制日期：2026-10-16（Asia/Shanghai）；对象：`@canlooks/reactive@5.0.0` 当前工作区。

本计划面向测试人员、开发人员和发布负责人。交付包括测试范围、方法、环境、执行流程、逐项用例、需求追踪、验收标准及本次基线结果。它是发布测试方案；本次已执行的自动化检查不代表浏览器、压力与探索性测试已经完成。

## 1. 阅读与交付入口

1. 阅读本文件，确认测试范围、环境及发布门槛。
2. 按 [TEST_CASES.md](TEST_CASES.md) 准备夹具，并执行各模块用例。
3. 通过 [AUTOMATION.md](AUTOMATION.md) 找到每条用例对应的现有可执行测试；完整测试代码继续保留在本目录原有 `.ts/.tsx/.mjs/.cjs` 文件中。
4. 阅读 [BASELINE.md](BASELINE.md)，区分已经验证的结果与尚待执行的项目，按其中模板记录新一轮结果。
5. 提交前执行 `node test/validate-docs.mjs`，检查文档链接、用例编号及现有自动化到详细用例的映射。

本次新增的是可交付的计划、用例说明、自动化索引、验证记录与文档检查脚本；不将“设计了某用例”计为“新增了对应自动化实现”。

## 2. 项目功能与测试基线

### 2.1 功能定位

这是一个基于 JavaScript Proxy 的同步响应式状态库，核心没有运行时依赖。它按属性收集读取依赖，对写入和删除同步通知；支持惰性深层代理、计算值、自动 getter 缓存、类装饰器、同步批处理和监听。`storage` 在同一响应式状态上增加 JSON 持久化、恢复和异步写入调度。独立 React 入口把这些数据接入组件、局部片段、表单双向绑定及并发加载状态。

| 层次 | 公开能力 | 主要实现 | 核心风险 |
| --- | --- | --- | --- |
| 数据代理 | reactive、两种类装饰器 | [reactive.ts](../src/reactive.ts) | 身份不稳定、错误代理内建对象、属性/数组通知遗漏 |
| 同步调度 | effect、batch、watch | [effect.ts](../src/effect.ts)、[batch.ts](../src/batch.ts)、[watch.ts](../src/watch.ts) | 漏通知、重复通知、错误依赖、异常后队列损坏 |
| 派生值 | computed、对象/类/静态 getter | [computed.ts](../src/computed.ts) | 旧缓存、批次分支切换后订阅丢失 |
| 持久化 | storage、StorageAdapter | [storage.ts](../src/storage.ts)、[storageSnapshot.ts](../src/storageSnapshot.ts) | 覆盖本地修改、写乱序、半恢复、非法数据覆盖好记录 |
| React 观察 | RC/RFC/RCC、useReactive、useWatch、props | [React 入口](../src/react/index.ts)、[observer.ts](../src/react/observer.ts)、[props.ts](../src/react/props.ts)、[hooks.ts](../src/react/hooks.ts) | 未提交数据泄漏、额外渲染、StrictMode/卸载残留 |
| 表单与片段 | Chip 系列、Model、useModel、defineModel | [chip.ts](../src/react/chip.ts)、[model.ts](../src/react/model.ts)、[reference.ts](../src/reference.ts) | 写错对象、重复转换、回调顺序错误、旧事件仍生效 |
| 异步状态 | useLoading、loading 装饰器 | [loading.ts](../src/react/loading.ts)、[loadingDecorator.ts](../src/react/loadingDecorator.ts)、[classState.ts](../src/react/classState.ts) | 并发计数错误、异常丢失、卸载后发布、越界字段写入 |
| 发布 | ESM/CJS、Node 双入口、类型 | [package.json](../package.json)、[构建脚本](../scripts/build.mjs)、[打包检查](../scripts/test-package.mjs) | 双内核、声明错误、缺文件、意外引入必需依赖 |

### 2.2 依据与版本控制

- 功能依据：[README](../README.md)、[设计方案](../.agents/design.md)、[落地方案](../.agents/implementation.md) 的当前契约及源码。
- 当前 HEAD 为 `d0f7e04faa353b8572481067573f20e9d3f466ed`，但工作区存在未提交的 storage、React loading 等实现与文档变更。**测试对象是当前工作区，不是该提交的干净检出。**基线散列见 [source-sha256.json](evidence/source-sha256.json)。
- 落地方案第 13～17 节包含历史阶段记录，不能用旧的“五个核心 API”等历史描述验收当前版本；当前根入口为六个、React 子入口为十九个运行时导出。
- 若公开文档与行为冲突，先记录差异和最小复现，由维护者明确契约；不得将当前代码输出直接当作正确预期，也不自动修改断言使测试通过。
- 本计划未新增浏览器最低版本或性能 SLA 承诺。兼容矩阵中的浏览器版本、性能门槛是待执行/确认的测试策略，不是已证实的产品支持范围。

## 3. 范围和明确边界

### 3.1 必测范围

覆盖六个核心 API、十九个 React 导出及其别名、所有公共类型、所有公开入口。每个模块至少包括正常路径、等价类、边界值、非法输入、异常恢复、资源清理；对批次、props 提交、异步恢复及并发调用增加状态转换和交叉组合测试。

优先验证以下用户链路：

1. reactive → computed → effect/watch → batch → stop。
2. @reactive 类实例/静态方法 → 自动批次 → 异常结算 → 后续更新。
3. 外部 store/useReactive → RC/Chip → props/useWatch → Suspense/StrictMode → 卸载。
4. Model/defineModel → 转换 → 写入 → 原 onChange → watch → DOM/持久化。
5. useLoading 或 @loading → 并发成功/失败/乱序 → 断开与重连 → 独立新实例。
6. storage 同步/异步读取 → 本地编辑冲突 → 业务观察者连锁写入 → 串行持久化 → 重载。
7. 构建 → tarball → 无 React 核心消费者 → React 18/19 消费者 → ESM/CJS 混用与类型。

### 3.2 边界验收（不能反向要求未支持能力）

| 已声明边界 | 测试应验证或记录的事实 |
| --- | --- |
| raw 写入绕过代理；普通 effect 不追踪 in/Object.keys/for...in 结构 | 不能期待结构自动通知；storage 内部深层观察单独验收 |
| defineProperty/setPrototypeOf 无响应式通知承诺 | 仅核对 JS 行为/文档，不设计必须通知的通过标准 |
| Map/Set/Date/Promise/URL/Headers 等原样返回 | 内部变化不要求通知，替换容器属性须通知 |
| 核心 @reactive 不支持 ES #private、原生内部槽类 | 不作为支持性通过标准；React 类字段桥接保留原实例，#private 方法是另一条契约 |
| batch 不跨 await、不回滚写入；effect/watch 不提供自动清理回调 | 按同步段计数，返回函数不应被当成清理函数 |
| computed/getter 不比较派生结果、不自动解包、不深冻结结果 | 仅外壳只读；依赖净变化即通知，不能要求结果相等就跳过 |
| Model 只接收单个有效 element；不支持 file、Fragment、portal、任意控件协议 | 无效输入拒绝；radio group 需业务适配，单个布尔 radio 可用 |
| RC 不接收外部 memo/forwardRef/lazy、async 组件 | 应拒绝文档列出的非法包装；不测试 React 18 ref 自动转发 |
| RC/RCC 普通方法不自动 batch，不接管动态新增/删除字段或静态字段 | 与核心 @reactive 分开验收；组件 getter 不承诺自动缓存 |
| storage 只保存 JSON 数据投影，无 schema 校验/迁移 | 验证形状与数据范围；业务字段类型迁移由 adapter 负责 |
| storage 无 ready/flush/dispose、跨页同步、路径级合并、关页必达 | 不将这些列为缺陷；stopStorage 仅供现有白盒测试清理 |
| useLoading/@loading 无取消、超时、去重、只取最后结果 | 请求结果归调用方管理；卸载不取消已经启动的 Promise |
| GC 时机、React 调度次数并非固定 | 不以一次 GC 未回收或 StrictMode 多次 render 直接报错 |

## 4. 测试策略与方法

| 方法 | 实施方式 | 判定证据 |
| --- | --- | --- |
| 契约黑盒 | 经公开入口构建数据、执行操作 | 值、引用身份、属性存在性、DOM、回调参数、错误对象 |
| 等价类/边界值 | 缺省/undefined/null、NaN、±0、空字符串、symbol、孔洞、只读、MAX_SAFE_INTEGER | 每组输入独立执行，错误类型及无副作用断言 |
| 状态转换 | batch 嵌套/回退；storage reading/ready/inFlight/failed；加载 idle/active/disconnected | 时间序列、通知/读写次数、最终状态 |
| 决策表 | 有无缓存 × 同步/异步 × 有无本地净变化 × 读成功/失败 | 逐项比对 [存储用例](cases/storage.md) |
| 故障注入 | setter、source、callback、then getter、adapter、console.warn、React 生命周期抛错 | 原错误身份、多错误顺序、其他消费者继续、之后可恢复 |
| 集成/竞态 | 真实 React DOM + act + deferred；受控 Suspense 和 layout 窗口 | 只采纳已提交配置、不丢更新、不重复 own-props 通知 |
| 类型正反例 | tsc strict；.mts/.cts/.tsx；@ts-expect-error | 合法输入编译，非法输入确有诊断，未使用 expect-error 导致失败 |
| 安装包隔离 | npm pack 后装入临时消费者 | 包内容、可选依赖、跨格式内核共享、消费端类型 |
| 真实浏览器 | Chromium/Firefox/WebKit 的真实事件、Web Storage、刷新和 hydration | UI、浏览器日志、存储实际值、跨运行记录 |
| 模型/变形测试 | 固定种子操作序列与普通 JS 数据模型比较 | 净变化/终态/身份不变量；失败种子和最小操作序列 |
| 性能/资源 | 固定机器、预热、批次与非批次对比、挂载循环、堆快照 | 中位数/P95、次数、字节数、保留链；避免一次计时结论 |

现有自动化使用 Node `node:test` 与 `node:assert/strict`、tsx、jsdom 和真实 React DOM。不得把 jsdom 当成真实浏览器兼容性证明。不得用随机 sleep 代替对 Promise/提交边界的明确控制。

## 5. 环境与数据

### 5.1 环境矩阵

| 环境 | 配置 | 本计划要求 | 当前状态 |
| --- | --- | --- | --- |
| E1 开发基线 | Windows；Node 24；锁定 package-lock；React/React DOM 对齐 | 全部源码行为、源码类型、构建、产物检查 | 已执行，详见 BASELINE |
| E2 核心隔离消费者 | Node 24；ESM 和 CJS；types=[]、lib=ES2022；无 React/DOM/localforage | 六个核心 API、无浏览器全局读取、类型通过 | 已执行 |
| E3 React 18 | React/React DOM 18.3.1；匹配 @types major；Node 24/jsdom | 完整 React 行为、混合模块、类型 | 已执行 |
| E4 React 19 | 工作区 React/React DOM 19.3.0；匹配 @types major | 同 E3 | 已执行 |
| E5 真实浏览器 | 目标桌面 Chromium、Firefox、WebKit/Safari；记录确切版本/OS | UI、Storage、SSR/hydration、原生 ESM/实际构建工具消费 | 待执行；最低版本尚未声明 |
| E6 发布平台 | Linux Node 24；如产品面向 macOS 则追加；同一 tarball/锁文件 | npm test、build、test:dist、test:package | 待执行 |
| E7 资源基准 | 固定 CPU/RAM/电源模式；Node 24；性能组禁用 StrictMode | 压力、性能、长时资源回收 | 待执行 |

运行时需具备 ES2022、Proxy、Reflect、WeakMap、WeakRef、FinalizationRegistry、AggregateError。React 测试必须配对 react 与 react-dom 版本。当前隔离脚本的 `@types/react@18/19` 按 major 安装，复测须记录实际解析版本或归档消费者 lock，避免把依赖漂移误判成代码回归。

### 5.2 准备

在项目根目录执行；干净检出使用 `npm ci`。已安装依赖的当前工作区无需为本次文档交付重新安装。`npm ci` 会重建 node_modules，应在独立测试环境执行。`test:package` 需要 npm registry 网络，临时消费者安装使用 `--ignore-scripts`，失败时保留临时路径供排查，不发布 npm 包。

```powershell
node --version
npm --version
git rev-parse HEAD
git status --short
npm ci
```

夹具、清理和断言规则见 [TEST_CASES.md](TEST_CASES.md)。浏览器测试使用专用 origin 和 `qa:<run>:<case>` key，只清理该轮创建的数据；不得清空用户已有站点存储。业务测试数据包含中文、emoji、换行、空字符串、数组孔洞及 JSON 不支持值。

## 6. 执行流程与命令

| 阶段 | 操作/命令 | 成功条件 | 失败处理 |
| --- | --- | --- | --- |
| 0 基线冻结 | 记录 HEAD、dirty diff、依赖版本、源散列、环境 | 明确唯一被测版本 | 不混用不同工作区结果 |
| 1 核心 | `npm run test:node` | 现有 105 项无失败、取消、跳过 | 最小化失败用例；阻断下游发布结论 |
| 2 React | `npm run test:react` | 现有 76 项无失败、取消、跳过 | 检查 act、真实异常与非预期 warning |
| 3 源码类型 | `npm run typecheck`、`npm run typecheck:test`、`npm run typecheck:react` | 全部退出码 0 | 报告具体配置/诊断 |
| 1～3 快捷入口 | `npm test` | 顺序执行上述五项成功 | 不必无理由重复单项 |
| 4 构建 | `npm run build` | ESM/CJS/声明/Node 桥接齐全 | 构建会重建生成目录 dist |
| 5 产物 | `npm run test:dist` | ESM/CJS、双方向混用、原生 ESM、消费端类型通过 | 先确认 dist 对应当前源码 |
| 6 包内容 | `npm pack --dry-run` | 仅预期发布文件；prepack 成功 | 可由下一行脚本内 dry-run 等价覆盖 |
| 7 实际安装 | `npm run test:package` | 无 React 核心、React 18/19 隔离消费者均通过 | 留存失败临时目录，禁止以仓库 node_modules 替代隔离结果 |
| 8 补充测试 | 逐条执行证据为 P/M 的用例 | 每行、每环境都有实际结果 | 不把相关自动化通过等同补充场景通过 |
| 9 交付检查 | `node test/validate-docs.mjs` | 链接、编号和映射校验通过 | 修正文档；该命令不验证库行为 |

如需筛选单例，先在 [自动化索引](AUTOMATION.md) 找到英文原始标题，再执行本地已安装的 tsx；引号内使用能唯一匹配标题的正则：

```powershell
& .\node_modules\.bin\tsx.cmd --tsconfig tsconfig.test.json --test --test-name-pattern='^storage serializes async writes' test/test.ts
& .\node_modules\.bin\tsx.cmd --tsconfig tsconfig.react-test.json --test --test-name-pattern='^loading registers tokens' test/react.tsx
```

其他平台使用 `./node_modules/.bin/tsx`。单例筛选只执行匹配项，未匹配项可能不显示或列为跳过，只用于定位；发布验收必须跑完整入口。单独执行核心/React 套件会通过 import 带上其他文件，不能将这些文件再次单跑后的数量重复累加。

## 7. 优先级、准入与退出

### 7.1 用例与缺陷等级

用例 P0：状态正确性、数据丢失/污染、核心读写、主要组件链路、竞态、发布可用性；P1：边界、异常、生命周期、类型、兼容性；P2：补充平台、文档、性能观察和探索。缺陷等级单独记录：S0 为数据破坏/原型污染/关键包不可用，S1 为公开契约失效/漏更新/崩溃/泄漏，S2 为局部受限场景或可绕过异常，S3 为文字/易用性问题。

### 7.2 准入

- 代码及 README/设计契约可定位，测试依赖安装完成，环境满足运行时要求。
- 本次变更范围、支持环境及浏览器矩阵有记录；测试账号/专用 origin/数据隔离已准备。
- 基础构建和核心冒烟可运行；环境阻塞与产品缺陷分开登记。

### 7.3 发布退出标准

1. 选定发布范围内的 P0、P1 用例及其参数子项、必测环境全部通过；未执行、阻塞和跳过均不计通过。P2 全部执行，未通过项由测试与维护者书面确认风险和跟踪单。
2. `npm test`、`npm run build`、`npm run test:dist`、`npm run test:package` 均退出码 0；行为测试失败/取消为 0，完整套件意外跳过为 0，类型检查无误，关键正反类型约束仍有效。
3. 根六个及 React 十九个导出准确；没有公开内部帮助函数或恢复已移除 API；Node import/require 共用状态；无 React/localforage 的核心消费成功。
4. 净变化通知次数、旧值、计算缓存、错误保真符合各用例；持久化最终 JSON 正确，不发生迟到读取覆盖本地编辑、并行乱序写、非法缓存半恢复。
5. React 最终 DOM 正确；受控无 StrictMode 场景无 own-props 额外渲染；未提交候选不污染已提交数据；卸载后无库创建的遗留订阅/回调/加载发布。
6. 支持环境的真实浏览器用例通过；没有非预期 uncaught exception、unhandled rejection、React hydration/controlled warning。预期故障注入日志须与用例一一对应，不能通过屏蔽全部 console 判通过。
7. 未关闭 S0/S1 缺陷为 0；S2/S3 有处置记录。需求—用例—自动化/人工结果可追溯；本次不以“181 项通过”替代尚未执行的 P/M 场景。
8. 性能与资源标准按 [质量用例](cases/quality.md) 执行；首次基准须记录，不凭没有约定的绝对毫秒值阻断发布。明确出现无界队列、重复订阅或无限重试按功能缺陷处理。

**当前结论仅为自动化基线通过。**浏览器、跨 OS、实际 IndexedDB、性能及补充参数用例仍需测试人员执行后，才能出具完整发布验收结论。

## 8. 回归选择与维护

| 变更区域 | 最低回归范围 |
| --- | --- |
| effect/reactive/computed/batch/watch | 所有核心 + storage + 全部 React + 类型 + dist + package |
| storage/storageSnapshot | storage、核心通知/批次、React 外部 store、类型、双模块和包级 |
| observer/props/commit/hooks | 全部 React、核心 computed 分支/通知内重入、dist/package |
| model/reference/chip | UI、React 提交/Suspense、类字段与 loading 写保护、类型/package |
| classState/classComponent/loading | 类字段、useLoading/@loading、Model、props/生命周期、18/19 与类型 |
| exports/build/类型/依赖 | 源码类型、dist、完整 tarball 消费、无 DOM/React 核心 |
| 文档用例本身 | 文档校验；涉及预期改变时先核对契约并执行对应行为回归 |

测试人员负责数据、环境、人工补充执行和报告；开发负责确定契约、修复及自动化扩充；发布负责人核对退出标准与风险处置。按“环境准备 → 核心 → React/存储 → 类型/包 → 浏览器/质量 → 缺陷复测 → 签收”执行，不设缺乏依据的固定完成日期。

覆盖报告分别统计需求覆盖、用例执行率、通过率和自动化映射；本次未采集行/分支覆盖率。后续可采集 V8/兼容覆盖工具结果，但覆盖率不替代行为断言。失败重跑需保留首次失败证据，不能以多次运行中的一次成功覆盖不稳定问题。
