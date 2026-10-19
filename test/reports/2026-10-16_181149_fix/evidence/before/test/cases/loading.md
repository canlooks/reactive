# 异步加载状态测试用例

使用 [夹具 F2/F3/F4](../TEST_CASES.md)，运行 `npm run test:react`。调用返回值统一按Promise处理并捕获拒绝。任务完成顺序由deferred控制；使用快照数组核对每次计数变化，不能只看最终false。

## 1. useLoading

| 用例 | 优先级 | 目标 | 前置/数据 | 步骤 | 预期/验收 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| LOAD-001 | P0 | 所有初值及乱序计数 | initial分别省略/false/true/0/2；两个deferred | 挂载不调用；load0、load1；先完成1再失败0 | 不自动执行业务；stacks 0→1→2→1→0；数字loading=n+stacks；布尔最后false，初始true未调用前仍true | A: F03 |
| LOAD-002 | P1 | 返回对象/load稳定与初值不重置 | 同一挂载、保存对象与解构load | 开始两任务；父重渲染initial=99；完成 | 对象/load严格同引用；不重置计数或模式；解构load不需要this | A: F03 |
| LOAD-003 | P0 | 普通值/Promise/thenable与只读外壳 | fn分别返回普通值、Promise、thenable | 提交后调用load；检查返回与Reflect.set loading/stacksCount | 始终Promise<Awaited<R>>，值正确；外壳只读；不承诺原Promise身份 | A: F04 |
| LOAD-004 | P0 | 业务同步/异步/then访问失败 | fn同步抛E、Promise.reject(E)、then getter抛E | 逐项load并等待reject；随后成功调用 | 单错误原对象；每次只释放本token；最终false/0，之后可成功，不永久loading | A: F04 |
| LOAD-005 | P0 | 开始/业务/结束多错误 | 订阅者分别开始抛E1、结束抛E3；业务抛E2 | load并捕获；关闭故障再调用 | 业务仍启动；finally释放；AggregateError.errors=[E1,E2,E3]，无错误丢失；下次成功 | A: F05 |
| LOAD-006 | P0 | immediate/props watch可用句柄与最新函数 | 组件先声明useWatch，随后useModel/useLoading；fn捕获label | 首次immediate执行；props count/label更新 | setup前句柄已激活；首次A1!、下一次B2!；旧load引用使用最新已提交fn；Model同步可写 | A: F06 |
| LOAD-007 | P0 | 候选闭包隔离与在途固定 | A提交后load1；B候选挂起；再load2；C成功提交后load3 | 统一释放等待Promise | 结果依次A1/A2/C3；B不泄漏；在途1不因C改用新函数；计数归零 | A: F07 |
| LOAD-008 | P0 | 卸载停止发布/保留调用结果/新挂载独立 | numeric baseline2；一个在途请求，保存旧对象 | 卸载；调用遗留load；新挂载；完成旧请求42 | 遗留调用拒绝且fn不启动；旧请求仍返回42；旧公开值冻结在断开时快照，新实例仍2/0，无跨实例发布 | A: F08 |
| LOAD-009 | P0 | StrictMode重连、SSR和双Hook隔离 | 两个Hook，a初始true；layout只启动一次；SSR纯render | SSR；StrictMode挂载/清理/重连；完成a | SSR业务调用0；重连不重复业务；a计数恢复真实未完成数，b不受影响；清理窗口调用拒绝 | A: F09 |
| LOAD-010 | P1 | 内部记账/业务读不泄漏依赖 | 外层effect只显式读trigger并调用load；fn读other | 完成；other++；trigger++ | other和loading内部发布不使外层重复执行；trigger变化才新调用 | A: F10 |
| LOAD-011 | P0 | Suspense隐藏期间结算与恢复 | baseline2、任务未完；已挂载树同步挂起隐藏 | 隐藏后调用load；完成旧任务；恢复同树 | 隐藏期间新调用拒绝；旧请求完成但公开计数不发布；重连刷新为2/0，不保留假请求 | A: F11 |
| LOAD-012 | P0 | commit失败统一断开句柄 | Model/loading创建后immediate useWatch抛E，ErrorBoundary兜底 | 挂载失败；调用遗留model.onChange与load | Model无写入；load拒绝且业务调用0；不依赖后续尚未安装的React cleanup | A: F12 |
| LOAD-013 | P0 | props/Strict Chip/Model/load提交链 | props.count切到2；watch调用load(value×已提交count)并写name | 更新props，等待请求，再输入Model | load结果4，Strict Chip显示2:false，input=2；own-props确认不吞子更新，后续输入3写回 | A: F13 |
| LOAD-014 | P1 | 非法初值/回调及首次提交前 | initial=-1/小数/NaN/±Infinity/超安全整数，fn非函数；首次render保存load后挂起；另仅挂载MAX_SAFE_INTEGER不启动任务 | 参数各独立SSR/挂载；调用未提交load；检查业务次数 | 非法参数TypeError；首次提交前拒绝、不启动fn；最大安全整数作为初值可接受；不将未约定的累计溢出行为写成保证 | P: F04、F09；补充非函数、-Infinity、未提交保留句柄及最大合法初值 |

load应由事件、已提交effect或业务回调调用。对已经提交组件在render中主动调用load属于不支持用法，不把所有这类调用都能被运行时识别/拒绝作为验收承诺。

## 2. @loading(source)

| 用例 | 优先级 | 目标 | 前置/数据 | 步骤 | 预期/验收 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| LOAD-015 | P0 | 导出边界 | React子入口与根入口 | 检查loading导出；类型层从根尝试导入 | 仅React入口有loading；根入口不泄漏；十九个React导出准确 | A: L02、D-REACT、T-REACT |
| LOAD-016 | P0 | 布尔/数字字段基线 | RC类busy初值false/true/0/3，原型async方法 | 提交后调用/等待；记录方法同步部分看到的busy | 开始即见true或n+1；结束布尔false、数字回n；未调用的true保留；不额外返回Hook状态对象 | A: L06 |
| LOAD-017 | P0 | 同字段多方法/互调共享token | 方法fetch和other共用busy；other调用fetch | 同时直接fetch0及other1；先完成1后0 | other及内层fetch各登记token，总并发3；完成1释放其两层，仍保留0的token；最后回基线 | A: L06 |
| LOAD-018 | P1 | 动态this、参数和结果 | 方法含必填/默认/rest参数 | instance.method、call、bind；另解构后无receiver调用 | this为原实例，参数/成功值保留；无receiver拒绝，不自动bind；返回Promise不要求身份相同 | A: L06、T-REACT |
| LOAD-019 | P0 | 每次选择一次并固定字段 | selector由闭包选择left或right且计次 | 调用A选择left；切选择right开始B；乱序完成 | 每次source仅1次，完成时不重选；各自归还原字段token，不因闭包变化串字段 | A: L07 |
| LOAD-020 | P1 | 继承、多实例与Hook隔离 | 父类装饰方法，子类super，两个实例和独立useLoading | 启动并交错完成三任务 | 实例/字段/Hook计数互相独立；继承结果与this保留 | A: L07 |
| LOAD-021 | P0 | JS返回值、thenable、错误聚合 | 运行时桥接普通值/thenable/同步抛/拒绝/then getter；状态订阅抛 | 逐项调用；开始+业务+结束同时失败；再恢复 | 普通值/thenable按await；每token释放；单E原样；多错按开始/业务/结束顺序；业务不被开始发布失败阻断 | A: L08 |
| LOAD-022 | P0 | selector拒绝非法定位/变更 | 常量、缺字段、取反、多次/多字段读、nested、getter、readonly、props/state、调用方法；set/delete/define/枚举等 | 每项独立调用装饰方法，记录业务次数/字段 | 可识别非法表达式TypeError且业务0次；临时ctx只读；不把ctx当业务this；字段保持初值 | A: L09 |
| LOAD-023 | P1 | selector异常与追踪上下文恢复 | source读后抛E；外部effect/Model引用捕获中调用；字段之后被重定义 | 修复selector合法调用；改旁路字段；重定义被管理字段再调用 | source E保真；合法调用恢复；内部/业务同步读不污染外层依赖或引用；重定义字段被拒绝 | A: L09 |
| LOAD-024 | P0 | 非法数字、容量溢出及首次失败不锁模式 | initial=NaN/Infinity/-1/0.5/MAX_SAFE_INTEGER；另MAX_SAFE_INTEGER-1 | 分别调用；非法首次后改0重试；边界已占一token再启动第二个 | 非法值TypeError/容量RangeError在业务前；无token泄漏；修复可调用；再启动会溢出时拒绝且原请求计数不变 | A: L10 |
| LOAD-025 | P0 | 活动字段写保护 | stack请求在途；持有实例与Model handler | 直接赋0、Model赋0、引用write0；同值写；模式改布尔 | 不同值/模式在修改前抛错；业务原token不受影响；同值写安全，不追加通知 | A: L10 |
| LOAD-026 | P1 | 空闲基线调整与模式固定 | 首组完成后stack为数字基线 | 空闲改5并发下一组；再写负数或布尔；布尔组对照 | 下一组从5计数并回5；非法值/跨模式拒绝；未被loading使用的普通字段不加此限制 | A: L10 |
| LOAD-027 | P0 | 通知回调重入与部分失败 | watch stack==1时发第二请求 | 启动第一；第二失败；第一成功 | token先登记再发布，观察序列0→1→2→1→0；第二失败不释放第一；无重复减计数 | A: L11 |
| LOAD-028 | P1 | props/React原生状态并存 | PureComponent，state/context/refs，busy字段与props watch | 更新props及state/context；加载开始/结束 | props正常一次更新；原生机制正常；loading变化仍可刷新，不被去重/SCU屏蔽 | A: L12 |
| LOAD-029 | P0 | componentDidMount可启动及StrictMode重连 | 用户didMount中有防重复条件；子layout改count | StrictMode挂载/断开/重连；完成任务 | didMount调用合法；库不重复业务；字段窗口变化补齐；任务与普通字段后续都响应 | A: L13 |
| LOAD-030 | P0 | 隐藏树保留活动集合与空闲调整 | 数字基线2；三个分支：隐藏时仍active、已settled、settled后手改5 | 隐藏后尝试新调用；按分支完成/调整；恢复同实例 | 隐藏不发布或forceUpdate，新调用拒绝；恢复分别显示3/2/5；不会重新执行业务；最终基线正确 | A: L14 |
| LOAD-031 | P0 | 卸载与新实例隔离 | 旧实例请求在途，外部watch旧busy | 卸载；旧实例再调用；新挂载；完成旧请求 | 旧调用拒绝；旧请求仍兑现；不发布旧busy结束值、不更新新实例；新实例初值false | A: L15 |
| LOAD-032 | P0 | 构造/render/首次未提交/SSR禁调用 | 装饰方法业务次数计数；构造和render中尝试；SSR/hydration/首次Suspense | 所有拒绝Promise由测试捕获；正常提交后合法事件调用对照 | 拒绝无业务调用、无假loading；SSR保留初值；识别到render上下文时拒绝；合法提交后可用 | P: L16；禁止阶段已覆盖，补充同一实例合法事件恢复对照 |
| LOAD-033 | P0 | 挂载/提交失败和卸载抛错先断开 | didMount启动请求后抛E，willUnmount也抛；forceUpdate计数 | ErrorBoundary处理；旧实例改count、调用run、完成在途 | 观察/连接已同步释放；旧run拒绝；完成不发布/forceUpdate；用户清理异常不留下库订阅 | A: L17 |
| LOAD-034 | P1 | 装饰目标/传统语法校验 | static/getter/arrow/render/lifecycle/constructor、重复装饰、Stage3、未RC类 | 应用装饰器或调用方法 | 不支持目标TypeError，重复/Stage3明确失败；未包装类调用拒绝；普通业务原型方法合法 | A: L18、T-REACT |
| LOAD-035 | P1 | symbol/空字符串字段与props监听 | RCC类symbol布尔字段和空键数字2；props watch启动两任务 | props count1→2；观察字段/forceUpdate/结果；完成 | symbol/空键均可定位；已提交props回调可启动；自身props不额外通知，加载字段必要更新保留 | A: L19 |

数字安全边界的严格容量检查是 `@loading` 的明确实现契约，不从它推导 useLoading 同样有活动累计上限检查。selector不能使用派生计算；某些同值表达式无法被可靠识别，测试不要求库拒绝所有 `ctx.stack + 0` 之类表达式。
