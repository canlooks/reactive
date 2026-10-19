# D01 / D02 / D03 最小修复方案

日期：2026-10-16（Asia/Shanghai）  
依据：[原测试报告](report.md)，尤其是第 8 节的缺陷与修复建议。  
状态：待实施。本次只交付方案，没有修改生产源码、既有测试或历史测试证据。

## 1. 修复决策与范围

按 **D02 → D01 → D03** 实施，分别验证后再做一次合并回归。D03 已按本次要求确定为严格参数契约，不再保留“允许 null”的备选方案。

| 缺陷 | 修复目标 | 最小生产代码范围 |
| --- | --- | --- |
| D02：弃用 computed / 自动 getter 被源保留 | 无活动消费者的派生节点可回收；活动 effect/watch/React 订阅及仍持有的计算值保持有效 | src/effect.ts；src/react/props.ts 的订阅存在性判断 |
| D01：跨 realm 普通对象漏更新 | 外部 realm 的普通对象可以代理、通知，并被 storage 按普通数据处理 | src/reactive.ts；src/storageSnapshot.ts |
| D03：valueProp=null 被默认化 | 只接受省略、undefined、'value'、'checked'；其他值抛 TypeError | src/react/model.ts |

预计修改 **5 个生产文件**。继续复用现有 computed、getter 缓存、storage 控制器及 React 提交流程；内部辅助函数不从两个公共入口导出。无需新增运行时依赖、修改构建目标、增加公共 API 或扩大发布文件集合。

本轮不引入 computed.dispose/scope、不调整批次调度、不按计算结果相等过滤通知、不增加 Map/Set 内部响应式、不改 storage 冲突/排队策略、不优化报告中的大对象快照扫描，也不顺带重构 loading 或 Model 事件转换。QUAL-001 原生 IME/剪贴板与 QUAL-016 独立人工验收仍是原有验收事项，不作为代码修改范围。

“避免引入新 BUG”通过下文的所有权约束、对照用例和发布门槛落实；仅有方案或局部试验通过，不能宣称已经证明修复完成。

## 2. 当前源码复核

本次核对 [source-sha256.json](evidence/source-sha256.json) 中的 78 份文件，均与当前工作区一致。报告分析适用于当前代码，而不仅是 HEAD 提交；实施时须保留已有工作区修改，不能用重置仓库的方式建立修复基线。

直接导入当前源码，在独立进程做了不落盘的最小复核：

| 检查 | 本次结果 |
| --- | --- |
| D01：Node vm 普通对象 | reactive(raw) === raw，写入后 effect 序列仍为 [0] |
| D01：同一对象传入 storage | 抛 TypeError：storage expects a plain object or array |
| D02：100 个临时 computed 载荷及 100 个 getter 根，跨 12 轮事件循环 GC | 源保留时两组各存活 100；释放源后两组均为 0 |
| D03：valueProp 参数 | undefined、null、'value'、'checked' 被接受；空字符串、'foo'、1 被拒绝 |

另做了两组仅在内存中变换模块的方案试验，没有写回源码：

- **仅将 computed 订阅弱引用化**：弃用载荷可回收，但仅消费 computed、未保存 disposer 的活动 effect 在 GC 后漏更新。该方案不可采用。
- **弱订阅加活动消费者保活**：弃用 computed/getter 回收、effect/watch 持续更新、仍持有计算值的惰性缓存、stop 后回收、批次分支恢复及整组源释放对照通过。

外部 Object.prototype 的描述符判定也做了 10 组 Node 本地/跨 realm 输入试验，含普通对象、数组、null 原型、用户类、内建类、伪装构造器和 constructor 访问器；结果符合预期，访问器调用数为 0。这些是设计可行性检查，不替代正式类型检查、完整用例和浏览器回归。

## 3. D02：只改变派生订阅的所有权

### 3.1 根因及必须保留的行为

当前 [effect.ts](../../../src/effect.ts) 的 Dep 为 Set<EffectNode>，trackDep 把 computed 的节点强引用加入源属性的 Dep。节点的 fn 持有业务闭包；[reactive.ts](../../../src/reactive.ts) 的 readGetter 闭包还持有 receiver。因此只要源仍可达，临时派生对象和载荷就无法释放。

将 source → computed 这一边改为弱引用是必要条件，但单独这样改会破坏下面的已有行为：

```ts
function subscribe() {
    const doubled = computed(() => source.n * 2)
    effect(() => seen.push(doubled.value))
    // 用户没有保存返回的 stop，也没有把 doubled 暴露出去。
}
subscribe()
// 跨事件循环 GC 后，source.n++ 仍必须通知这个 effect。
```

如果没有活动消费者的保活路径，source 仅弱引用 computed，computed 与 effect 的相互引用会形成一个可以整体回收的孤立环。不能通过要求用户额外保存 stop 或 computed 来绕过。

修复应满足以下所有权规则：

| 情形 | 所有权与预期 |
| --- | --- |
| 临时 computed/getter 无活动普通消费者 | 源只弱引用派生节点，源存活不阻止派生节点回收 |
| 业务仍持有 computed 外壳或 getter receiver | 外壳闭包 / getterCache 保有节点；源变化仍使缓存失效，但不主动求值 |
| 存在活动 effect、watch 或 React notify 节点 | 沿其依赖的 computed 链保活派生节点；即使没有外部 disposer 引用，也持续通知 |
| 最后一个活动普通消费者停止、换分支或卸载 | 撤销该消费者引起的保活；业务仍持有的计算值仍正常惰性失效 |
| 仅保留下游 computed 或 React 读取快照 | 下游 deps / ReadVersions 的 Dep 键，经 computedOwners 保有上游节点 |
| 源、外壳、消费者外部引用全部释放 | 整个图仍可回收，不能因全局强引用表或 finalizer holding 而存活 |

这里“活动普通消费者”专指 active 且没有 computed 标记的 EffectNode。不能把任意存活 computed、非空消费者集合或临时渲染快照直接当作需要永久强订阅的证据。

### 3.2 依赖条目：保持 Set 身份与插入顺序

在 effect.ts 内部把依赖条目区分为普通节点和派生条目：

```ts
interface DerivedLink {
    reference: WeakRef<EffectNode>
    retained?: EffectNode
}
type Dep = Set<EffectNode | DerivedLink>
```

普通 effect/watch/notify/storage 节点继续作为 EffectNode 强存储。只有 node.computed 存在时使用 DerivedLink。

通过 WeakMap<EffectNode, DerivedLink> 为每个 computed 节点取得稳定条目；该节点订阅多个 Dep 时复用同一条目。reference 始终是弱引用；retained 仅在第 3.3 节的条件成立时指向节点。

不要通过从 Set 删除弱条目、重新插入强节点来切换保活状态。直接更新同一条目的 retained，才能保留原订阅顺序，避免改变通知顺序和 AggregateError 中的错误顺序。Dep 对象本身也保持不变，继续作为 depVersions、computedOwners、ReadVersions 和 ChangeReceipt 的键。

内部辅助操作统一承担：取得节点条目、去重添加、清理、判断成员存在，以及取得存活节点快照。快照操作先复制当前 Set，再解析条目；无目标的弱条目可以就地删除，返回的节点在本轮同步遍历中强持有。不要换成会随回调增删继续扩展的 live Set 遍历。

### 3.3 保活：只沿真实活动消费者传播

保活判断读取现有依赖图，不调用 getter、不执行 effect、不修改版本或安排通知。

1. 对某个 computed，从其 consumers 向下检查存活且 active 的节点。
2. 遇到普通节点，说明存在实际活动消费者，该 computed 需要 retained。
3. 遇到 computed，继续检查它的 consumers；使用 visited 集合防止循环/重复访问。不能只读取对方当前 retained 标志，否则纯派生环可能相互保活。
4. 没有通向活动普通节点的路径时，清空 retained。
5. 当该结果变化时，通过该节点 deps 中各 Dep 的 computedOwners 找到上游 computed，重新计算它们的保活。一次传播同样使用 visited 去重。

在依赖边加入或移除之后，刷新**被修改 Dep 的 computed owner**。普通 source Dep 没有 computed owner，无需刷新。清理、替换和批次恢复中的多条边可合并收集受影响的 owner，在该次图修改结束后刷新，减少反复遍历。

必须覆盖新增消费者、消费者 stop、普通 effect 重跑换分支、computed 重算换依赖、React replaceDeps、批次恢复等路径。新建 computed 的 consumers 可能先被读取、随后才收集上游依赖；保活标记不能依赖“已经订阅过源”才能建立。

此机制只在原有依赖图内建立强边，不增加全局活动 effect/计算值强引用集合。这样既保护活动订阅，也保留“整个源图已经无人持有时可以整体回收”的原行为。

### 3.4 保留 computedOwners 与现有计算缓存

[computed.ts](../../../src/computed.ts) 中 registerComputed(consumers, node) 以及 effect.ts 中 WeakMap<Dep, EffectNode> 的 **value 保持强引用**。

它提供的必要路径是：消费者/下游计算值/读取快照 → Dep → computedOwners 对应的上游节点。把这里也改成 WeakRef，会使业务仍持有下游计算值、或 React 等待提交的读取快照失去上游节点。

computed 外壳对 node 的闭包引用、getterCache 的 WeakMap 结构、dirty/value 缓存和候选缓存 adopt 流程均保留。自动 getter 由现有 computed 机制自然获得修复，不必再给 receiver 增加独立清理协议。

### 3.5 死条目清理与 finalizer 的安全边界

只让载荷回收、却让长期存活源的 Dep 无限积累死条目，不算完整修复。采用两个清理时机：

- 遍历订阅或判断是否存在存活订阅时，顺便删除失效条目。
- 用 FinalizationRegistry 尽力移除长期没有写入、因此没有触发遍历的 Dep 中的死条目。

每条 computed → Dep 订阅可登记一条清理记录，target 为 computed 节点，unregister token 为该节点稳定的 DerivedLink。**holding 只能包含 WeakRef<Dep> 与 WeakRef<DerivedLink>**。不要直接保存 DerivedLink，因为它可能通过 retained 强持有 target；也不要保存 node、node.deps、fn、receiver、原始 Dep 或捕获这些对象的清理闭包。

完整 cleanup 时先从旧 Dep 删除条目，再按该 token 注销旧登记；重收集时只为实际新加入的边重新登记。最终回调只解析弱引用并删除匹配条目，目标或 Dep 已不存在时直接结束。删除失效条目不改变 depVersion，也不触发业务回调。

最终回调触发时间不参与功能正确性：缓存失效和通知由正常读写维护。无需定时器、全局周期扫描，也不要为了清扫而在每次普通属性读取时扫描所有订阅。

### 3.6 必须同步接入的代码位置

| 位置 | 所需调整 | 保留的语义 |
| --- | --- | --- |
| trackDep | 用稳定条目判断重复并加入；同步记录 node.deps 和订阅登记，刷新受影响 owner | 单次依赖只记录一次；activeCapture 分支继续只记录版本 |
| cleanup / stopEffect | 删除同一条目；注销该节点的清理登记；刷新失去消费者的 owner | stop 幂等、不复活节点；队列移除和原有错误处理不变 |
| replaceDeps | 复用相同添加/清理机制 | React 只在原有提交/订阅阶段建立永久订阅 |
| restoreComputedDeps | membership 改为检查稳定条目；恢复边也走相同登记逻辑，最后刷新保活 | 先恢复整张图，再传播失效；分支回退和最终缓存规则不变 |
| invalidateComputeds / collectEffects | 使用存活节点快照，剔除死条目，继续按节点去重 | 版本递增、失效顺序、净变化收集、同步投递不变 |
| restoreComputedDeps 中 new Set(restored) | 仍可作为一次同步失效传播的临时强集合 | 不把这个临时集合登记为长期订阅，不额外改变版本策略 |
| PropsCell.hasSlotConsumers | 用内部“是否存在存活且 active 的订阅”判断，替代 getDep(...).size > 0 | 死弱条目不能让 PureComponent 误判仍有订阅 |

PropsCell 的存在性判断需要把仍存活的 computed 也计为订阅，不能直接复用第 3.3 节的“是否有活动普通消费者”判断；两者用途不同。

保留 pendingEffects、pendingSources、当前 BatchContext、RenderAttempt 对本次任务所需对象的短期强引用。批次/提交结束后按原生命周期释放，不把这些协调结构全局弱引用化。

### 3.7 D02 定向回归

确定性行为用例追加到 [test.ts](../../test.ts) 和 [react.tsx](../../react.tsx)，复用原有断言。GC 诊断单独新增 test/derived-lifecycle.mjs，避免让普通 npm test 依赖 GC 时机。

| 场景 | 必须验证 |
| --- | --- |
| 活动 effect/watch 仅依赖 computed，创建函数退出，disposer 未保存 | 跨多轮 GC 后写源，effect/watch 仍收到正确值；不能只测全局仍持有 computed 的情形 |
| 仍持有 computed，没有普通消费者 | GC 后改源不主动求值；下次读获得最新值；重复读命中缓存 |
| 最后消费者 stop，但保留 computed | stop 后不再通知；computed 后续仍失效、可读取最新值 |
| 仅持有下游计算值 / 读取快照 | 上游节点存活，链式/菱形依赖不丢失 |
| 丢弃 1000 个临时 computed 及 getter receiver，源继续存活 | 工厂退出、跨事件循环 GC 后不再出现报告中的强保留链 |
| effect 每次运行创建临时 computed，消费者换分支或 stop | 当前依赖有效，旧派生节点和载荷可回收 |
| 所有源和消费者外部引用释放 | 活动派生图整体可回收，排除全局登记/finalizer 引入的新根 |
| 固定源上反复创建/丢弃多批派生节点 | 失效遍历能清扫死条目；finalizer 尽力清扫静默源；无持续增长的死条目/登记保留链 |
| React 提交、换分支、StrictMode 重连、Suspense 放弃候选、卸载 | 保留原候选/已提交缓存隔离及订阅清理；PureComponent 不把死条目当消费者 |

已有 CORE-015～031、批内首次读取、异常恢复、同集合不同读取顺序、普通 effect 错误聚合等用例必须原样通过。报告中 storage 共享 child / 异步 I/O 完成后的回收对照也须保留，用来检查新增 finalizer 是否意外持有整张数据图。

GC 脚本使用 Node --expose-gc，每阶段参考原报告跨 12 轮 setImmediate + GC，并在不同进程至少复核两次。只记录 WeakRef 或计数，避免日志、数组、最后一个循环局部变量和 retained stop 闭包保活被测对象；一次 deref 后先跨 job 再进入下一轮回收。不能要求某个 finalizer 在固定毫秒内执行。若样本未释放，要检查堆保留路径并区分测试夹具与生产引用，不能直接忽略或宣告通过。

## 4. D01：识别外部 Object.prototype，保持原有内建对象边界

### 4.1 修改方式

当前 canProxy 在原型链上遇到外部 realm 的 Object 构造器时，因 ctor !== Object 且其为 native 而拒绝代理。修复只补足这个识别缺口，不把所有对象都放行，也不对输入做 JSON 克隆。

在 reactive.ts 中增加一个内部导出的原型判定辅助函数，供 storageSnapshot.ts 复用。storageSnapshot.ts 已经从该模块导入 toRaw，无需新增模块、依赖方向或公共导出。

建议判定逻辑如下：

```ts
const objectConstructorSource = Function.prototype.toString.call(Object)

/** Internal helper: identify an intrinsic Object.prototype across realms. */
export function isObjectPrototype(prototype: object): boolean {
    if (Reflect.getPrototypeOf(prototype) !== null) return false
    const ctor = Reflect.getOwnPropertyDescriptor(prototype, 'constructor')?.value
    return typeof ctor === 'function'
        && Reflect.getOwnPropertyDescriptor(ctor, 'prototype')?.value === prototype
        && Function.prototype.toString.call(ctor) === objectConstructorSource
}
```

三个条件共同限制：原型链到此结束；constructor 与 prototype 互相对应；构造器具有本 realm 原生 Object 的 intrinsic 源码表示。不要只比较 constructor.name 或 '[object Object]'，也不要调用输入的 constructor、toString、toJSON 或 Symbol.toStringTag。

canProxy 的原型遍历保留现有 toRaw 归一化，在原有拒绝条件中增加例外：

```ts
if (typeof ctor === 'function' && ctor !== Object
    && !isObjectPrototype(current) && isBuiltinConstructor(ctor)) return false
```

保留 ctor !== Object 的既有判断，避免顺带收紧当前 realm 已接受的自定义原型对象。函数/类构造器入口、Array.isArray 快速分支和其他 isBuiltinConstructor 检查不变。

isStorageRoot 保留 primitive/function、computed 排除及 toRaw，再将对象条件扩展为：

```ts
return Array.isArray(raw) || prototype === null
    || prototype === Object.prototype || isObjectPrototype(prototype)
```

storage 只检查根的**直接原型**，不能因为整条链最终到达 Object.prototype 就接受类实例或任意自定义原型对象。scanStorage 和 encodeStorage 已复用 isStorageRoot，因此只改这一处即可统一根与嵌套数据识别；decodeStorage、危险键检查及恢复预检继续复用原逻辑。

这些检查对正常对象使用描述符读取，不执行属性 getter；不扩展为对任意第三方 Proxy 陷阱或被篡改 realm 内建对象的安全承诺。

### 4.2 D01 回归矩阵

| 输入/链路 | 预期 |
| --- | --- |
| Node vm / 真实同源 iframe 的普通对象及嵌套普通对象 | 返回代理；修改后 effect 序列 [0, 1]；重复 reactive(raw)、reactive(proxy) 和共享子对象身份稳定 |
| 同 realm 普通对象、null 原型对象、数组 | 与原行为一致，包括数组截短、固定只读属性的 Proxy 不变量 |
| 外部 realm 用户类、继承用户类、getter | 核心响应式正常；getter receiver/缓存语义与同 realm 一致；storage 仍拒绝类实例 |
| Map、Set、Date、Promise、RegExp、TypedArray、URL、Headers 及 Date 子类 | 在相应环境存在时仍原样返回，实例方法可用；其内部变化不新增通知 |
| 自定义 constructor 访问器、Symbol.toStringTag 访问器、名为 Object 的用户构造器、伪装普通原型 | 判定不运行访问器；storage 不误接纳非普通数据对象；核心原有自定义原型支持不被收紧 |
| storage 的外部 realm 根/嵌套对象/数组/null 原型数据 | 创建、恢复和后续深层编辑保存成功；根代理身份稳定；纯恢复不回写；异步本地优先仍成立 |
| 外部 realm 数据含 __proto__ / constructor / prototype 持久化键 | 继续拒绝危险记录/编码，不改变对象原型、不半恢复；输入分类成功不等于放行危险键 |
| getter / toJSON 持久化对照 | 扫描和快照仍只处理数据描述符，不执行 getter/toJSON |

Node vm 没有的 Web API 在真实 iframe 中测，不通过注入本 realm 构造器冒充外部 realm 实例。新增核心/存储行为断言放入 [test.ts](../../test.ts)、[storage.ts](../../storage.ts)；最小跨 realm 断言加入现有 [smoke-assertions.cjs](../../smoke-assertions.cjs) / [storage-smoke.cjs](../../storage-smoke.cjs)，让 ESM、CJS 和 tarball 消费都覆盖实际修复。

## 5. D03：valueProp 使用严格参数契约

### 5.1 最小代码修改

在 [model.ts](../../../src/react/model.ts) 的 ModelView 中，保留原来的 children/file/source 校验顺序，在 captureReference(source) 之后、默认属性计算之前校验原始 valueProp：

```ts
const reference = captureReference(source)
if (valueProp !== undefined && valueProp !== 'value' && valueProp !== 'checked') {
    throw new TypeError('Model valueProp must be value or checked')
}
const field = valueProp === undefined
    ? (typeof reference.value === 'boolean' ? 'checked' : 'value')
    : valueProp
```

替换当前“先 ?? 默认化、再校验 field”的两行逻辑；沿用原 TypeError 文案。校验位于 useCommittedRef 等后续逻辑之前，不新增 Hook、不改变事件回调或提交协议。

ModelProps 和 DefinedModelProps 已限制为 'value' | 'checked'，不需要扩大或修改类型。defineModel 已将 valueProp 传给 Model，沿用同一校验即可，不增加第二套判断。

**非法的是 valueProp 参数为 null，模型数据 reference.value 为 null/undefined 仍合法。** 原生 input/textarea/select 的空值显示、checkbox 的 false、多选的 []、自定义组件保留原值等原有行为一律保留，显示默认值也仍不回写数据。

### 5.2 参数与恢复用例

| valueProp | 预期 |
| --- | --- |
| 省略、显式 undefined | 布尔模型默认 checked，其他模型默认 value |
| 'value'、'checked' | 尊重显式属性，不添加新的“属性与模型类型必须匹配”限制 |
| null、空字符串、'foo'、1、false、对象 | 同一 TypeError；不绑定控件、不写模型、不调用 postValue/onChange |

扩展 [react-features.tsx](../../react-features.tsx) 的 Model 校验用例，覆盖 Model 和 defineModel、文本输入、checkbox 和自定义控件；非法渲染失败之后再建立合法绑定，确认上下文和后续编辑正常。保留 SSR/hydration、StrictMode、Suspense 与卸载后旧 handler 不写入的既有测试。

在现有 React .mts/.cts/.tsx 类型消费者中补充 valueProp=null 的 @ts-expect-error 负例以及 undefined/两合法值的正例，不改已有类型的含义。在 [README](../../../README.md) 的 Model 参数说明处补充一句：valueProp 仅支持 'value'、'checked' 或省略/undefined，null 为非法参数；模型数据空值显示规则维持原说明。同步明确 [UI-022](../../cases/ui.md) 的 null 负例，历史报告仍保留当时“待确认”的记录。

## 6. 文件级实施清单

| 文件 | 计划修改 |
| --- | --- |
| src/effect.ts | 派生条目、活动消费者保活、弱清理登记、依赖增删/快照辅助操作；接入原有批次与订阅路径 |
| src/react/props.ts | hasSlotConsumers 使用存活订阅判断 |
| src/reactive.ts | 新增内部 Object.prototype 判定，精准调整 canProxy |
| src/storageSnapshot.ts | isStorageRoot 复用同一原型判定 |
| src/react/model.ts | 默认化之前校验 valueProp，只允许 undefined 触发默认 |
| test/test.ts、test/storage.ts、test/react.tsx、test/react-features.tsx | 补充上述行为边界，保留原断言；新增独立 test 声明尽量追加到文件末尾 |
| test/derived-lifecycle.mjs（新增） | 独立 GC/保留链与活动订阅对照，导入本次构建产物，不暴露生产测试接口 |
| test/smoke-assertions.cjs、test/storage-smoke.cjs | 最小 D01 产物/隔离消费断言，复用现有入口 |
| test/types/react/features.mts、features.cts、features.tsx | D03 严格类型正负例 |
| README.md、test/cases 对应文档、test/AUTOMATION.md | 最小说明、用例映射与自动化索引同步 |
| 新复测目录下的报告脚本副本 | 新版本证据输出路径、浏览器硬断言、新 tarball 消费；不覆盖本目录历史脚本/证据 |

computed.ts、react/observer.ts、storage.ts 以审查和回归为主，当前结构已经提供必要的缓存/所有权通道，不预设需要修改。package.json、锁文件、公开 index.ts 和构建脚本无需因本修复变更。

自动化索引使用声明顺序生成 N/F 等编号，新增测试尽量追加，避免让原有用例映射整体错位。更新后重新生成索引并审阅映射；新测试必须有明确场景归属。原报告的 240 条计划数、181 项基线等属于历史事实，不重写成新版本数字。

## 7. 实施顺序与验证入口

### 7.1 三个独立修复阶段

1. **建立修复基线。** 记录当前源码与锁文件散列、工作区差异及依赖版本。新增复测目录保存输出；先把三项最小复现落为正式回归断言，确认修复前确实失败。
2. **完成 D02。** 一次性接好条目、保活、清理、批次恢复和 props 存活判断。先跑核心/React 相关用例和 GC 对照；不能把“只加弱引用”的中间版本作为已完成修复提交。
3. **完成 D01。** 共享内部判定，并验证普通对象正例、内建对象负例和 storage 全链路，尤其是危险键与 getter 不执行。
4. **完成 D03。** 移动参数校验、补充 null 负例和文档，保留 nullable 模型正例。
5. **完成合并回归。** 仅在三项定向检查通过后，对最终同一份源码和同一份新 tarball 跑下列门槛，记录实际版本与退出码。

### 7.2 最终本地回归命令

以下命令在项目根目录执行，任一步失败先定位，不继续将后面的成功结果当作整体通过。test/derived-lifecycle.mjs 是按本方案新增的脚本，当前尚未实现。

```powershell
npm test
npm run build
node --expose-gc test/derived-lifecycle.mjs
npm run test:dist
npm run test:package
node test/validate-docs.mjs --inventory
node test/validate-docs.mjs
```

npm test 覆盖源码核心/存储/React 和类型；test:dist 覆盖 ESM/CJS、禁用实验性 require(ESM) 的消费与声明；test:package 已会复制完整 React 行为套件到 React 18/19 隔离消费者，不必为 D03 另建测试框架。其内部重复构建和测试不重复累计独立用例数。

若依赖订阅增删成本有明显变化，使用原有短基准，在相同环境比较 computed 缓存读取、10000 次写入、有/无 batch 及链式订阅；同时断言求值/通知次数。D02 的 visited、稳定条目和去重登记应控制重复工作，不通过减少正确通知来“优化”。这轮无需重复约 615 秒的大对象存储压力，只因新结果暴露相关风险时再追加。

### 7.3 历史脚本复用时的两个必要修正

**隔离旧证据。** [memory.mjs](scripts/memory.mjs) 会直接写旧 evidence/memory.json 与堆快照；supplement-react.tsx 也写生命周期证据。复制必要夹具到新的 test/reports/<新运行编号>/scripts，配套 tsconfig 和 evidence 目录后执行；不要直接重跑本目录的写文件脚本覆盖原证据。新增 GC 脚本须同时检查 computed 和 getter，原 memory.mjs 末尾只对 retained.computed 做硬断言，单靠它退出 0 不足以关闭整个 D02。

**浏览器必须检测修复结果。** 原 browser.mjs 只把 crossRealm() 返回值记入 row.crossRealm，没有断言代理身份和 [0, 1]。在新复测副本中添加这些硬断言，再补充嵌套对象、类/内建负例和 storage 场景；不能把旧浏览器命令退出 0 解释为 D01 已修复。

新复测 .runtime 必须安装**修复后重新打包的 tarball**，记录 SHA-256 和安装锁；清理或重新生成新复测目录内的预构建 bundle，不沿用 QA_PREBUILT 对应的旧 bundle。浏览器入口解析记录继续确认使用 dist/esm 而不是 Node 桥。否则源码 SSR 与 iframe/native ESM 可能测到不同版本。

### 7.4 环境矩阵与必要证据

- 重跑报告已有的 Chromium/WebKit/Firefox × React 18/19 × development/production，共 12 组。D01 的真实 iframe 是直接修复验收；同时保留 Model、storage、hydration 和控制台检查。Windows Firefox 如仍无法启动，按原方式使用 Linux/WSL，明确记录平台，不能写成 Windows 通过。
- Windows 和 Linux/WSL 对最终版本执行原有基线命令；Linux 使用隔离依赖。相同新 tarball 的双格式/混合入口消费通过，核心消费者仍无需 React/DOM/localforage。
- 每项记录源码/产物散列、实际依赖和浏览器版本、命令、退出码、失败详情。D02 保留两轮独立 GC 结果和必要的修复后堆路径；D01 保留 iframe 明确断言结果；D03 保留 React 18/19 参数矩阵。
- 若新增的 GC/浏览器资源检查因环境无法判断，记录为未完成或阻塞，不能借用旧版本成功结果。原 QUAL-001、QUAL-016 继续由对应的人工验收补齐，不由本次自动化代签。

## 8. 合并门槛与回退边界

只有以下条件同时满足，才能把三项标记为已修复：

1. D02：源保留时弃用 computed/getter 不再有报告中的强保留链；活动 effect/watch 不因 GC 静默停止；保留计算值的惰性失效、所有源释放和死条目清理对照成立。
2. D01：Node vm 与真实 iframe 普通对象正确通知；storage 接受并持续保存这些普通数据；用户类、内建对象、危险键和访问器边界均未被错误放宽。
3. D03：null valueProp 明确抛 TypeError；undefined 和两合法值正常；模型数据 null/undefined 的原显示与写回规则不变。
4. 原核心/存储/React 18/19、类型、dist、tarball、浏览器与文档检查均满足要求；新增用例没有通过修改原断言或跳过失败来“变绿”。
5. 公共导出、类型、错误身份/聚合顺序、同步批次净变化和模块共享行为未改变；新增辅助函数未进入公共入口，包布局未意外扩张。

实现补丁按 D02/D01/D03 分开审阅，每项连同自己的回归测试形成完整变更。D02 的条目机制、活动保活、清理和 props 判断作为一个整体；D01 的 reactive/storage 判定作为一个整体。如果出现新漏更新、提前回收或误代理，回退对应整组修复补丁并保留失败证据，不能只撤销保活或只恢复一侧判定，更不能重置用户原有工作区修改。

本方案完成条件是“最小已知缺陷修复 + 对相关旧行为的验证”，不把未涉及的性能优化、API 生命周期设计或新平台支持混入本轮。
