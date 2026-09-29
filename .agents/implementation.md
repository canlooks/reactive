# @canlooks/reactive 落地方案

本文对应同目录的 `design.md`，覆盖第 2.1～2.5 节与第 3.1～3.6 节：响应式内核、React 组件与局部 Hook，以及本次要求的响应式 props、Chip 局部更新、Model 双向绑定和异步 loading。**继续使用自行实现的响应式内核，不复用 `alien-signals`；核心入口没有运行时依赖，React 集成通过独立子入口和可选 peer dependency 提供。**

本轮已在原有第 2.1～2.5 节及第 3.1～3.3 节实现上，完成显式 computed 的只读 `.value` 迁移，以及 Chip、Model、useLoading、useReactive。新增能力复用现有内核、观察器与提交协调；第 10.6 节的 props 提交与通知去重契约继续保留。本文记录实现契约与验收要求，实际检查结果见文末实施记录，使用示例与迁移说明见 README。

## 1. 实现范围与当前基础

当前已有 `src/effect.ts`、`computed.ts`、`reactive.ts`、`batch.ts`、`watch.ts` 和五个 API 的根入口；`test/test.ts` 使用 `node:test` 与 `node:assert/strict`。`scripts/build.mjs` 已递归生成 ESM/CJS 与声明，并提供共享 CommonJS 内核的 Node 双入口桥接；已有两种格式、混合导入、React DOM、消费端类型及隔离打包测试。`tsconfig.json` 开启传统装饰器，代码同时支持 `@reactive` 和 `@reactive()`，本次保留这些能力。

`src/react/` 包含 `Observer`、`PropsCell`、函数/类组件包装、局部 Hook，以及新增的 `commit.ts`、`chip.ts`、`model.ts` 和 `loading.ts`。内核具备候选依赖收集、读取视图、notify 节点、提交来源确认及结算收尾；`reference.ts` 提供内部可写属性位置捕获，computed 和 getter 的捕获隔离不改变依赖追踪。`useReactive` 为局部响应式状态的唯一公开 Hook 名称。新增能力复用上述观察器和批次，不恢复旧版 `Proxyable`/`TwoWay` 架构，不新建依赖表或 React 调度队列。

本阶段的功能范围：

| 设计要求 | 实现方式 |
| --- | --- |
| `reactive(object)` 创建响应式数据 | Proxy 拦截属性读取、赋值和删除 |
| `@reactive` 同时代理类与实例 | 返回构造函数 Proxy，在 `construct` 中代理新实例 |
| `effect(fn)` 立即执行并绑定属性 | 执行时记录当前 effect，属性读取时建立订阅 |
| 每次执行更新绑定关系 | 执行前解除上次订阅，执行中重新收集 |
| 属性变化后触发相关副作用 | 按原始对象和属性名查找订阅，在当前同步批次结束时通知 |
| `computed(fn).value` 按需计算和缓存 | 返回稳定的只读计算值对象，value getter 复用内部 effect、缓存和失效标记 |
| getter 自动成为计算属性 | 按接收对象和属性缓存 computed，以代理作为 getter 的 `this` |
| `batch(fn)` 延迟副作用 | 立即写入数据并使 computed 失效，最外层批次退出时统一结算 |
| 回到初值不通知，多次修改只通知一次 | 按属性保存首次写入前的状态，筛选净变化后按 effect 去重 |
| `@reactive` 类方法自动批处理 | 在方法读取时复用包装函数，调用时进入同一个 batch 边界 |
| `watch(source, callback, options?)` | 复用同步队列，仅收集 source 的依赖；默认不执行首次回调，`immediate: true` 时立即执行 |
| 函数与类响应式组件、三组别名 | React 子入口按组件类型分发；函数路径自动包裹 memo，内部收集 render 依赖并通知 React 更新 |
| `useReactive(initialState)` | 为一次组件挂载保存稳定的响应式对象 |
| `useWatch(source, callback, options?)` | 提交后建立监听并按 immediate 决定是否执行首次回调；更新闭包和依赖，卸载时停止 |
| 组件 props 自动响应式 | 函数组件获得只读 props 视图；类组件适配 this.props 读取；提交后通知 watch/computed 消费者 |
| props 更新不重复渲染组件 | 标记 props 提交来源，只消除所属组件已完成渲染的同源通知，保留监听回调与其他数据更新 |
| `Chip` / `chip()` | 独立观察子树内的同步 render 回调，响应式依赖只绑定到片段 |
| `Chip.Strict` / `strictChip()` | 忽略父级 props 更新，仍响应片段自己的依赖与 React 更新 |
| `AsyncChip` 及 Strict / 函数形式 | 首次输出 fallback，useEffect 后挂载对应的片段观察器 |
| `useModel(initialValue)` | 稳定的局部响应式 value 与事件/直接值写入函数 |
| `Model source` / `defineModel refer` | 捕获可写属性位置，经同一代理写回，注入受控属性并合并 onChange |
| `useLoading(fn, initialLoading?)` | 稳定 load 函数、并发调用记账、布尔/数值 loading、异常及卸载收尾 |
| React 非必需依赖 | 根入口及其声明不引用 React，独立导出 `@canlooks/reactive/react` |

设计没有规定的行为，在本方案中统一约定：

- 普通对象、普通用户类实例和数组使用按需的深层代理；读取嵌套对象时才创建代理，不预先递归遍历。
- 修改同步生效，普通 effect 在当前最外层批次结束前执行，不合并到微任务。未调用 `batch`、也不处于自动批处理方法内时，每次最外层赋值或删除构成一个隐式批次，连续两条赋值仍分别通知。
- 普通数据属性使用 `Object.is` 判断变化，比较前将本库代理还原为原始对象。因此重复赋同值、`NaN` 重复赋值、同一对象的 raw/proxy 互换不触发。
- 新增和删除属性也算变化。提前读取过的不存在属性，后续新增时能够触发订阅。
- 只收集函数同步执行期间实际读取的属性；`await` 后、定时器内的读取不属于之前的 effect。
- computed 和 getter 应是同步、无副作用的派生计算，只依赖可追踪的数据。
- 批次只覆盖同步调用栈，嵌套批次共用最外层的比较基线。它延迟通知，不隔离读取，也不回滚写入；返回值、异常和异步边界见第 5 节。

本阶段在已有 watch 和 React 绑定上补齐设计 3.3～3.6；不增加公开 `ref`/`twoWay`、自定义调度器、持久化、插件系统、`@batch`、返回包装函数的 batch 工厂或异步事务。Model 使用的属性引用捕获只作为内部接口。保留现有 `reactive()` 装饰器工厂，不为新增组件 API 扩展无参装饰器工厂。`Map`、`Set`、`Date`、Promise、DOM 对象等仍不代理内部行为，读取时原样返回；它们所在的普通属性被整体替换时仍可通知。

`in`、`Object.keys`、`for...in` 的结构变化追踪，以及运行期间通过 `defineProperty`、`setPrototypeOf` 修改对象结构，不纳入首版契约。这些操作仍按 JavaScript 本身执行，但不承诺建立或更新相应订阅。

## 2. 对外 API

```ts
export function reactive<T extends object>(target: T): T
export function reactive(): <T extends object>(target: T) => T
export function effect(fn: () => void): () => void
export interface Computed<T> { readonly value: T }
export function computed<T>(getter: () => T): Computed<T>
export function batch<T>(fn: () => T): T
export interface WatchOptions { immediate?: boolean }
export function watch<T>(source: () => T, callback: (newValue: T, oldValue: T) => void, options?: WatchOptions & { immediate?: false }): () => void
export function watch<T>(source: () => T, callback: (newValue: T, oldValue: T | undefined) => void, options?: WatchOptions): () => void
```

以上 API 从 `@canlooks/reactive` 导入。`reactive` 保留输入类型，类构造签名、实例属性和静态成员无需重新映射，同时保留 `@reactive` 与 `@reactive()`。普通对象的函数属性原样返回；响应式类的实例方法、静态方法按第 8 节自动包装，但均不自动绑定 `this`。函数作为 `reactive` 的直接参数时，仅承诺支持用户类构造函数；`reactive(Store)` 与 `@reactive` 使用同一条类处理路径。

`effect` 的返回值只负责停止订阅，重复调用无副作用；不返回 runner，不解释回调的返回值。按更新后的设计 2.3，`computed` 返回稳定的 `Computed<T>` 对象，通过 `double.value`、`greeting.value` 取值；value 为只读访问器，不提供 setter，也不保留可调用返回值或旧签名兼容层。`Computed` 仅从根入口作类型导出，核心运行时仍为五个 API。

显式计算值用于 effect、watch/useWatch、其他 computed 或 React render 时，均在相应读取函数内访问 `.value`：例如 `effect(() => double.value)`、`watch(() => double.value, cb)`、`useWatch(() => double.value, cb)` 和 `computed(() => double.value + 1)`。watch/useWatch 的 source 仍是函数，不增加直接接受 Computed 对象的重载；提前解构 `const { value } = double` 只得到当时值，不能代替监听函数内的实际读取。对象/类的自动计算 getter 仍直接写 `state.double`，不把它改成返回 Computed 对象。

`batch(fn)` 立即调用一次 `fn`，原样返回其结果；最外层调用先结算再返回，内层调用不提前结算。它不是用于生成另一个函数的高阶 API。传入非函数时抛出 `TypeError`。需要参数或接收对象时使用闭包，例如 `batch(() => store.update(value))`。

支持以下身份关系：

```ts
reactive(raw) === reactive(raw)
reactive(reactive(raw)) === reactive(raw)
```

显式传入 `undefined`、`null` 或基本类型时抛出 `TypeError`，无参调用 `reactive()` 则返回现有装饰器工厂；不支持深层代理的内建对象原样返回。仅通过返回的代理进行读写才能完整参与响应式，直接修改保留的原始引用无法被感知。

`watch` 的第三个参数为可选配置，`immediate` 默认 false：首次读取只建立依赖和旧值；true 时先读取 source，再同步调用 `callback(initialValue, undefined)`，最后返回幂等的停止函数。设计未指定首次 oldValue，本方案约定为 `undefined`。后续变化的 oldValue 均为上一次成功读取的结果；无返回值的 source 推断为 `void`，运行时两个参数均为 `undefined`。

声明使用上述两个重载：未传选项或明确传 `immediate: false` 时，oldValue 保持 T；传 true、布尔变量或通用 WatchOptions 时，oldValue 为 `T | undefined`，调用方须处理首次无旧值的情况。`WatchOptions` 从根入口作类型导出，React 子入口复用并作类型转导，不增加运行时导出。具体通知、值比较和异常语义见第 9 节。

React API 只从 `@canlooks/reactive/react` 导入，签名如下；`React` 类型引用仅出现在该子入口的声明中：

```ts
import type * as React from 'react'
import type { WatchOptions } from '../watch.js'

export function ReactiveFunctionComponent<P extends object>(component: React.FunctionComponent<P>): React.NamedExoticComponent<P>
export function ReactiveClassComponent<C extends React.ComponentClass<any>>(component: C): C
export function ReactiveComponent<C extends React.ComponentClass<any>>(component: C): C
export function ReactiveComponent<P extends object>(component: React.FunctionComponent<P>): React.NamedExoticComponent<P>
export { ReactiveComponent as RC, ReactiveFunctionComponent as RFC, ReactiveClassComponent as RCC }
export function useReactive<T extends object>(initialState: T): T
export type { WatchOptions }
export function useWatch<T>(source: () => T, callback: (newValue: T, oldValue: T) => void, options?: WatchOptions & { immediate?: false }): void
export function useWatch<T>(source: () => T, callback: (newValue: T, oldValue: T | undefined) => void, options?: WatchOptions): void
```

函数组件路径自动返回 memo 包装后的组件，类型使用 `React.NamedExoticComponent<P>`，保留 JSX 的 props 推断与必填属性检查；返回值由 React 渲染，不作为普通函数直接调用。`ReactiveComponent`/`RC` 的函数分支与 `ReactiveFunctionComponent`/`RFC` 共用该路径。类组件保留构造签名、实例与静态成员类型，不增加 memo 外壳；三组别名必须是同一函数引用。

响应式 props 由组件适配器自动提供，不新增公开函数或参数。RC/RFC 接收 React 原始 props 进行 memo 比较，调用用户函数时传入同一实例稳定的只读视图；RCC 接入 this.props 的读取与提交。props 由父组件提供，不能当成 useReactive 的可写状态；在 source 中读取 `props.count` 或 `this.props.count` 才能建立对应监听，详见第 10.6 节。

`useReactive` 返回响应式对象，不返回 React 原生的 `[value, setValue]`；按更新后的设计 3.2，原 `useState` API 已重命名为 `useReactive`，不再保留旧名称导出或兼容别名。该 Hook 只接收对象初值，不增加惰性工厂参数或 dependency array。`useWatch` 接收 WatchOptions，沿用 watch 的新旧值类型；生命周期由组件管理，返回 `void`，immediate 的执行边界见第 10.5 节。

新增 React API 的目标签名如下，未列出的内部模块不从包入口导出：

```ts
export interface ChipProps { children: () => React.ReactNode }
export interface AsyncChipProps extends ChipProps { fallback?: React.ReactNode }
export const Chip: React.FunctionComponent<ChipProps> & {
    readonly Strict: React.NamedExoticComponent<ChipProps>
}
export const AsyncChip: React.FunctionComponent<AsyncChipProps> & {
    readonly Strict: React.NamedExoticComponent<AsyncChipProps>
}
export function chip(render: () => React.ReactNode): React.ReactElement
export function strictChip(render: () => React.ReactNode): React.ReactElement
export function asyncChip(render: () => React.ReactNode): React.ReactElement
export function asyncStrictChip(render: () => React.ReactNode): React.ReactElement

export type ModelEvent<T> = T extends string
    ? React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    : T extends boolean ? React.ChangeEvent<HTMLInputElement>
    : T extends readonly string[] ? React.ChangeEvent<HTMLSelectElement> : never
export interface UseModelReturn<T> {
    value: T
    readonly onChange: (input: T | ModelEvent<T>) => void
}
export function useModel<T>(initialValue: T): UseModelReturn<T>
export interface ModelProps<T, A extends unknown[] = unknown[]> {
    source: () => T
    children: React.ReactElement
    postValue?: (...args: A) => T
    valueProp?: 'value' | 'checked'
}
export function Model<T, A extends unknown[] = unknown[]>(props: ModelProps<T, A>): React.ReactElement
export type ModelValue<P> = P[Extract<'value' | 'checked', keyof P>]
export type ModelChangeArgs<P> = 'onChange' extends keyof P
    ? NonNullable<P['onChange']> extends (...args: infer A) => unknown ? A : never
    : never
export type DefinedModelProps<P> = Omit<P, 'refer' | 'ref' | 'valueProp' | 'value' | 'checked' |
    'defaultValue' | 'defaultChecked' | 'onChange'> & {
    refer: () => ModelValue<P>
    onChange?: P[Extract<'onChange', keyof P>]
    valueProp?: 'value' | 'checked'
}
export function defineModel<P extends object = React.ComponentProps<'input'>>(
    component: React.ComponentType<P> & (ModelValue<P> extends never ? never
        : ModelChangeArgs<P> extends never ? never : unknown),
    postValue?: (...args: ModelChangeArgs<P>) => ModelValue<P>,
): React.FunctionComponent<DefinedModelProps<P>>

export interface UseLoadingReturn<A extends unknown[], R, L extends boolean | number> {
    readonly load: (...args: A) => Promise<Awaited<R>>
    readonly loading: L
    readonly stacksCount: number
}
export function useLoading<A extends unknown[], R>(
    fn: (...args: A) => R, initialLoading?: boolean,
): UseLoadingReturn<A, R, boolean>
export function useLoading<A extends unknown[], R>(
    fn: (...args: A) => R, initialLoading: number,
): UseLoadingReturn<A, R, number>
export function useLoading<A extends unknown[], R>(
    fn: (...args: A) => R, initialLoading: boolean | number | undefined,
): UseLoadingReturn<A, R, boolean | number>
```

`Model` 使用设计示例中的 `source`，`defineModel` 产物使用 `refer` 并显式映射到 source，不混用两个参数名。`valueProp` 是处理自定义控件所需的可选映射，默认策略见第 10.9 节；不扩展任意事件名配置。`defineModel` 无注解函数使用 input props 作为默认上下文，具名控件从其 props 推断值、事件参数与其他必填字段；不支持缺少受控属性/事件协议的组件，不能退化成全量 any 来绕过检查。泛型、可选属性和 JSX 类型擦除的验证边界见第 12.3 节。

`useLoading` 默认及布尔初值返回 boolean，数值初值返回 number，联合初值保留联合类型；不能把 `false`、`true` 或 `0` 的字面量类型当成后续 loading 的完整类型。load 始终返回 Promise，保留 fn 的参数元组和 Awaited 返回值，不承诺原 Promise 身份或隐式绑定方法的 this。数值初值和 stacksCount 的关系见第 10.10 节。

## 3. 文件组织

```text
src/
  index.ts       # 导出五个核心 API 与 Computed 类型，不引用 React
  effect.ts      # 依赖收集/清理、批次与队列、通知来源、提交订阅与内部结算阶段
  batch.ts       # 公开 batch 入口、同步边界、返回值和异常转发
  computed.ts    # Computed<T> 只读 value 访问器、懒缓存、失效传播及 props 候选缓存
  reactive.ts    # Proxy、属性快照、代理/getter/方法缓存、类构造处理
  reference.ts   # 新增：内部可写属性捕获上下文，不依赖 React
  watch.ts       # 监听值与回调隔离；对内提供静默刷新和停止能力
  react/
    index.ts              # React 独立入口，统一分发与别名
    observer.ts           # render 候选依赖、提交订阅、版本快照和通知控制器
    props.ts              # props 快照/只读视图、差异发布及所属组件的通知去重
    functionComponent.ts  # 函数组件响应式包装、useSyncExternalStore 与自动 memo
    classComponent.ts     # 类组件 render 与生命周期包装
    commit.ts             # 新增：提取 useCommitEffect，共享已提交闭包登记
    hooks.ts              # useReactive、useWatch
    chip.ts               # 新增：四种片段组件及 createElement 工厂
    model.ts              # 新增：useModel、Model、defineModel、事件值归一化
    loading.ts            # 新增：useLoading 的稳定调用器、并发记账和卸载处理
test/
  test.ts        # 保留核心断言，补充 watch
  react.tsx      # 既有 React DOM 行为、生命周期、StrictMode 与订阅窗口测试
  react-features.tsx # Chip、Model、loading、提交交叉场景及真实 DOM 事件
  reference.ts   # computed 外壳、属性引用校验、getter 隔离与错误恢复
  smoke.mjs / smoke.cjs / smoke-assertions.cjs
  types/         # ESM/CJS 核心和 React 子入口的消费端类型检查
scripts/
  build.mjs      # 保留递归构建与声明复制，扩展 Node React 桥接导出
  test-package.mjs # 扩展现有无 React / React 隔离消费检查
```

模块运行时依赖保持单向：`batch.ts`、`computed.ts`、`watch.ts` 依赖 `effect.ts`；`reactive.ts` 依赖原有内核及 `reference.ts`，后者只管理捕获上下文和属性引用，不反向导入 reactive；`react/*` 依赖核心模块和 React。Model 直接使用 reference 的内部入口，代理读到的 receiver 提供写入通道。内核不反向导入 React 或公开聚合入口。共享批次上下文与队列继续放在 `effect.ts`；props 所需的内部扩展仅接收不透明的 owner/commit 标记、读取视图和候选计算记录，不导入 React 类型。React 相关文件通过相对路径使用同一套核心模块，不单独打包复制内核。

## 4. 依赖收集与副作用

### 4.1 最少的数据结构

```ts
type Dep = Set<EffectNode>

// 原始对象 -> 属性 -> 订阅此属性的内部 effect
const targetDeps = new WeakMap<object, Map<PropertyKey, Dep>>()
```

内部 `EffectNode` 保存回调、所订阅的 `Dep[]`、是否有效、是否正在执行，并区分普通节点和 computed 节点。computed 使用同一个节点结构，额外提供一个内部失效入口，用来标记自身并取得它的消费者集合；该入口不作为公开选项。

以上是已有内核的基础结构；watch 复用普通节点，React 使用内部 notify 与临时收集上下文，具体职责及通知期间再次写入的处理见第 10.2 节。Chip 和 Model 继续使用这条观察路径，引用捕获不能替代依赖收集。

另设一个 `activeEffect`、一个待执行 effect 的 `Set` 和第 5 节的批次上下文。节点使用普通对象或一个小类均可，不建立继承层次。

### 4.2 执行和清理

`runEffect(node)` 的步骤固定为：

1. 从节点上次记录的所有 Dep 中移除自己，清空旧依赖列表。
2. 保存之前的 `activeEffect`，将当前节点设为活动节点。
3. 执行回调；`track(target, key)` 将当前节点加入属性 Dep，并反向记录这个 Dep。
4. 在 `finally` 中恢复之前的活动节点和执行标记，保证嵌套调用及异常不会污染后续收集。

没有活动节点、节点已停止、或当前 Dep 已包含该节点时，不重复订阅。只有确实需要收集时才创建属性 Dep。

```ts
effect(() => state.enabled ? state.a : state.b)
```

上例从 `true` 切到 `false` 后，订阅由 `enabled + a` 变成 `enabled + b`，之后修改 `a` 不应再触发它。

公开 `effect(fn)` 创建节点后立即执行一次，再返回停止函数。停止时将节点设为无效、清除全部订阅，并从待执行集合移除；即使回调正在执行，后续读取也不能重新订阅。首次执行抛错时，先停止该节点再向调用者抛错，避免留下无法取得停止函数的订阅。

嵌套执行恢复各自的收集上下文。首版不提供自动作用域：在另一个 effect 中反复创建新 effect，创建者需要显式停止旧的内层 effect。

### 4.3 失效传播与同步队列

不能在遍历属性 Dep 时直接执行回调：回调会删除并重新添加订阅，可能重复执行；普通 effect 还可能读到未失效的 computed 缓存。

失效传播和普通 effect 调度必须拆成两个阶段：

1. 每次实际写入后，立即沿当前依赖图使 computed 及其下游 computed 失效。遍历订阅快照；遇到普通 effect 时不执行，也不据此无条件加入最终通知队列。
2. 最外层批次结束时，先完成属性净变化比较和计算依赖恢复，再从真正变化的属性 Dep 出发收集普通 effect，统一加入待执行 `Set`。
3. 两种传播各自使用局部已访问集合，避免链式、菱形依赖重复遍历。通知阶段即使遇到已经 dirty 的 computed，也必须继续访问其消费者，不能以 dirty 为由提前结束。
4. 全部待通知节点收集完成后，再同步执行队列。结算遍历只收集消费者，不再次使仍有效的 computed 缓存失效，避免批次内已算出的最终值被无故重算。

例如 `effect(() => [state.count, double.value])` 同时读取源属性和派生值，同一批次内 `count` 多次修改，effect 也只执行一次，并且读到最新的 `double.value`。`count -> a、b -> total -> effect` 的菱形依赖按同样规则处理；若源属性全部回到原值，两类消费者都不重跑。

队列使用一个 `Set` 和“正在执行队列”的标记。执行节点前将其出队，出队时检查是否已停止；执行期间产生的新变更开启新的同步批次，结算后并入队列，由当前轮继续处理，不能复用上一批次的旧值日志。正在执行的普通 effect 不因自己的同步写入重新进入队列，避免直接自触发递归；多个 effect 互相循环写入不作为受支持的用法。

“只执行一次”指同一批次的净变化统一投递一次。effect 执行后又被另一个 effect 的新写入影响，可以再次入队，不能用整轮永久去重使数据停留在旧状态。Proxy 写入口、setter 内嵌写入、公开 batch 和自动批处理方法共用同一套进入/退出计数，不维护互不相通的两套队列。

某个 effect 在更新时抛错，记录异常并继续执行本轮其他已排队的 effect；恢复队列状态后按第 5.4 节向调用方抛出。已发生的属性修改不回滚，节点仍可在后续依赖变化时重新执行。

## 5. 批处理

### 5.1 同步边界与嵌套

维护 `batchDepth` 和当前批次上下文。深度从 0 进入 1 时创建上下文；嵌套 `batch`、类方法调用和 Proxy 写入口只增加深度，退出时递减。仅深度回到 0 才结算，并在开始执行普通 effect 前释放该上下文。

`batch(fn)` 用 `try/catch/finally` 保证边界配对，保留回调结果和异常。内层结束不通知，也不重设属性初值，例如初始 `count = 1` 时：

```ts
batch(() => {
    state.count = 2
    batch(() => { state.count = 3 })
    state.count = 1
}) // 最终没有净变化，不通知 count 的消费者
```

批次不关闭依赖收集。effect 内同步调用 `batch` 或自动批处理方法，其中的属性读取仍归当前活动节点。批次内新建 `effect` 仍立即执行以建立订阅，可能读到中间值；后续通知统一遵循本批次的净变化规则，不另建每个消费者的值比较基线。

### 5.2 记录属性初值与判断净变化

仅把 effect 放入 Set 只能解决重复执行，无法判断 `1 -> 2 -> 1`。必须另设可遍历的属性变更日志：

```ts
type PropertyState =
    | { kind: 'absent' }
    | { kind: 'data'; value: unknown }
    | { kind: 'accessor'; get: PropertyDescriptor['get']; set: PropertyDescriptor['set'] }

type ChangeEntry = {
    before: PropertyState
    readCurrent: () => PropertyState
}

// 只保留当前批次实际改变过的原始对象与属性，结算后清空。
const changes = new Map<object, Map<PropertyKey, ChangeEntry>>()
```

Proxy 在写前读取自有描述符，写后确认实际变化；首次改变该 key 时保存 `before`，后续改变不覆盖。`readCurrent` 由代理层提供，直接读取原始描述符并归一化数据值，不调用 getter、不收集依赖。临时 Map 便于结束时遍历，不能用不可遍历的 WeakMap 代替；上下文释放后不长期保留对象。

净变化比较规则如下：

- 数据属性比较归一化后的原始值，使用 `Object.is`；不对对象做深比较。嵌套字段的变化由各自的属性日志负责。
- 属性是否存在、数据/访问器类型也参与比较，避免把“不存在”和“存在但为 undefined”混为一谈。
- 访问器记录 getter/setter 函数身份，不通过求值比较派生结果；配套 setter 内部的数据修改独立记账。
- 同一批次中新增再删除、删除再恢复同值数据属性，最终结构和值均一致则不通知。删除 getter 或把它替换为数据属性则属于变化。
- 描述符标志变更与对象枚举顺序不纳入净变化契约，与首版不追踪 `defineProperty`、键枚举的范围一致。

结算时只保留最终状态与 `before` 不同的 `(target, key)`，再一次性收集关联的普通 effect。两个字段都改变且被同一 effect 读取，也只执行一次；一个字段恢复原值不能抵消另一个字段的净变化。

### 5.3 computed 的中途读取与依赖恢复

每次实际变化都立即使相关 computed 失效，包括把数据改回初值的那次写入。因此 `count = 2; double.value; count = 1` 结束后不能保留代表 2 的有效缓存；即使最终不通知 effect，之后读取 `double.value` 仍须得到 2。

还要处理批次中途重算导致依赖分支改变的情况：

```ts
// 初始 enabled = true，a = 1，b = 10；已有 effect 读取 selected.value
const selected = computed(() => state.enabled ? state.a : state.b)
batch(() => {
    state.enabled = false
    selected.value // 中途依赖切换到 b
    state.a = 2
    state.enabled = true
}) // enabled 虽然恢复，a 确实变化，原消费者仍必须重跑并读到 2
```

不能只按结算时的临时依赖图从 `a` 找消费者，否则会漏掉这个 effect；也不能把所有中途遇到过的依赖合并，否则只有临时分支 `b` 改变时可能误通知。

首版采用“保存计算节点原依赖、结算前恢复”的方案，无需在结算时主动执行 getter：

1. 对批次内需要重新求值的已有 computed，在清理旧依赖前，按节点保存本批次首次重算前的 `Dep[]`，只保存一次。没有执行过的 computed 以首次求值建立的依赖作为基线；不扫描所有计算节点。
2. 批次执行期间仍正常切换到本次求值的依赖，确保连续修改、读取能得到当前结果；快照只用于最终通知，不能代替实时订阅。
3. 结算前，若依赖集合与快照不同，移除临时依赖、恢复原依赖，并把该 computed 及受影响的下游 computed 标为 dirty。仅调整订阅和缓存标记，不调用用户 getter；恢复工作完成后才从净变化属性收集消费者。
4. 依赖集合没有变化时保留当前缓存有效性。已经按最终数据重算且之后未再被写入影响的缓存，不因结束 batch 再次失效。
5. effect 真正重跑或下一次外部读取时，再按最终状态建立新依赖。停止节点不得因恢复而重新订阅；无论正常退出还是抛错，快照都在结算后释放。

恢复依赖时，源属性 Dep 及 computed 消费者 Dep 必须双向一致；恢复导致的失效只沿 computed 传播，不能提前通知普通 effect。若只把 `enabled` 改回初值而没有其他净变化，effect 不执行，但缓存和依赖仍须保证随后修改 `a` 能触发它。这两种分支情形必须独立验收。

### 5.4 异常与异步边界

回调或 setter 抛错时，已经成功的写入仍然保留，并在退出最外层边界时正常结算；内层异常被外层捕获时，继续使用原批次上下文。失败写入本身不产生变化记录，setter 抛错之前成功改过的 backing field 仍需通知。

通知队列继续执行其他有效 effect，最后统一报告错误：只有一个异常时原样抛出；回调与刷新同时失败或多个 effect 失败时，使用 `AggregateError` 保留各异常，回调异常排在最前。不要让 `finally` 中的刷新异常覆盖回调原始异常。异常后深度、上下文、执行标记和队列均可供下一次更新正常使用。

`batch` 不等待 Promise。传入 async 回调或调用 async 类方法时，仅函数返回 Promise 前的同步部分属于批次；原 Promise 原样返回，`await` 后的写入需另写 `batch(() => { ... })` 才能合并。定时器、微任务和生成器后续迭代也不延续这个批次，不把全局深度挂到异步完成时。

## 6. computed：设计第 2.3 节的 .value 迁移

每个 computed 保存四样东西：内部 effect、缓存值、`dirty` 标记和一个供消费者订阅的 Dep。

- 创建时 `dirty = true`，返回一个冻结外壳的 `Computed<T>` 对象；对象的 value 是没有 setter 的访问器，创建和登记对象身份时不读取 value、不执行 getter。冻结仅约束外壳，不冻结、克隆或自动代理 T 所表示的计算结果。
- 每次读取 `.value` 时，先让外层活动 effect 或 React 候选收集器订阅 computed 自己的 Dep；即使命中缓存也要建立依赖。直接复用原读取函数的求值路径，不给外壳额外创建一个 reactive 属性 Dep。
- 若未失效，直接返回缓存；若已失效，运行内部 effect 收集源依赖，成功后保存结果并置 `dirty = false`。
- 源依赖每次实际改变时，内部节点立即置 `dirty = true` 并沿 computed 链传播失效，批次中也不例外；通知阶段不求值。
- getter 抛错时，不把此次结果当作有效缓存，保持失效状态，恢复执行上下文并抛错；下一次读取重试。
- 若同一个 computed 在求值期间又读取自身，利用内部节点的执行标记抛出清晰的循环计算错误。

外层 effect 订阅 computed，computed 的内部 effect 订阅源属性，不能把 getter 中的依赖错误地算到外层节点上。computed 依赖另一个 computed 时，也通过同一个 Dep 机制连接。

```ts
const double = computed(() => state.count * 2)
const label = computed(() => `double: ${double.value}`)

double.value // 首次计算；依赖未变时复用缓存
label.value  // 链式计算同样读取 .value
watch(() => double.value, (next, previous) => console.log(previous, next))
```

将 `src/computed.ts` 当前返回函数的函数体迁入 value getter 或其私有读取函数，保留 `getReadView`、候选缓存、adopt、循环检测及异常后的 dirty 状态。React render 读取 `.value` 时仍使用本次 props 的候选结果，提交后才采纳，被中止的 render 不污染已提交缓存；不能为了实现访问器而另建 computed、提前求值或跳过读取视图。

返回值由函数变成对象后，需要防止现有深层 reactive 再把它当作普通对象、将 value getter 再包装一遍。在 computed 模块用内部 WeakSet 登记本库创建的计算值对象，并提供不导出到包入口的身份判断；`reactive.ts` 在创建代理前识别并原样返回。应满足 `reactive(double) === double`、`reactive({ double }).double === double`，且后者仍通过 `.double.value` 收集计算依赖。不按“存在 value 字段”识别，普通 `{ value: 1 }` 继续遵循正常代理规则，也不自动解包嵌套计算值。

只读约束同时覆盖类型和运行时：给 `.value` 赋值在 TypeScript 中报错，`Reflect.set` 返回 false，严格模式直接赋值抛 TypeError，缓存不能被外部覆写。Model 的引用捕获也必须拒绝将 `double.value` 作为可写位置，见第 10.9.2 节。

“按需”包含 effect 对 computed 的读取：没有消费者读取时，源数据改变只使缓存失效；存在 effect 消费者且批次结算确有净变化时，effect 同步重跑并读取它，因此可能在最外层赋值或 `batch` 返回前重新计算。批次内部显式读取失效的 computed 则立即重算，不等待结算。

首版不做“计算结果相同则跳过消费者”的额外优化。批次内源属性 `1 -> 2 -> 1` 没有净变化，不触发该源的 computed 消费者；源属性从 1 变成 3，即使 `computed(() => count % 2)` 的结果相同，消费者仍可以重跑。区分源数据净变化过滤和计算结果相等优化，不能为比较计算结果提前求值。getter 自动缓存复用完全相同的批次行为。

## 7. reactive 与属性代理

### 7.1 代理身份与深层读取

维护 `rawToProxy` 和 `proxyToRaw` 两个 WeakMap。先查缓存，再创建 Proxy；`proxyToRaw` 同时用于内部赋值比较和判断实际写入对象，不导出 `toRaw` API。

读取嵌套的普通对象、数组或用户类实例时，再返回其 `reactive` 结果。这样能够保持重复读取的身份稳定，并天然处理对象循环引用。普通对象方法保持原函数，响应式类方法经过 batch 包装；调用 `state.increment()` 时，两者的 `this` 都按 JavaScript 调用语义指向代理。

### 7.2 get

1. 检查目标的自有属性描述符，优先满足 Proxy 不变量：不可配置且不可写的数据属性必须返回原值；不可配置且没有 getter 的访问器必须返回 `undefined`。此类固定引用不再强行深层代理。
2. 收集当前对象与属性的依赖，包括读取结果是 `undefined` 的情况。
3. 沿原型链查找属性描述符。若存在 getter，走第 7.4 节的 computed 缓存；否则使用 `Reflect.get(target, key, receiver)`。
4. 若为第 8.2 节范围内的类方法，返回稳定的 batch 包装；对允许代理的返回对象做按需包装，其余值原样返回。getter 返回的函数不当作方法再次包装。

这里必须保留正确的 `receiver`，以便方法和访问器中的 `this.xxx` 仍经过代理。Proxy 不变量是语言约束，不能为了深层响应式改变固定属性的返回值，参见 [ECMAScript Proxy 规范](https://tc39.es/ecma262/#sec-proxy-object-internal-methods-and-internal-slots-get-p-receiver)。

### 7.3 set 与 deleteProperty

每个写入口都进入内部批次边界。普通数据属性赋值时，记录自有属性快照，归一化输入值，再执行 `Reflect.set(target, key, value, receiver)`。仅在成功且属性状态实际改变后登记首次快照，并立即传播 computed 失效；普通 effect 留到最外层退出时结算。比较过程读取原始数据和描述符，不为了比较而执行 getter，也不把内部比较加入用户依赖。

沿原型链存在 setter 时，仍使用带 `receiver` 的 `Reflect.set`，让 setter 中的 `this.xxx = ...` 走正常代理写入。这些写入嵌套于同一边界，通知来自实际改变的响应式字段；不额外强行执行 getter 或无条件再通知一次。只有闭包状态、时间等不可追踪来源的 getter/setter 不承诺自动刷新缓存。

通知前检查本层 `target` 是否为 `receiver` 对应的原始对象，避免原型链上的代理替子对象写入时错误通知父对象。只读属性、没有 setter 的 getter 以及其他失败写入，原样返回 `Reflect.set` 的结果，不发送虚假通知。

删除时，先保存自有属性快照，调用 `Reflect.deleteProperty`，成功删除现有属性后将该 key 纳入日志并传播 computed 失效。删除不存在的属性或删除失败都不通知。不安装 `defineProperty` trap，避免普通赋值经 `Reflect.set` 同时经过两条通知路径。所有退出路径均须释放写入边界，异常按第 5.4 节处理。

### 7.4 getter 自动缓存

getter 缓存以接收对象为 WeakMap 的 key，再按属性名保存 `{ getter, derived }`，其中 `derived` 的类型为 `Computed<unknown>`。

首次访问某个 getter 时创建 `computed(() => getter.call(receiver))`，再读取 `derived.value` 并把计算结果返回给调用方。`src/reactive.ts` 的 getterCache 声明及当前 `entry.read()` 调用一同迁移为 `entry.derived.value`。后续访问相同对象、相同 getter 时复用缓存；若读取时发现 getter 函数已经不同，替换缓存条目。getter 本身不通过 `Reflect.get` 二次查找，避免继承链存在代理时再次进入同一个 getter 缓存；外部仍使用 `state.double` 或 `Store.double`，无需再加 `.value`。

缓存不能放在类原型上让所有实例共用。两个 `Store` 实例虽然共用一个 getter 函数，但它们的依赖、返回值和缓存必须独立。静态 getter 用构造函数代理作为接收对象，复用同一套机制。

第 7.2 节仍收集 getter 所在 key 的读取，因此删除自有 getter 后，消费者会重新读取属性；依赖值的变化则通过 getter 对应的 computed 通知。写入配套 setter 后，其 backing field 的变化负责使缓存失效。

### 7.5 数组只补齐基本属性语义

数组范围限定为普通可变数组，不处理手动锁定部分索引等特殊描述符组合。数组复用相同代理，不重写 `push`、`splice`、`sort` 等方法。补充两个必须处理的情况：

- 写入数组索引可能隐式增长 `length`。记录写前和写后的长度，增长时把索引和 `length` 同时纳入日志及失效传播，不能只等后续的显式 `length` 赋值。
- 缩短 `length` 会隐式删除尾部索引。写入前保存将被截断的自有索引快照，成功后把这些索引和 `length` 一起登记，保证批次内删后重建也与真正的初值比较。只枚举实际自有索引，不按 length 遍历稀疏空洞；枚举和保存被删索引是此操作的额外成本。

只把规范的数组索引字符串当作索引，不能把 `"01"`、`"-1"` 等普通属性误判。删除索引不改变长度，因此不通知 `length`。

数组原型方法不属于类方法自动批处理范围。单独调用 `splice` 等方法时，仍允许每次底层写入后执行 effect；放入显式 batch 或响应式类方法内时，其全部同步写入统一结算。`batch(() => { list.push(x); list.pop() })` 若最终索引、长度均恢复，则不通知；缩短后只恢复 length 会留下空槽，不能认作原索引值也恢复。数组索引和长度读取可以追踪，但不承诺数组方法的搜索身份修正、内部读取屏蔽等框架级兼容行为。

## 8. 类装饰器与方法自动批处理

### 8.1 类与实例代理

`reactive` 接收用户类构造函数时，返回该构造函数的 Proxy，登记类方法处理所需的元信息。静态属性复用属性代理逻辑，并增加 `construct`；以下省略元信息登记细节：

```ts
construct(target, args, newTarget) {
    const instance = Reflect.construct(target, args, newTarget)
    return reactive(instance)
}
```

必须传递 `newTarget`，保留正常的构造和继承语义；不复制或原地修改原型、静态字段和方法。返回前为原始实例登记自动批处理资格，再复用 `reactive(instance)`，避免为方法包装创建第二个代理。类的 `prototype` 是固定引用，按第 7.2 节返回原值，这也保证 `instanceof` 正常工作。

当前编译配置允许类装饰器返回替代构造函数，因而无需源码转换插件或额外注册步骤。依据见 [TypeScript 类装饰器文档](https://www.typescriptlang.org/docs/handbook/decorators.html#class-decorators)；`Reflect.construct` 的 `newTarget` 语义见 [ECMAScript 规范](https://tc39.es/ecma262/multipage/reflection.html#sec-reflect.construct)。首版只验收当前启用的传统装饰器模式，不为其他装饰器体系增加适配层。

### 8.2 方法识别与稳定包装

设计明确要求装饰器分配批处理方法，本方案将同属响应式类的静态方法一起纳入。范围限定为通过 `@reactive` 或 `reactive(Store)` 得到的构造函数及其所构造实例，不把所有 `reactive(object)` 中的函数都当成批处理方法。

- 实例侧识别用户类原型链上的函数值数据属性，排除 `constructor`，遍历止于 `Object.prototype`；包含用户父类继承来的方法。
- 静态侧识别用户构造函数链上的非枚举函数值数据属性，遍历止于 `Function.prototype`。这覆盖标准类静态方法，排除默认可枚举的静态函数字段。
- getter、setter 走各自已有逻辑；实例自有函数字段、访问器返回的函数、数组和内建原型方法不额外包装。类结构以正常声明形式为准，不通过改描述符或改原型来模拟方法声明。

按接收对象维护 WeakMap，再按属性名缓存 `{ method, wrapped }`。原函数取自解析出的数据描述符 `value`，不把继承链上另一个代理返回的包装函数再次当作原方法。相同方法重复读取返回同一包装函数；读取发现原函数身份改变时替换缓存。先满足 Proxy 固定属性不变量，不能对不可配置且不可写的自有函数强行返回替代值。

包装必须使用保留调用时 `this` 的普通函数，核心语义为：

```ts
function wrapped(this: unknown, ...args: unknown[]) {
    return batch(() => Reflect.apply(method, this, args))
}
```

参数、返回值和异常遵循原方法；动态接收对象的调用语义依据 [Reflect.apply 规范](https://tc39.es/ecma262/multipage/reflection.html#sec-reflect.apply)。不捕获并强制绑定创建包装时的 receiver，因此正常调用使用代理，`.call` / `.apply` 使用调用者给定的 this，提取方法后直接调用仍按原方法的 this 规则处理。

`this.otherMethod()` 会进入嵌套批次，由外层方法统一结算；`super.method()` 即使直接调用原方法，也处于外层包装建立的同步边界。方法内显式 `batch` 和外层 `batch(() => store.increase())` 同样只在最外层结束时通知。

### 8.3 使用边界

需要明确的使用边界：

- 代理在构造结束后返回。构造函数中普通字段初始化正常执行，但其中泄漏出去的 `this` 是原始对象。
- `increment() { this.count++ }` 通过代理调用时自动进入批次；字段箭头函数 `increment = () => this.count++` 捕获构造时的原始 `this`，不自动包装，其内部写入不能被可靠追踪。构造时 `.bind(this)` 同理。
- 静态方法与静态 getter 使用 `this.count` 访问响应式静态数据。类体内通过原始类名等引用直接访问原对象可能绕过代理。
- ES `#private` 字段及依赖原生内部槽的类不纳入支持范围；将方法强行绑定到原始对象会破坏公共字段追踪，因此不采用这种兼容方式。TypeScript `private` 关键字声明的普通运行时字段不受此限制。
- 保留普通继承的构造参数、原型、`instanceof` 和继承 getter 行为；不支持运行期间修改原型或混合多个改变构造行为的装饰器。
- 自动包装不跨越异步返回或生成器迭代，遵循第 5.4 节；通过保留的原始实例或原型直接调用方法，不承诺进入自动批次。

## 9. watch：设计第 2.5 节

### 9.1 监听语义

`source` 是绑定函数，必须同步读取依赖并返回当前值；callback 是接收 `(newValue, oldValue)` 的副作用。两者均须为函数，否则立即抛出 `TypeError`。

第三个参数 `options?: WatchOptions` 支持 `immediate?: boolean`。省略 options、传 `undefined`、`{}` 或 `immediate: undefined` 均视为 false；true 时启用首次回调。创建时只读取并保存一次选项值，之后修改 options 对象不改变现有监听，也不补发回调。选项读取不参与 source 的依赖收集。

1. 创建时先执行一次 source，保存结果并建立依赖。默认不执行 callback；`immediate: true` 时，在 watch 返回前同步调用 `callback(initialValue, undefined)`，不会为此再次求值 source。
2. 已绑定的属性在最外层批次结算后有净变化时，先重新执行 source、替换依赖，再调用 callback。没有额外的微任务队列。
3. immediate 首次回调的 oldValue 为 `undefined`；之后 `oldValue` 是上一次成功执行 source 的结果，第一次变化通知使用创建时的读取结果。成功取得 `newValue` 后、调用 callback 前更新保存值和初始化标记，确保 callback 抛错或同步触发其他变更时，后续通知仍从本次成功读取的值继续。
4. **不比较 source 的新旧返回值来决定是否回调。** 设计要求按绑定属性变化通知，因此 `watch(() => state.count % 2, cb)` 在 count 从 1 变为 3 时仍调用 `cb(1, 1)`；无返回值的 source 也照常通知。已有监听的源属性在 batch 内 `1 -> 2 -> 1` 没有净变化，source 和 callback 都不重跑；immediate 只决定创建时是否回调，不改变后续净变化规则。
5. 对象返回值保留引用，不深拷贝、不自动遍历深层对象。`watch(() => state.user, cb)` 只监听 user 引用；要监听姓名，应读取 `state.user.name`。若 source 读取嵌套字段后返回同一个代理，newValue 与 oldValue 可以是同一对象，两者都不能当成历史快照。

```ts
const changes: Array<[number, number]> = []
const stop = watch(() => state.count, (next, prev) => changes.push([next, prev]))
// 假设 count 初始为 1，此时 changes 为空。
batch(() => { state.count = 2; state.count = 3 }) // [[3, 1]]
batch(() => { state.count = 4; state.count = 3 }) // 仍为 [[3, 1]]
state.count = 5 // [[3, 1], [5, 3]]
stop()
```

```ts
const state = reactive({ count: 1 })
const changes: Array<[number, number | undefined]> = []
const stop = watch(() => state.count, (next, prev) => changes.push([next, prev]), { immediate: true })
// watch 返回前，changes 已是 [[1, undefined]]。
state.count = 2 // [[1, undefined], [2, 1]]
batch(() => { state.count = 3; state.count = 2 }) // 没有新增回调。
stop()
```

在 batch 内创建 `immediate: true` 的监听，也立即执行 source 和首次 callback，读到创建时的当前值，不等批次结束；首次回调不会因之后数据回退而撤销。后续通知仍按整个批次的净变化结算，初始化回调与结算通知是两个不同阶段，不另建该监听的批次比较基线。

source 内的 computed/getter、分支切换、属性删除、嵌套对象和数组读取均沿用既有内核行为；不另建值比较、批次日志或 computed 求值路径。watch 选项继续只支持 immediate，不加 `deep`、比较器、刷新时机选项，也不解释 callback 返回的函数为清理函数。异步任务由调用方管理，watch 不等待 Promise，不自动取消请求；依赖仍只收集到第一次异步让出执行之前，建议 source 保持同步。

### 9.2 内部实现与依赖隔离

`watch.ts` 创建一个普通 EffectNode，保存创建时归一化后的 immediate 布尔值。节点回调先记录执行前的 initialized 和旧值，再依次执行“source 求值、保存新值、设 initialized = true、按执行模式决定是否调用 callback”；整个步骤仍处于节点的 running 保护内。初始化与通知复用 `runEffect`，不能以保存值是否为 `undefined` 判断初始化。

首次初始化仅在 immediate 为 true 时回调，oldValue 显式传 undefined；后续队列通知总是回调并传入执行前保存的值；内部静默刷新始终跳过 callback，即使 immediate 为 true 也不例外。选项在非追踪上下文中读取，首次 callback 与后续 callback 共用下面的隔离入口，不再单独裸调用一次 callback 来模拟 immediate。

复用 `effect.ts` 的内部 `untracked(fn)`：保存当前收集上下文、暂时清空、执行 fn，并在 `finally` 恢复。包括 immediate 首次调用在内的 callback 都必须由它包裹；不要把 `source()` 与 callback 一并放进公开 `effect` 而收集全部读取，也不要直接在恢复了外层 effect 上下文之后裸调用 callback。这样在另一个 effect 内创建 watch 时，callback 的读取既不会成为 watch 的依赖，也不会误入外层 effect；callback 中显式创建的新 effect 仍能建立自己的收集上下文。

例如 source 只读取 count，而 callback 读取 message，则修改 message 不得触发 watch。callback 同步修改自己的 source 时，当前节点仍为 running，沿用 effect 的直接自触发抑制；修改其他监听源则作为新批次正常入队，不改变全局队列的去重和错误聚合规则。

保留 `stopEffect` 的模块内部导出，供 watch 和 React 适配使用，不从包入口导出。停止函数清理依赖与待执行项，重复调用无副作用；回调执行期间停止后，后续读取也不能重新订阅。

为了支持 `useWatch`，实现一个不对外导出的监听句柄，保存 node、source、callback、immediate、initialized 和当前值，并提供初始化、仅替换闭包、静默刷新绑定与 stop。“仅替换闭包”不能清理依赖、执行 source 或推进旧值，供 props 提交前安装最新闭包使用。公开 watch 完成初始化后只返回 stop。静默刷新用于提交后补齐尚未重新求值的绑定，不能再次触发 immediate；它对已排队通知和正在执行节点的处理见第 10.5～10.6 节。

### 9.3 错误与旧值推进

| 情形 | 行为 |
| --- | --- |
| 首次 source 抛错 | 停止节点、清除订阅，原样抛出，不能留下取不到 disposer 的监听 |
| immediate 首次 callback 抛错 | watch 尚未返回 disposer，必须停止节点、移除待执行项并恢复上下文后抛出；已发生的写入按核心规则保留 |
| 更新时 source 抛错 | 不调用 callback、不覆盖上一次成功值；沿用 effect 对本次已读取依赖的保留方式，之后相关属性变化可重试 |
| 后续通知的 callback 抛错 | 新值已保存，节点保留；队列继续处理其他节点，最后按第 5.4 节抛出单个错误或 AggregateError |
| 一个通知内停止另一已排队 watch | 后者从队列移除，callback 不执行 |
| callback 读取其他响应式属性 | 读取不产生隐式订阅；同步异常也必须恢复收集上下文 |

## 10. React 集成：设计第 3 节

### 10.1 独立入口与可选依赖

`@canlooks/reactive/react` 公开 `ReactiveComponent`/`RC`、`ReactiveFunctionComponent`/`RFC`、`ReactiveClassComponent`/`RCC`、`useReactive`、`useWatch`、`Chip`、`AsyncChip`、`chip`、`strictChip`、`asyncChip`、`asyncStrictChip`、`useModel`、`Model`、`defineModel` 和 `useLoading`，共十八个运行时导出。原局部状态 Hook `useState` 已重命名为 `useReactive`，不再单独导出。Strict 组件通过 `Chip.Strict`、`AsyncChip.Strict` 访问，不额外增加 `StrictChip` / `AsyncStrictChip` 顶层导出；接口和辅助类型只作类型导出。核心 API 仍从根入口导入，根入口不转导 React API，核心 `.d.ts` 也不引用 React 类型。

继续支持 React 18.3 与 19，使用原生 `useSyncExternalStore`，不引入兼容 shim。保留 `package.json` 已有的可选 peer：

```json
{
  "peerDependencies": {
    "react": "^18.3.1 || ^19.0.0",
    "@types/react": "^18.3.0 || ^19.0.0"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true },
    "@types/react": { "optional": true }
  }
}
```

React 与类型依赖继续作为开发依赖供本仓库编译测试；使用 React 子入口的应用负责安装 React，TypeScript 应用还需对应类型。React DOM 只参与测试，不成为库的运行时依赖或必需 peer。npm 不会自动安装标为 optional 的 peer，配置依据见 [npm peerDependenciesMeta 文档](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#peerdependenciesmeta)。普通核心消费者无需安装 React 及其类型；误用 React 子入口而未安装 React 时，交由模块解析报告缺失依赖，无需在核心中增加动态探测或兜底加载。

保留 `exports["./react"]`：import.types 指向 `dist/esm/react/index.d.ts`，import.node 指向 `dist/node-react.js`，import.default 指向 `dist/esm/react/index.js`，require 分支使用 `dist/cjs/react/index.d.ts` 和 `dist/cjs/react/index.js`。根入口 Node 桥接继续转导五个核心 API，React 桥接扩为上述十八个 API；两者通过相对导入共用同一份 CJS 核心及 reference 捕获上下文。浏览器的两个 ESM 入口也必须共用同一模块图，不能各自打包一份依赖表。

现有 build 脚本已递归处理 JS 和 `.d.ts` 并保留目录结构，新增文件直接进入该流程；根目录 `dist/cjs/package.json` 继续标识整个 CJS 子树。本次更新 React 桥接的显式导出清单及产物断言，不重复改造构建。若后续启用打包，React、React 子路径及核心共享状态均不能被重复内联。

### 10.2 render 收集与已提交订阅分离

不能在组件函数或类 render 中调用公开 `effect` 来建立永久订阅：React 可能重复执行、暂停或放弃本次渲染，未提交的 render 不一定有卸载清理机会。方案在现有内核上增加以下内部能力，不把 React 概念带入核心公开 API：

| 扩展点 | 具体职责 |
| --- | --- |
| 临时依赖收集器 | `captureDependencies(fn)` 返回执行结果和本次读取的 Dep/读取版本；只记录候选，不把组件节点加入 Dep |
| 收集上下文隔离 | track/trackDep 支持普通节点或临时收集器；嵌套 runEffect/computed 必须保存、替换并恢复上下文，使外层只订阅 computed 的消费者 Dep |
| 提交依赖 | 内部 `replaceDeps(node, deps)` 在 commit 后替换已提交订阅；未提交候选不能清理旧订阅 |
| 只通知的节点 | EffectNode 增加内部可选 notify；队列对这类节点在非追踪上下文中调用 notify，不调用 runEffect、不清空它的已提交依赖 |
| 读取版本 | 用 `WeakMap<Dep, number>` 记录失效版本，实际属性变化及下游 computed 失效时递增；即使 Dep 暂无已提交消费者，也要更新已有 Dep 的版本 |
| 通知来源与提交收尾 | props 差异携带 owner/commit 标记，传播经过 computed 时保留来源；在收集完消费者、刷新队列前允许提交候选依赖及确认本次 render 已覆盖的通知 |
| 候选读取视图 | props 渲染视图及其中的 computed 临时缓存与已提交状态分开；未提交记录可直接丢弃，见第 10.6 节 |

普通 effect/watch 继续执行 runEffect；computed 继续走立即失效路径。带 notify 的观察节点仍通过同一个 pending Set，在批次净变化筛选后入队，沿用有效性检查、幂等停止和错误处理。notify 只调用 React 提供的 listener 或 forceUpdate，不主动求值 source 或调用组件；React 可能因此同步安排一次渲染与提交。每个组件实例有独立控制器，多个实例不共享依赖或卸载状态。

普通 effect/watch 的 running 自触发抑制保持不变，但 notify 节点必须保留通知期间新批次产生的更新：例如 listener 使 React 提交，layout effect 又写入相同依赖时，应再次入队或标记待通知，在当前 notify 返回后处理，不能因 running 而直接丢弃。停止操作同时取消这些待通知标记；React 回调即使同步触发提交也不得破坏正在遍历的订阅快照。

区分两种版本：读取版本用于识别“这次 render 之后依赖是否失效”，控制器的通知版本只在净变化通知时推进。前者用于提交窗口的保守重试，不把 `1 -> 2 -> 1` 变成对全部已挂载组件的主动通知。必须把读取版本沿 computed 消费者链传播，即使 computed 已经 dirty，也不能丢掉后续失效；第 5.3 节的依赖恢复仍先于最终消费者收集。

一次 render 的候选依赖、读取版本和快照 token 应属于该次尝试，不在 render 中覆盖控制器的 committedDeps。捕获结束无论成功、抛错或抛出 Promise，都在 finally 恢复收集上下文；失败候选不提交。已有组件继续保留上一次提交的订阅，首次挂起且从未提交的组件不持有活动观察节点。服务端也只进行临时收集。

### 10.3 函数组件与统一分发

按设计第 3.1 节，`ReactiveComponent` 包裹函数组件时自动增加 memo。统一由 `ReactiveFunctionComponent` 实现，使 RC 与 RFC 行为一致：先为原组件生成包含依赖收集和订阅 Hook 的 `ObserverComponent`，再返回 `React.memo(ObserverComponent)`。memo 在组件包装工厂中只创建一次，不在 render 或 Hook 内重复创建；调用方无需再手工包裹 memo。

内层 ObserverComponent 的执行顺序如下，`useSyncExternalStore` 必须属于 memo 内部的响应式组件：

1. 用 React Hook 为当前实例保存控制器；创建控制器本身不订阅、不执行用户副作用。
2. 先无条件注册适配器的 Hooks，通过 `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` 把控制器接入 React，并注册提交逻辑。subscribe 身份在同一实例内稳定；getSnapshot 可以按 render 绑定本次尝试，只读取版本并返回稳定、不可变的快照 token，不执行组件、不重新收集依赖、不每次分配对象。
3. 为本次 React 原始 props 建立 render 视图，在该视图内用临时收集器执行原组件函数，传入实例稳定的只读 props 代理，得到 JSX 和本次候选。原组件的 Hooks 仍遵守固定调用顺序；退出时恢复读取视图，不能在订阅通知、getSnapshot 或 effect 中再次调用组件函数。
4. 在本次 render 返回前，将候选交给第 2 步的局部闭包。初始快照与候选未过期时的快照必须一致，避免仅因“收集完成”制造一次更新；候选过期时使用预先分配且稳定的失效 token。候选不能写进其他已提交 render 正在读取的共享引用。
5. 在提交阶段按第 10.6 节的顺序协调 props 发布、useWatch 闭包和候选订阅，再比较候选读取版本。本次 render 已覆盖的自身 props 发布需要精确确认，不能误判为新的外部更新。首次 subscribe 时也做版本复查，覆盖“render 后、订阅建立前”以及“从旧分支切到尚未订阅的新分支”的变更；真正未覆盖的变化使快照失效并请求 React 重读。不得靠再次执行组件来补收集。
6. 净变化通知只推进控制器通知版本并调用 React 提供的 listener。后续渲染完全交给 React；卸载/取消订阅移除节点与 listener，重复清理安全。StrictMode 的重新 setup 能创建或重新连接有效节点，不能复用已经永久停止的节点。

这是本库的适配方案；采用稳定快照、取消订阅与提交前一致性检查的依据见 [React useSyncExternalStore 文档](https://react.dev/reference/react/useSyncExternalStore)。批次结束时保证通知已交给 React，不承诺 DOM 已同步更新；React 可能合并更新或额外 render，验收应区分库通知次数与最终 DOM。

自动 memo 使用 React 原始 props 的默认比较，不把每实例稳定的 props 代理交给外层 memo 比较，不传自定义 comparator、不深比较代理对象，也不增加比较器选项。React 默认逐个使用 `Object.is` 比较 props：相同 props 下可跳过父组件引起的重渲染；对象或函数换成新引用仍算变化。组件自身的 React state 和消费的 context 更新仍可触发渲染。memo 是性能优化，不保证组件永远不被额外调用，依据见 [React memo 文档](https://react.dev/reference/react/memo)。

外部响应式依赖更新通过内层 useSyncExternalStore 的 listener 和快照变化驱动，不能因为 props 相等被拦截。即使父组件传入的 store 代理引用始终不变，只要 render 读取的字段有净变化，组件仍须读到新值；库的 useReactive 局部代理按同样方式更新。父级 props 替换则已经由 React 发起渲染，其提交通知按第 10.6 节只跳过该组件已覆盖的更新，仍通知 watch 和其他消费者。memo 跳过某次父级更新时保留原 committedDeps，不清理订阅或强制重新执行 source；实际进入新一轮 render 时仍按上面的流程收集并提交依赖。包装顺序是 `memo(ObserverComponent)`，不能先 memo 原组件、再把返回的 memo 对象当普通函数调用来收集依赖。

`ReactiveComponent` 先查本库的包装缓存，命中则原样返回；未命中时根据 `component.prototype?.isReactComponent` 判断类组件，其余受支持的普通函数走函数路径，不以函数名或是否存在 prototype 判断。函数路径的 WeakMap 记录“原函数 → 最终 memo 组件”，同时登记“最终 memo 组件 → 自身”，并由 RC/RFC 共用。因此 `RC(Component) === RFC(Component)`，重复调用及 `RFC(RFC(Component))`、`RC(RFC(Component))` 都不增加 memo 或观察器层级。缓存检查必须在拒绝对象形式输入之前完成，因为本库返回的 memo 组件本身就是对象。明确组件类型的 RFC/RCC 仍对错误类别给出清晰错误。

内层 ObserverComponent 与外层 memo 组件均设置可读的 displayName。只追踪原组件函数体同步执行期间的读取，React 随后执行的独立子组件需各自包装；memo 不扩大依赖收集范围。

本阶段接收普通同步函数组件与 React.Component/React.PureComponent 类，另允许本库已返回的组件走幂等缓存。用户预先创建的 `memo`、`forwardRef`、`lazy` 等对象形式输入不自动解包，不把它们与本库自己的 memo 返回值混为一类。React 18 的 ref 转发、泛型函数组件的高阶类型保真、React Compiler 专门适配和异步 Server Component 留待独立设计，不通过宽泛类型声明假装支持。

### 10.4 类组件与装饰器

`ReactiveClassComponent(Target)` 返回继承 Target 的类，兼容 `@ReactiveComponent`、`@RCC` 和直接调用；保留构造参数、继承静态成员、contextType、原有 React state，以及 ref 指向的类实例。自动 memo 只应用于函数组件分支；类组件的 props 槽读取与 shouldComponentUpdate 对监听提交的影响按第 10.6 节处理。不对 React 组件实例使用 `reactive(instance)`，不把 React 自身字段、setState 或生命周期自动变成批处理方法。

在 `super(...)` 完成后，为当前实例保存并包装原 render 与挂载/更新/卸载方法，保留 this、参数和用户生命周期。实例级包装能覆盖正常原型方法和实例函数字段，不修改 Target.prototype，也不让不同实例共用控制器；遇到禁止替换的自有描述符应明确报错。

| 阶段 | 包装逻辑 |
| --- | --- |
| render | 调用原 render 收集本次候选，不改变 committedDeps；异常直接交还 React，不能留下活动收集上下文 |
| componentDidMount | 建立 props 初值和已提交订阅，调用原方法；复查 render 到挂载之间的版本，必要时请求补渲染 |
| componentDidUpdate | 按第 10.6 节发布 props 差异并提交本次 render 依赖，再调用原方法，完整转交原始 prevProps、prevState、snapshot；调用原方法后复查版本 |
| 收到净变化通知 | 仅在已挂载且仍有效时调用 `forceUpdate()`，不直接调用 render；PureComponent/shouldComponentUpdate 不得屏蔽外部依赖更新 |
| componentWillUnmount | 先标为未挂载并清理观察节点，再调用原方法；用户清理抛错也不能阻止库订阅释放 |

getSnapshotBeforeUpdate 沿用继承行为；shouldComponentUpdate 仅增加第 10.6 节明确的 props 监听提交条件。挂载方法抛错需保证之后仍可清理，StrictMode 的 mount/unmount/mount 能重新订阅。forceUpdate 会绕过 shouldComponentUpdate，生命周期必须成对清理，依据见 [React Component 文档](https://react.dev/reference/react/Component)。

类路径通过提交后的版本复查补齐订阅窗口，不宣称具有函数路径 useSyncExternalStore 的全部并发一致性保证；不引入 React 私有 Fiber 接口。首轮验收普通更新、PureComponent、StrictMode、未提交 render 与挂载窗口。若后续要求类组件也在并发提交前阻止所有旧快照，应另行设计桥接，而不是在本方案中隐含承诺。

### 10.5 局部状态与监听 Hook

`useReactive(initialState)` 内部使用 React 原生 useState 的惰性初始化保存 `reactive(initialState)`，对外只返回对象。相同挂载中的后续 render 忽略新的 initialState，不重建、不覆盖用户已修改的值；卸载后重新挂载重新初始化。对象/数组及嵌套值沿用 reactive 的身份和代理规则，既不克隆也不释放业务对象；两个组件显式传同一个 raw 对象时会共用代理，这是显式共享而非隔离保证。普通内联对象初始化则各实例独立。

`useReactive` 是局部响应式状态 Hook 的正式名称。该 Hook 本身不使普通组件自动响应；需要视图随字段变化时使用 RC/RFC，或把读取放入 Chip/Model。`useWatch` 可用于普通函数组件，不要求使用响应式组件包装。

```tsx
import { RFC, useReactive, useWatch } from '@canlooks/reactive/react'

const Counter = RFC(() => {
    const state = useReactive({ count: 1 })
    useWatch(() => state.count, (next, prev) => console.log(prev, next))
    return <button onClick={() => state.count++}>{state.count}</button>
})
```

`useWatch` 用第 9 节的内部监听句柄实现，支持相同的第三参数和 immediate 默认值；“立即”指监听在提交后的 setup 中建立时执行，不能在 render 阶段执行副作用。确定以下提交语义：

- render 只记录这次提交待使用的 source/callback 和创建选项，不创建 watch，不执行 source 或 callback，也不在 render 中覆盖已运行监听的闭包。
- 浏览器在 layout effect 的首次 setup 建立监听，以此时的 source 结果作为基线。默认不执行 callback；immediate 为 true 时，在同一次 setup 中同步调用 `callback(initialValue, undefined)`。挂载前的变化折入初值，不补发历史通知；服务端即使设置 immediate 也不建立监听或执行 callback。
- setup 先保存可停止的内部句柄，再执行初始化，以便 immediate callback 触发同步更新时仍能管理该节点。source 或首次 callback 抛错时，立即 stop、清空句柄再将异常交给 React，不能等待一个尚未成功注册的 cleanup。
- 每次成功提交在同一个句柄上更新 source/callback。RC/RFC 的 props 已是响应式来源，读取 `props.count` 或按 props 选择 store/字段的 source 应因相关 props 变化正常回调，不能先静默求值并覆盖旧值。包装组件由第 10.6 节统一协调闭包更新与 props 通知；只有尚未被相关通知执行、也未排队的监听才静默刷新，以补齐 context 或其他普通闭包值改变带来的新依赖。普通未包装组件中的非响应式 props 仍只是闭包值。不要求用户为内联函数加 useCallback，也不因函数身份改变而无条件 stop/create。
- immediate 只控制每次新监听的初始化；同一活动监听中的普通重渲染、静默刷新、options 对象身份变化或 immediate 从 false 切为 true，都不补发首次回调、不重建监听。后续因生命周期 cleanup 而新建监听时，使用当次已提交的创建选项。
- 静默刷新不能吞掉已入队的通知：若 node 已在 pending Set，保留旧值基线和队列项，下一次调度使用最新已提交闭包完成通知。若 node 正在运行，记录待刷新请求，退出当前执行后再应用，不能递归 runEffect 同一节点；期间已 stop 的节点丢弃待刷新请求，不能重新激活。这能避免同一写入先触发 React 提交、后执行 watch 时，oldValue 被提前改成 newValue。
- callback 中读取的 props/状态来自最近一次已应用提交的闭包，响应式读取仍由 untracked 隔离。被中止的 render 不能泄漏未提交的 props 给现存 callback。
- 单独的生命周期 cleanup 停止当前监听并清除句柄；StrictMode 再次 setup 时重新建立，默认仍不执行首次 callback，immediate 为 true 则可再次执行 `callback(currentValue, undefined)`。这是两次不同监听的初始化，不使用跨 cleanup 的“已经执行过”标记压掉第二次调用。更新闭包的每提交 effect 不承担每次 stop 的职责；刷新求值抛错时保留可清理状态并交给 React，响应式通知中的异常沿用核心错误路径。

此处使用 layout effect 是为了在提交后尽早完成本地绑定，setup 中是否执行首次 callback 由 immediate 决定；用户 source 应简短、同步、无副作用，开启 immediate 后需考虑开发模式重建监听可能重复调用 callback。服务端使用不执行 setup 的等价 effect 路径，避免布局 effect 警告。执行与清理边界见 [React useLayoutEffect 文档](https://react.dev/reference/react/useLayoutEffect)。

### 10.6 响应式 props：设计第 3.3 节

工作区中的 `props.ts`、`observer.ts`、两个组件包装器和 `test/react.tsx` 已有以下主体路径。本次以保留这些契约、扩展与新 API 的组合验收为主；如果基线验证暴露差异，按以下顺序修正，不以静默复制 props 或全局停用通知代替。

| 3.3 要求与复用点 | 本次落地检查 |
| --- | --- |
| `useWatch(() => props.count, cb)`，JSX 不读取 count | PropsCell 字段差异在提交时驱动 watch，沿用旧值及最新已提交闭包 |
| props 自带 React 更新与响应式通知重合 | Observer 精确确认自己的 owner/commit 来源及读取版本，watch 和其他组件仍正常通知 |
| 类组件 `this.props` | 保留原始 React 引用和历史 prevProps，监听按整个 props 槽通知 |
| Chip/Model 使用父组件的响应式 props | 它们有独立 owner，父组件的同源确认不得吞掉片段或表单的真实通知 |
| Model/useLoading 的事件函数与 props watcher 联动 | 统一提交阶段先安装最新闭包，再发布 props；中止 render 不改写活动处理函数 |

#### 10.6.1 数据边界与读取方式

props 自动响应式覆盖 RC/RFC 及 RCC 的用户代码，不修改未包装组件，不新增公开 Hook。其目的是让 React 交付的新 props 能通知响应式消费者，props 的修改权仍属于父组件。不能在 render 中 `Object.assign(reactiveProps, nextProps)` 后同步执行 watch；React 允许重试或放弃 render，props 与副作用必须按提交边界处理。约束依据见 [React 渲染纯度与 props 不可变约定](https://react.dev/reference/rules/components-and-hooks-must-be-pure#props-and-state-are-immutable)。

函数组件每个挂载实例保存一个 `PropsCell`：包含已提交的原始 props 快照、稳定的只读代理、字段依赖和已提交版本。代理使用独立且可扩展的空对象作为 Proxy target，读取转发到选定快照；不修改 React 传入对象，也不直接把可能被冻结的 props 当作可写 reactive target。

- 本次 render 通过局部读取视图向代理提供本次 incomingProps；退出时在 finally 恢复上下文。视图由该次 render 持有，不能把共享的 committedProps 提前改成新值。
- render 外的监听、事件回调读取最后一次已提交快照。代理身份在同一挂载中稳定，但它是当前值视图；需要历史值时使用 watch 的 oldValue，不能把保存代理引用当成保存了历史 props。
- get 按 `(PropsCell, key)` 收集依赖，包括不存在的字段。提交差异比较自有键是否存在及字段值的 `Object.is`；新增、删除、NaN、+0/-0 均有明确结果。这里按 React props 原始值比较，不套用核心 raw/proxy 归一化来改变 memo 的引用语义。
- props 使用浅层语义：嵌套对象、函数、React element 和 children 保留原引用，不自动深代理、包装函数或遍历对象。已是本库响应式代理的字段值继续保留其深层追踪能力；普通嵌套对象内部被原地改动不在 props 通知契约内，应由父级换引用。
- 只读代理拒绝顶层赋值、删除及 defineProperty/setPrototypeOf/preventExtensions 操作；ownKeys、has、描述符读取保留正常读取用途，虚拟描述符须满足 Proxy 不变量。结构枚举的依赖追踪仍不扩展到核心契约之外。
- source 必须实际读取代理，例如 `useWatch(() => props.count, cb)`。先 `const { count } = props` 再监听 `() => count` 只捕获普通值；render 中读过 count 不等于该 watch 已订阅 count。父级提供的 props 字段类型与 JSX 调用方式不变。

#### 10.6.2 候选计算与提交顺序

仅延迟通知还不够：已有 `computed(() => props.count * 2)` 可能缓存着旧 props 的结果。本轮 render 的 incomingProps 与已提交值不同时，不能直接复用这份缓存，也不能先使全局缓存和依赖图改成未提交状态。

在该 render 的读取视图内，为所读取的 computed 链使用独立的候选缓存与依赖记录：按需求值、同一视图内复用结果，源读取使用该视图的 props；不通过普通 runEffect 清理已提交的 computed 依赖。成功提交时，仅采纳源版本仍匹配的候选计算，按依赖顺序发布缓存和依赖；失配时保留失效状态并请求必要的重读。未提交、抛错或挂起的候选直接丢弃。props 没有改变时继续复用原计算缓存，不扫描无关 computed。

组件控制器增加统一的提交协调阶段，位于用户 layout effect 和原类 componentDidMount/componentDidUpdate 的业务逻辑之前。函数中的 useWatch 在 render 时仅把本次配置登记到本次候选中，由协调器更新已有句柄，避免依赖各 Hook 自己的 effect 执行次序：

1. 确认这是本次成功提交；先应用本次登记的内部已提交闭包，再为已有监听替换 source/callback，保留之前的依赖和 oldValue，不先静默求值。新增 Model/useLoading 也在此更新事件配置和 fn，确保 props watch 同步调用它们时不会拿到上次提交的闭包。
2. 将 incomingProps 发布为已提交快照，在同一个内部 batch 中登记全部字段的旧状态与当前状态、立即失效相关计算，并给变化附带 `{ owner, commitId }` 来源。首次挂载只建立初值，不把每个字段当成一次变化。
3. 沿用核心净变化结算和 computed 依赖恢复，先依据旧依赖图收集应通知的 watch/effect 和组件；否则先换依赖可能漏掉 props 分支切换的消费者。
4. 在收集消费者之后、执行通知队列之前，完成候选计算与 render 依赖的提交，并按第 10.6.3 节确认所属组件已覆盖的 props 通知和读取版本。此阶段只操作内部状态，不执行用户回调。
5. 正常刷新通知队列。已有 props watch 用最新闭包读取已提交值，以之前保存的值作为 oldValue；一次提交中多个绑定字段变化只通知一次。callback 仍由 untracked 隔离。
6. 为本次新建的 useWatch 建立当前值基线，按 immediate 决定首次回调；已有监听若本次已经求值或仍在队列中，不再静默刷新。其余只因普通闭包值变化而需要换绑定的监听，最后再静默刷新。

包装组件内 useWatch 的 layout setup 与协调器共用同一监听句柄，并记录本次提交的初始化/刷新状态，不能各自再执行一遍 source 或 immediate callback；生命周期 cleanup 仍独立负责 stop。普通未包装组件沿用独立的 Hook 提交路径。新监听始终在本次 setup 中完成初始化，即使外层 batch 尚未结束，也不延后 immediate；下述延迟收尾只约束候选发布与已有监听的静默刷新。

内核需提供“结算收集完成、队列刷新之前”的内部收尾入口，把第 4 步插入现有结算流程；不另建微任务通知队列。若 React 提交嵌套于尚未结束的公开 batch，继续沿用最外层初值，并按 owner 保存最后一次成功提交的候选；以上收尾与静默刷新等待该批次结算，不能因为当时 pending Set 还空着就提前覆盖旧值。所有失败路径仍清理临时记录、恢复上下文，遵守第 5.4 节的异常聚合规则。

当前 `onBatchSettled` 已承担上述收尾。新增的闭包登记放在 React 层：把 `useCommitEffect` 提取到 `react/commit.ts`，提供内部 `useCommittedRef`，并在 `RenderAttempt` 中增加只赋值、不执行用户代码的提交登记列表。Observer 在第 1 步统一应用；普通未包装组件使用独立的提交 effect。render 只保存候选，不能每轮直接写共享 `ref.current = fn`。这一扩展与现有 CommitWatch 共用提交顺序，但不能使 Watch 重复初始化，也不能要求核心识别 React Hook。

Model/useModel 的事件有效标记、useLoading 的连接标记也应在第 1 步就绪，再执行 props 通知及新 watch 的 immediate 回调，避免首次 `useWatch(..., { immediate: true })` 调用 load 时误判尚未挂载。此阶段仅设置内部标记与配置；重连后需要补发的公开计数变化进入正常批次，不能在内部候选发布中裸调用用户回调。普通组件则按 Hook 注册次序先连接，再运行调用方后续的 layout/passive effect。

例如 count 已提交为 1，父级把它改为 2 后，即使 JSX 没有读取 count，设计中的 useWatch 也应收到 `(2, 1)`，callback 内读取 props.count 得到 2。把同一个 source 改为 `() => props.count % 2` 时仍遵循 watch 的依赖变化语义；派生结果相同不能作为跳过回调的理由。

#### 10.6.3 只消除本次 props 导致的重复渲染

React 已经用新 props 渲染了所属组件，但 props 发布仍须通知 watch、effect、computed 和其他消费者。因此去重应基于消费者身份与变化来源：

- props 提交沿依赖图携带 owner/commitId，包括经过 computed 的间接通知。仅当某个组件观察节点属于该 owner，且这次成功 render 已覆盖对应 props 快照与候选计算时，才不再为这部分变化调用 listener/forceUpdate。
- 不能全局暂停 track/trigger，不能丢弃整个 props Dep 的消费者，也不能在提交后无条件从 pending Set 删除所属组件。为待通知节点累计来源集合；多来源经过同一 computed 时保留各来源，不能被原来的整轮 visited 去重误删。
- 同时来自普通 store、局部状态或另一组件 props 的变化仍要通知；props watch 回调自身又写入状态也属于普通新变化，不能继承本次 props 来源而被抑制。
- 还要确认本次 render 捕获的读取版本：自身 props 提交引起的字段/计算失效，若已由本轮候选覆盖，则更新其对应的确认记录，保持该组件的 getSnapshot token 不因同源发布而改变。其他外部依赖的版本差异继续触发一致性重读；只跳过 listener 而让 getSnapshot 检测成过期，仍会造成第二次渲染。
- 原来已经排队的外部更新不得被新的 props 确认抵消；同一实例多个提交只确认实际成功提交且与当前候选匹配的版本。StrictMode 重放相同提交不重复发布字段差异，重新建立 useWatch 的 immediate 行为仍按第 10.5 节执行。

验收中的“不重复渲染”指：仅一次父级 props 变化、监听回调不再写数据时，库不会再追加一轮响应式组件更新。React 开发模式的试探 render、真正的外部数据竞争以及 callback 主动写入状态导致的更新需要分别统计，不能混入这项去重指标。

#### 10.6.4 类组件的 props 槽适配

类组件不能把 this.props 永久替换成稳定 Proxy：React 会反复赋值并检查它与自身 props 快照的引用关系。保留构造函数收到的原始 props，在 super 完成后为实例安装可恢复的 props 槽访问器；setter 接收 React 的原始引用，仅记录当前交付值，不触发监听。React 正常读取该槽时仍得到原始引用，不修改其 props 对象、不代理整个组件实例、不访问 Fiber 私有字段。

用户 render 的读取视图使用本轮 props；effect/watch/computed 的订阅读取上下文使用最后已提交快照，并追踪稳定的 props 槽 Dep。读取视图上下文与依赖收集分开，untracked callback 仍读取已提交值；向 React 调用 listener/forceUpdate 前退出订阅读取上下文，避免 React 自身看到替换后的引用。getter 的分支必须按内部执行上下文选择，不能用调用栈字符串猜测调用者。

这样 `watch(() => this.props.count, cb)` 可以跟踪 this.props 的更新。类路径按整个 props 槽的浅层差异通知，而函数代理按字段通知：类 source 读取了 this.props 本身，其他 props 字段变化时也允许重跑 source 并传入相同 count，不增加返回值相等过滤。局部捕获原始构造参数或先保存普通 props 快照再监听其字段，不具有自动跨快照绑定能力。类 watch 仍需由用户在卸载时停止；useWatch 的自动生命周期只适用于函数组件。

类的 props 差异在 componentDidMount/componentDidUpdate 的协调阶段发布，原方法收到的 prevProps 仍是原始历史快照。为避免显式 shouldComponentUpdate 返回 false 后没有 componentDidUpdate、导致已订阅的 props 更新永远不发布，包装的 shouldComponentUpdate 在“存在活动 props 槽消费者且 props 有浅层变化”时放行本次正常更新；其他情况沿用用户判断，PureComponent 则保留原 props/state 浅比较。原判断函数仍按原参数调用，异常不隐藏。这是新增 props 监听对旧方案的明确调整，不通过后续 forceUpdate 补出第二次 render。

构造期不创建永久监听；不可替换的 props 槽描述符应报清晰错误。实施必须验证 React 开发模式没有 props 引用不匹配警告，ref 仍指向原类实例，父级 props 更新只发生一次正常渲染，卸载及 StrictMode 重连不会重复发布。类的并发一致性范围仍遵循第 10.4 节，不把该访问器当成完整的并发 store 适配器。

### 10.7 StrictMode、SSR 与能力边界

开发模式可能重复 render、初始化与 effect setup/cleanup，不能把“只保留一个活动订阅”写成“初始化函数绝对只调用一次”。局部对象初始化须无外部副作用；每次清理都必须配对，未提交候选不占据 Dep 订阅。依据见 [React StrictMode 文档](https://react.dev/reference/react/StrictMode)。

普通 SSR 提供稳定的 getServerSnapshot 初始 token（例如 0），服务端只渲染、不建立 React 观察节点或 useWatch，也不发布 props 差异。服务端的 props/计算候选只用于本次请求的输出。该 token 是通知标识，不是业务数据快照；使用方仍须为每个请求创建独立状态，并在 hydration 前提供与服务端相同的数据和局部初值。客户端首次提交以 hydration props 建立初值，不补发默认 watch 回调；immediate 按本地监听初始化规则执行。SSR 不自动序列化代理或同步全局单例。验收 renderToString/hydrateRoot 基础路径，不把独立的 RSC、流式状态传输或跨请求共享 store 纳入本阶段。

渲染函数、getter 和 source 都应保持纯读取；事件处理与 watch callback 中的写入按核心规则执行。React render 抛错/挂起应交还 React，不从核心队列直接执行 render 捕获它们。父组件、子组件或 layout effect 在订阅窗口内写入时，由候选版本复查补齐；实际 DOM 更新时机交给 React。

### 10.8 Chip 局部更新：设计第 3.4 节

#### 10.8.1 独立观察边界与组件身份

Chip 是有自己 Observer 的 React 组件。父组件只创建包含 render 回调的 element，不执行回调；React 渲染 Chip 时，才在 Chip 的候选收集上下文中执行 `children()`。因此示例中 Index 没有读取 data.a/data.b，修改 a 只通知第一个片段，修改 b 只通知第二个片段。若父组件自己也读取这些字段，父组件仍会正常更新，“父级不更新”的保证以读取发生在片段内部为前提。

从 `functionComponent.ts` 提取内部 `createObserverComponent`，返回尚未 memo 的观察组件，保留 PropsCell、useSyncExternalStore、候选提交及清理的完整流程。现有 RFC/RC 继续在工厂结果外加默认 memo 并维护包装缓存；Chip 直接使用该工厂，Strict 版本在工厂结果外加专用 memo。不要让 Chip 另建公开 effect，也不要直接调用 RFC 返回的 memo 对象。

| 形式 | 父级正常更新 | 响应式字段更新 | 首次内容出现时机 |
| --- | --- | --- | --- |
| `<Chip>{render}</Chip>` / `chip(render)` | 正常进入片段，采用本次 children | 由自己的 Observer 更新 | 当前 render |
| `<Chip.Strict>{render}</Chip.Strict>` / `strictChip(render)` | memo comparator 忽略父级 props | 由 memo 内部的 Observer 更新 | 当前 render |
| `<AsyncChip fallback={...}>{render}</AsyncChip>` / `asyncChip(render)` | 正常更新 gate/片段 | 激活后由片段 Observer 更新 | 首次 useEffect 之后 |
| `<AsyncChip.Strict>` / `asyncStrictChip(render)` | gate 和片段均忽略父级 props | 激活后仍正常更新 | 首次 useEffect 之后 |

四个函数工厂仅调用 `createElement`，不执行回调、不使用 Hook、不按回调引用新建组件类型；可以在分支或列表中创建 element。列表按 React 规则提供 key，需要重置 Strict 片段时也可更换 key。所有组件类型及 `.Strict` 属性只在模块初始化时建立，函数工厂与 JSX 形式使用同一类型，避免每次父级 render 导致卸载、状态丢失和重复订阅。

片段回调只接收零个参数并同步返回 ReactNode，允许 null、文本、数组和 Fragment；非函数 children、async 函数或实际返回 Promise 给出明确错误。AsyncChip 的 Async 指延迟激活，不是等待 children 的 Promise。回调保持纯读取，不在其中使用 Hook；需要局部 Hook 时返回独立的 `<Child />`，由该组件按常规规则使用 Hook。子组件内部读取不自动成为 Chip 的依赖，需要它自身使用 RC/RFC 或其他观察片段。

#### 10.8.2 Strict 的闭包约定与提交安全

Strict 专门选择“忽略父级 props 更新”的语义，使用恒为 true 的父级 props comparator；它不禁止片段自身的响应式订阅、React state 或 context 更新，也不承诺 React 开发模式绝对不重试 render。父级传入新的 children/fallback 不保证被采纳，被跳过的更新不能偷偷改写已提交回调。闭包中的普通局部变量可能停留在旧 render；需要持续读取最新值时使用稳定的 reactive 对象或 RC 的 props 视图，否则使用普通 Chip 或更换 key。该限制对应 [React memo 关于函数闭包的说明](https://react.dev/reference/react/memo#specifying-a-custom-comparison-function)。

复用 10.6 的 props 提交机制后，普通 Chip 换 children 只由 React 正常更新一次，不因自己的 children 属性发布再渲染一次。片段订阅父组件的 props 视图时，其 owner 与父级不同；即使 Strict 跳过父级传参，也仍应收到实际读过字段的 props 通知。不能把父级的通知确认应用到全部后代。

#### 10.8.3 Async gate、SSR 与清理

AsyncChip 使用独立 gate：React state 初值为 false，首次只返回 `fallback ?? null`；在 `useEffect` setup 中置为 true，随后才挂载普通 Chip。AsyncChip.Strict 对整个 gate 做 Strict memo，并在激活后挂载 Strict 片段。gate 的 Hooks 始终无条件执行，不能把同一组件中的观察 Hook 放到 ready 条件之后。

不额外等待 requestAnimationFrame、定时器或 Promise；需求只规定 useEffect 后激活。服务端和 hydration 首帧均返回同一 fallback，服务端不执行回调、不建订阅；客户端 effect 后读取当时最新状态，激活前的变化折入首值。它只提供首次执行的延迟，不能使 render 中的副作用变合法，也不保证浏览器已经绘制一帧，执行边界见 [React useEffect 文档](https://react.dev/reference/react/useEffect)。

StrictMode 重放 setup 不创建多个片段观察器，cleanup 不调用 setState 强行恢复 false；真正卸载由 React 移除 gate 及片段，Observer 清理订阅。延迟前卸载、挂起、中止及回调抛错都不得留下活动节点。

### 10.9 Model 双向绑定：设计第 3.5 节

#### 10.9.1 三个入口与公共状态

- `useModel(initialValue)` 用局部 reactive `{ value }` 保存初值，返回身份稳定的对象和身份稳定的 onChange；重渲染不重置值，初值作为数据保存，不把函数初值解释为初始化器。onChange 使用闭包写入当前代理，不依赖 `this`，支持解构传给控件。
- `<Model source={selector}>` 自身就是观察边界，父组件无需包装也能使控件跟随 source 更新。render 中求值 source 并读取当前值，生成受控子 element；事件中写回同一条响应式属性。父组件只创建 selector 时，不会订阅字段。
- `defineModel(Component, postValue?)` 在模块作用域创建可复用包装组件，把外部 `refer` 转成 Model 的 source，把其余业务 props 交给 Component；不直接执行 Component 函数，不转发 refer/source/postValue/valueProp 到 DOM。

useModel 与 useLoading 都不会为普通函数组件增加隐式强制刷新。使用 useModel 时，读取 `model.value` 的 UI 应位于 RC/RFC 或 Chip 中；Model 组件自身已满足这一条件。`useModel(true)` 返回的字段仍名为 value，checkbox 用 `<input type="checkbox" checked={model.value} onChange={model.onChange} />`。

按设计统一示例导入，避免缺失 Model 或 useReactive：

```tsx
import { Model, defineModel, useReactive } from '@canlooks/reactive/react'

const TextInput = defineModel(props => <input {...props} />)
function Form() {
    const data = useReactive({ name: 'Alice' })
    return <>
        <Model source={() => data.name}><input /></Model>
        <TextInput refer={() => data.name} />
    </>
}
```

#### 10.9.2 可写属性引用，不能由值或 Dep 反推

`source()` 只返回值，现有 Dep 也只保存消费者，均不足以反向赋值。新增内部 `reference.ts`，维护可嵌套、try/finally 恢复的属性捕获上下文；由 `reactive.ts` 的 get 路径在捕获启用时记录 `{ receiver, rawTarget, key, value, descriptor }`。receiver 必须是实际代理，rawTarget 只用于校验身份和描述符。捕获结果与普通依赖记录分开，不把渲染中“最后读过的任意属性”保存在全局槽里。

约定 selector 是同步、无副作用的可写属性选择器：支持 `() => data.name`、`() => data.user.name`、`() => list[0]`、symbol/空字符串属性及可写 getter/setter。键可以由当前已提交闭包提供；路径中间对象必须能继续经代理读取。常量、普通 raw 对象属性、只读 props 终点、无 setter 的 getter、计算值对象的 `.value`、算术/拼接/多值聚合表达式不是可写引用。

实施步骤如下：

1. 在正常响应式依赖收集不变的前提下，执行一次 selector，得到当前值和有序的属性读取记录。捕获没有独立 effect，不增加永久订阅；render 时读取同时归 Model 的 Observer。
2. 嵌套路径保留终端属性及可用于检查连续路径的记录。getter 的内部计算临时屏蔽“属性引用”捕获，但保持正常依赖收集，外层记录 getter 本身，防止误把 backing field 当写入目标；独立 computed 的 value getter 在每次读取时标记为派生读取，即使命中缓存也不能被当作引用。`source={() => double.value}` 必须失败，不能误写其底层依赖；带 setter 的业务 getter 仍可按外层属性位置正常绑定。
3. 校验存在可写终点、返回值与该终点读取结果一致，以及已捕获路径不存在可检测的歧义。沿描述符链处理可写数据属性、setter、可扩展对象上的缺失属性；不可写、只读 props 或不可代理的终点应抛 TypeError。key 用是否存在判断，不能用 truthy 判断而漏掉 `''` 或索引 0。
4. Proxy 无法完整证明任意 JavaScript 表达式是左值，不能声称依靠 Object.is 就能识别所有 `a + b` 或碰巧相同的值。API 契约明确限制为上述属性选择器；运行时校验只拒绝可识别的错误，遇到多条独立读取路径等歧义时失败，不猜测写入目标。
5. 写入通过 `Reflect.set(receiver, key, nextValue, receiver)` 或等价代理赋值，失败明确抛错；不能写 rawTarget，也不能额外手动 trigger。setter、computed 失效、数组索引和 batch 净变化全部走已有内核。

`reference.ts` 不反向 import reactive。reactive 向它报告读取并提供代理 receiver；computed 只接入捕获隔离/派生标记。未启用捕获时仅增加轻量的活动状态判断，不改变正常 get 的返回值或 Proxy 不变量，也不导出公开 captureReference/toRaw。

render 只持有本次绑定候选；Model 的稳定事件函数通过第 10.6 节的提交登记取得最后成功提交的 source、postValue 和子 onChange。事件发生时在 untracked 中重新求值该 source，重新解析当前属性位置，再同步写入：例如 `data.user` 已被替换、但 UI 更新尚未提交时，应写当前的 user.name，不写旧对象。未提交的新 source 闭包不能进入活动事件处理器。路径不存在、已变成只读或被删除后不可重建时，该次事件失败并保留现有状态。

#### 10.9.3 值、事件和子组件合并

useModel、Model、defineModel 复用同一套同步事件归一化规则：

| 输入/控件 | 默认行为 |
| --- | --- |
| 文本 input、textarea、单选 select 的变更事件 | 读取当前控件的 value，结果为字符串 |
| checkbox 或单个布尔 radio 的变更事件 | 读取 checked，结果为 boolean |
| multiple select 的变更事件 | 将 selectedOptions 转为字符串数组 |
| 自定义控件直接传值 | 把第一个参数作为值；对象和函数也按数据处理，不隐式调用函数型值 |
| 需要转换或多个事件参数 | postValue 接收完整参数元组，返回一次转换后的值；有 postValue 时不再自动提取或二次转换 |

从 React 事件同步读取 currentTarget，必要时使用 target；不保存事件等待异步任务，也不只凭普通对象有一个 target 字段就认作 DOM 事件。无法辨认的自定义事件通过 postValue 明确转换。原生数值输入的 value 仍是字符串，不默默改变模型类型：数值模型用显式 `Number(...)` / `valueAsNumber` 转换并决定空值/NaN 策略；useModel<number> 的 onChange 类型只接受 number，调用方先转换再传入。字符串、布尔及字符串数组模型提供对应事件类型，直接值继续保留 T。

Model 使用 `Children.only`、`isValidElement` 验证恰好一个有效子 element；数组、多子节点、文本、Fragment、portal 和原生 file input 明确不支持。普通自定义受控组件遵循 value/onChange 或 checked/onChange；其他属性名、radio group 的选项映射等由一个轻量适配组件转成该协议，不让 Model 猜测业务含义。

默认布尔值注入 checked，其余注入 value；`valueProp` 可明确覆盖为 value/checked，支持布尔 value 控件或初值为空的 checkbox。仅在原生控件输出端将 null/undefined 的 value 映射为 `''`、多选映射为 `[]`、checked 映射为 false，避免受控/非受控切换；不把这些显示默认值写回业务状态，自定义组件保留原值。

调用 `cloneElement` 只覆盖选定的受控属性和组合后的 onChange，并清掉该属性对应的 defaultValue/defaultChecked，其他 props、children、key 和 ref 保留。checkbox 的 value 可作为原有提交值保留。库不读取或重写 element.ref；React 18/19 的引用行为按 [cloneElement 的合并规则](https://react.dev/reference/react/cloneElement) 验证。

事件处理顺序固定为“取得最新已提交配置 → 解析有效引用及同步转换一次 → batch 中写模型一次 → 调用子组件原有的 onChange 一次”。原回调收到完整原参数并能读到新模型值；其额外写入仍在同一批次内。转换或写入失败时不调用原回调；原回调抛错时保留已发生的写入，并沿用核心异常聚合，不重复赋值、不吞错。控件值必须在事件内同步写入，不能通过 useEffect 做两边互相 watch 来回同步，依据见 [React 受控 input 文档](https://react.dev/reference/react-dom/components/input#controlling-an-input-with-a-state-variable)。

useModel 的稳定函数不自动绑定外部 store，也不自动解释 updater；Model/HOC 的事件不在 render 执行。卸载后停止观察器并使遗留 onChange 无操作，不再写状态或调用原处理器；重复清理安全，StrictMode 再 setup 可恢复当前挂载的句柄。服务端只输出当前受控值，不写业务数据、不执行事件或建立订阅。

#### 10.9.4 HOC 与类型边界

defineModel 复用 Model，不再实现一套字段捕获、watch 或 onChange。它为内部 Component 提供所需受控字段与事件，调用方只需 refer 和其余必填业务 props；允许提供可选 onChange 参与组合。postValue 在 defineModel 调用时固定，动态转换使用 Model 的 postValue。工厂应在组件外调用以保持类型身份，设置可读 displayName。

返回 props 去掉受控字段、默认值、ref 与 refer/valueProp 冲突项，onChange 改为可选，保留其余必填性；refer 的返回值和 postValue 结果与控件声明的 value/checked 类型相容，postValue 参数由 onChange 元组推导。默认 input 上下文需让设计中的未注解箭头函数通过类型检查，显式自定义组件仍从 P 推导。若目标声明完全没有受控字段或 onChange，类型检查应拒绝，运行时无法检查的组件协议由调用方保证。

JSX 的 ReactElement 会擦除部分子 props 信息，Model 无法静态验证任意 JSX 子树的控件协议，需配合上述运行时校验；defineModel 的声明则必须保持可验证的 props 推断。普通函数/类组件是 HOC 首版边界；保留 Model 子 element 已有 ref 不等于自动给 defineModel 增加 React 18 的 ref 转发，HOC 不承诺未实现的静态成员复制或泛型组件高阶保真。

### 10.10 useLoading：设计第 3.6 节

#### 10.10.1 初值、返回值与并发计数

每次挂载创建一个控制器、一个局部响应式结果对象和一个稳定 load 闭包；loading/stacksCount 对外只读。调用 `useLoading` 不执行 fn，initialLoading 只在该挂载首次初始化时决定模式和初始显示，后续传入新初值不重置进行中的调用。

为每次 load 分配唯一 token，内部集合记录尚未完成的调用，`stacksCount = tokens.size`，两种模式都计数。loading 的规则如下：

| initialLoading | 初始 loading / stacksCount | 接受调用后 | 所有本地调用结束后 |
| --- | --- | --- | --- |
| 省略或 false | false / 0 | 至少一个 token 时 true | false / 0 |
| true | true / 0 | 首次调用开始后按 token 数驱动 | false / 0 |
| 非负安全整数 n，包括 0 | n / 0 | `loading = n + stacksCount` | n / 0 |

数值 n 是调用方提供的计数基线，不伪造 n 个请求，也不因某次本地请求完成而扣减基线。两次未完成调用时 stacksCount 为 2；初值 0 的 loading 依次为 `0 → 1 → 2 → 1 → 0`，初值 2 则为 `2 → 3 → 4 → 3 → 2`。布尔 true 是首次调用前的显示初值，没有调用时保持 true；首次调用后按实际未完成数恢复。负数、小数、NaN、Infinity 等无效数值初值抛 TypeError。

控制器保存模式、数字基线/初始布尔标记、token 集合及已提交 fn；对外发布 loading 和 stacksCount 时放在同一个短同步 batch 中，让监听者看到一致组合。读计数和更新内部 bookkeeping 使用非追踪上下文，不把它们变成调用 load 的外层 watch/effect 的依赖。不把一次请求的整个 await 生命周期放进 batch。

#### 10.10.2 调用、闭包更新与错误

load 不依赖 this，解构后可直接传事件或其他函数。每次调用先固定当时最新的已提交 fn 和参数，再按以下步骤执行：

1. 注册唯一 token，更新开始状态；相同 fn 的并发调用互不覆盖、互不取消。
2. 调用该次固定的 fn，await 其结果；Promise/thenable 和普通返回值统一变成 Promise，fn 同步抛错也变成 rejected Promise。
3. 在 finally 中只移除自己的 token，更新结束状态；无论成功、失败、乱序返回都恰好结算一次，不提前把其他请求的 loading 清空。
4. 成功值按原结果返回，业务异常继续 reject 给调用者；不吞错、不制造第二个未处理的 rejection、不返回伪造结果。若状态发布中的同步消费者也抛错，仍移除 token，按核心规则保留/聚合业务错误和发布错误，不能由 finally 覆盖原始错误。

fn 的新闭包通过第 10.6 节内部提交登记生效，load 身份不变。当前已开始的请求继续使用开始时选定的 fn；下一次调用使用最新已提交 fn。render 挂起或被放弃时，不把其 fn 写到活动控制器。props watch 在提交中同步调用 load，也必须看到该次已应用的 fn，而不是等到 Hook 自己的后续 effect 才更新。

Hook 本身不收集或请求业务数据，不提供自动执行、取消、超时、去重、串行队列、错误状态或“只保留最后一次结果”；这些不是设计 3.6 的要求。需要取消时由 fn 自己接收 AbortSignal。调用应来自事件、已提交 effect 或其他业务回调，不能在 render/SSR 中发起请求。

#### 10.10.3 卸载、StrictMode 与 SSR

提交时连接控制器，cleanup 时断开公开状态发布。断开后，已进行的请求继续完成，并始终从内部集合释放自己的 token、向原调用者兑现结果；不再改写已卸载组件的响应式结果。卸载不强行取消用户 Promise。已断开的遗留 load 调用返回 rejected Promise，不执行 fn、不新增 token。

StrictMode 的 cleanup/setup 复用同一控制器时，setup 重新连接并从内部 token 集合恢复当前公开计数，不能把正在进行的调用清零，也不能重复执行 fn。cleanup 间完成的调用仍会释放 token，重连时据真实集合发布。真正重新挂载创建独立控制器，旧实例结果不能污染新实例。多个组件使用同一个 fn 也各自计数。

SSR 只创建纯本地初始状态，不注册订阅、不自动调用 fn；客户端以相同 initialLoading hydration，首次 setup 连接。RC 中解构 loading 会在本轮 render 绑定依赖，后续更新由现有 Observer 驱动；普通未包装组件若要显示变化，应将读取放入 Chip 或使用 RC/RFC。

## 11. 实施顺序

| 步骤 | 具体工作 | 完成标志 |
| --- | --- | --- |
| 1. 固定现有基线 | 运行已有 npm test、build、test:dist 和 test:package；记录五个核心 API、八个 React 导出及 3.3 行为 | 已有核心、watch、装饰器、props、双格式共享内核都有可复现基线，失败项先区分既有问题 |
| 2. computed 的 .value 迁移 | 按设计 2.3 修改 computed 返回值和只读访问器，导出 Computed 类型；更新 reactive 的 getterCache 与计算值身份识别，并迁移现有调用点和断言 | 只读 `.value` 按需求值，watch/useWatch 使用读取闭包；自动 getter 保持直接取值，缓存/批次/props 候选/双格式回归通过 |
| 3. 确认 3.3 并整理共享 React 设施 | 按 10.6 核对 props/watch/候选缓存；提取非 memo 观察组件工厂与 commit.ts；增加提交闭包登记；将局部状态 Hook 统一为 useReactive | RFC/RC 默认 memo 与包装幂等不变；单次 props 更新不追加自身渲染，其他 owner 通知保留，闭包先于 props 回调更新 |
| 4. Chip 四种形态 | 实现普通/Strict 片段、useEffect gate、两个 .Strict 属性和四个 element 工厂 | 设计 3.4 的 a/b 片段独立更新；Strict、闭包边界、延迟激活、SSR/卸载均可验证 |
| 5. 内部属性引用 | 新增 reference.ts，在 reactive get / getter / computed.value 处接入捕获及隔离；不增加公开核心运行时 API | 简单/嵌套/数组/访问器位置可写，计算值的只读 value 及其他无效引用失败，事件重定位与核心批次回归通过 |
| 6. Model 三个入口 | 先统一事件归一化，再实现 useModel、观察式 Model、defineModel；接入已提交配置与清理 | 设计 3.5 示例可用；双向更新、回调一次、值转换、路径替换、ref 保留及类型推断通过 |
| 7. useLoading | 实现稳定调用器、token 记账、两种 loading 模式、提交 fn 与断开/重连 | 设计 3.6 示例可用；并发乱序、reject/同步抛错、数值基线、StrictMode 与卸载均不泄漏或误计数 |
| 8. 交叉验收 | 组合 computed.value、props watch、Strict Chip、Model 和 loading；制造可控挂起、中止及提交窗口 | 新能力不吞已有 watch 的 oldValue 或其他 owner 通知；没有 render 期业务副作用和残留订阅 |
| 9. 类型、构建与交付 | 核对 Computed 类型与 .value 示例，更新十八个 React 导出及声明、Node 桥接、冒烟和隔离消费者；完善 README | 计算值迁移及useReactive/静态属性/泛型可用，两种格式共享引用捕获与内核，无 React 的核心消费不受影响 |

本轮按表中依赖顺序完成了 `.value` 迁移与 3.3～3.6 的实现，不保留旧读取函数兼容层。依赖关系为“既有内核/props → computed.value 迁移 → 共享观察与提交设施 → Chip、Model、loading”，其中 Model 还依赖内部属性引用。第 2 步先完成核心与既有 React 用例的调用迁移，再做第 3 步的观察器重构；第 3 步必须通过原 props/StrictMode/候选窗口用例；第 5 步回归 getter 缓存、计算值只读和批次内 computed 分支恢复；第 8 步同时证明 props 监听、同源去重和多来源通知正确，不能以关闭整个组件的调度换取少一次 render。

## 12. 验收与工程配置

### 12.1 保留核心回归

沿用 `test:node`、`node:test` 与 `node:assert/strict`，将显式计算值的现有调用断言迁移到 `.value` 后保留下列核心回归，并补充访问器与只读对象行为。测试以可观察结果和调用次数为准，避免断言内部 WeakMap 或私有字段布局。

| 验收场景 | 必须观察到的结果 |
| --- | --- |
| 两个 effect 分别读取 count/message | 各立即执行一次，只因对应属性变化而重跑 |
| 分支切换、同一属性重复读取、嵌套执行 | 旧依赖解除、订阅去重、活动 effect 正确恢复 |
| 停止、重复停止、停止已排队节点、回调内停止 | 后续不执行、不重新订阅，其他 effect 不受影响 |
| 相同值、NaN、+0/-0、raw/proxy 互换 | 符合 `Object.is` 和代理归一化约定 |
| 属性新增/删除、只读写入失败、未定义属性 | 应通知的通知，失败或无变化时不通知 |
| 嵌套对象、对象整体替换、循环引用 | 代理身份稳定；替换后移除旧对象依赖 |
| computed 返回对象、首次/重复读取 .value、无消费者时修改 | 创建不求值，首次读取才运行；缓存命中不重算，依赖变化只失效，下次读取重算；外壳身份稳定 |
| computed.value 写入、Reflect.set、旧调用方式 | 类型层拒绝写入和把结果当函数；运行时 value 无 setter、Reflect.set 为 false、严格模式赋值及旧式调用抛 TypeError，缓存不被覆写 |
| reactive(computedValue)、对象/数组内保存 computedValue | 原样保留计算值对象身份，不自动解包或二次代理；读取 .value 仍正确追踪，普通 value 字段照常可写且响应 |
| 缓存已命中后新建 effect/watch/useWatch 读取 .value | 仍建立订阅；source 使用读取闭包，后续新旧值、immediate 与清理语义不变 |
| computed.value 条件依赖、返回对象/undefined/函数 | 依赖按读取分支更新，返回 T 保持原值/引用和类型；不把计算结果自动代理或冻结 |
| 同时读取源与 computed、链式和菱形计算 | 一次源写入不重复执行同一消费者，不读到旧缓存 |
| 对象 getter、原型 getter、两个实例、静态 getter | 缓存命中且彼此隔离，使用正确的 this |
| getter/setter、setter 修改多个 backing field | 不提前调用 getter，消费者只看到 setter 完成后的状态 |
| 自有 getter 删除、不可写不可配置属性 | 消费者读到新结果，不违反 Proxy 不变量 |
| @reactive 构造参数、实例方法、静态属性、继承 | 参数正常传递，公共字段可追踪，instanceof 正常 |
| 数组索引、push、缩短 length、delete 索引 | 索引与长度依赖按实际变化通知 |
| effect/computed 抛错、后续新建 effect、下一次修改 | 不污染收集上下文，失败 computed 可重试，通知队列可继续使用 |
| computed 循环读取 | 抛出明确错误，执行标记能够恢复 |
| 空 batch、返回值、非函数参数 | 不额外触发 effect；结果及泛型类型保留；非法参数抛 TypeError |
| 批次内 `1 -> 2 -> 1`、`1 -> 2 -> 3` | 前者没有额外执行；后者结束前只执行一次并读到 3 |
| 同一 effect 读取多个改变字段、其中一个回退 | 整体只执行一次；仅回退的字段不影响其他净变化的通知 |
| 嵌套 batch、批次外两次写入 | 内层结束不通知；批次外两次实际变化仍各通知一次 |
| 批次内新增再删除、删除再恢复、undefined 与不存在 | 按最终自有属性状态判断；值相同但存在性不同仍通知 |
| 批次内 NaN、+0/-0、raw/proxy 互换、嵌套字段 | 沿用 Object.is 与归一化规则，逐属性比较而非深比较 |
| 批次内修改后读 computed/getter，再恢复初值 | 每次失效后读取都得到当时值；消费者不因最终回退而重跑；批后不返回中间缓存 |
| 批次内读取最终 computed 值，依赖集合未改变且之后没有写入 | 结算不重复使该有效缓存失效，消费者读取时不无故重算 |
| computed 分支中途切换后恢复，原分支数据改变 | 按第 5.3 节示例通知一次，读到最终原分支的新值 |
| computed 仅临时分支的数据改变、选择条件恢复 | 原消费者不误通知；随后修改原分支仍可通知，临时依赖已清理 |
| 链式/菱形 computed、读取源及派生值、源回退 | 即时失效传播完整，最终按净变化去重，不凭 dirty 强行通知 |
| computed 派生结果相同但源属性有净变化 | 仍可通知消费者，不实现计算结果相等优化 |
| 批次内停止消费者、首次注册 effect | 停止的节点不被结算或依赖恢复重新激活；首次注册仍立即执行 |
| batch 回调、setter、多个 effect 抛错 | 成功写入仍结算；其他消费者执行；单个异常保真，多个异常保留，后续批次可用 |
| effect 刷新时再次写入响应式数据 | 新批次重新取初值并继续处理队列，不套用上批次的日志 |
| async 回调/方法、微任务、计时器 | 只合并同步部分，Promise 身份不变，后续写入不被错误挂起 |
| 实例/静态方法多次修改、回退、方法互调与继承 | 自动遵循 batch 净变化规则，外层方法结束才通知，this 和返回值正确 |
| 方法重复读取、提取调用、call/apply | 包装身份稳定；保留动态 this，不私自绑定实例 |
| 普通对象方法、函数字段、getter 返回函数 | 不误纳入类方法包装范围；显式 batch 仍可合并可追踪的写入 |
| batch 内 push/pop、截断后恢复 length、索引删后重建 | 完全恢复不通知；空槽不能当作已恢复的元素；索引/length 分别判断 |

### 12.2 新增行为验收

以下第一组作为已有 watch、React 组件与 3.3 的保留契约；后续新增 Chip、Model、loading 用例在相同真实 React DOM 环境中执行。

| 验收场景 | 必须观察到的结果 |
| --- | --- |
| watch 省略选项、undefined、空选项、immediate 为 false/undefined | 首次只有 source 执行；后续 new/old 顺序正确，保持原有默认行为 |
| watch immediate 为 true、随后变化及停止 | 首次 source 只执行一次；watch 返回前收到当前值与 undefined，后续旧值从初值推进；停止后不再通知 |
| source 返回 undefined 或 void | 独立 initialized 标记正确工作；默认首次不回调，immediate 首次收到两个 undefined，之后依赖变化仍通知 |
| batch 内创建 immediate watch、随后修改或回退 | 首次回调不等待批次结束；后续通知按净变化结算，不撤销或重复模拟首次回调 |
| immediate callback 读取旁路字段、同步写回源或抛错 | 读取不绑定 watch 或外层 effect；写入沿用 running 和批次规则；首次抛错清理节点及队列，无残留订阅 |
| 创建后修改 options.immediate | 不重新初始化、不补发 callback，后续依赖通知不受选项对象修改影响 |
| watch 返回相同标量、相同代理、嵌套字段 | 依赖有净变化就回调；不做结果过滤或隐式深监听；对象旧值不是快照 |
| callback 读取旁路字段、在 effect 内创建 watch | 旁路字段既不绑定 watch，也不泄漏到外层 effect |
| watch 条件分支、computed/getter、类方法批次 | 依赖随 source 更新；计算值新鲜；多次写入统一通知，回退无通知 |
| watch 停止、排队时停止、回调内停止或写回源 | 清理幂等，停止后不执行，不产生直接自递归 |
| source/多个 callback 抛错 | 首次失败不残留；更新失败的旧值按第 9.3 节推进；其他消费者继续执行 |
| 普通 effect 与 React notify 节点混用 | notify 不清空已提交依赖、不主动调用组件函数；computed 分支恢复仍正确 |
| React listener 同步提交后 layout effect 再次写入 | 新批次的 notify 不因当前节点仍在通知而丢失，后续 DOM 到达最新状态 |
| RC/RFC 函数组件读取不同属性 | 仅对应依赖触发库通知，最终 DOM 正确；事件中读取不成为 render 依赖 |
| RC/ReactiveComponent 与 RFC/ReactiveFunctionComponent 自动 memo | 各函数入口均返回 memo 包装的响应式组件，调用方无需手工增加 memo；类入口仍返回可构造的类 |
| 父组件更新、子组件 props 未变或发生变化 | 受控场景中相同 props 跳过子组件主体；值变化或对象/函数引用变化时正常更新，沿用默认 Object.is 比较 |
| props 保持不变、外部 store 或局部代理字段变化 | memo 不屏蔽 useSyncExternalStore 通知，组件读到最新字段/computed，batch 去重与回退规则不变 |
| memo 组件内部 React state 或消费的 context 变化 | 正常触发组件更新，提交后依赖、useWatch 闭包与基线按既有规则更新 |
| memo 跳过父级更新后再修改响应式依赖 | 已提交订阅仍有效，无额外观察节点、重建监听或丢失通知 |
| 设计 3.3 示例：JSX 不读 count，仅 useWatch 读 props.count | 初次默认不回调；父级 count 从 1 改为 2，提交后收到 `(2, 1)`，callback 内读取 count 为 2 |
| JSX 与 useWatch 同时读取 props.count，回调不写数据 | 一次父级 props 更新只有一次正常组件更新；watch 通知一次，没有同源 listener/forceUpdate 或 getSnapshot 失效造成的第二次 render |
| 一个 watch 读取多个 props、连续两次已提交更新 | 每次提交多字段变化合并一次回调，新旧值连续推进；首次 source 不因提交协调重复求值 |
| props source 读未改字段，其他字段变化 | 函数 props 按字段通知，未改字段的 watch 不回调；类 props 槽按第 10.6.4 节的整体差异语义验收 |
| props 新增/删除、undefined、NaN、+0/-0 | 按存在性与 Object.is 比较；仅换原始 props 外壳而字段相同不发布变化 |
| 冻结的 React props、浅层对象、函数和 children | 不修改 React 对象，不违反 Proxy 不变量；保留字段引用；只读视图拒绝顶层写入，普通嵌套对象不被意外代理 |
| props 中传入已有 reactive store | 代理引用稳定时，内部字段变化仍可通知；props 同源去重不得屏蔽该 store 自身的变化 |
| render 读取 props 派生 computed/getter 及分支链 | 本轮直接显示新 props 的派生结果；候选缓存不污染旧快照，提交后依赖正确且没有第二次修正渲染 |
| props 更新同时伴随外部数据、其他组件来源或已排队更新 | 来源集合完整，只有当前 owner 已覆盖的 props 原因被确认，其他真实变化仍可调度 |
| props watch 回调写入局部或外部状态 | 回调写入作为普通新变化处理，必要的后续更新不被误判为重复 props 渲染 |
| props render 挂起、抛错、中止或 StrictMode 重放 | 未提交 props 不触发 watch、不改变其旧值或已提交 computed 缓存；相同提交重放不重复发布差异 |
| props 提交发生在尚未结束的 batch 内 | 使用最外层初值与最后成功提交，结算前不静默推进监听旧值；回退及多字段去重正确 |
| 类 this.props 监听、历史 prevProps 与 ref | 已提交变化可通知 source；React 读取保留原始 props 引用，无 props 不匹配警告；原生命周期参数与实例身份保留 |
| 类 shouldComponentUpdate 返回 false 且存在 props 监听 | props 有浅层变化时放行一次正常更新并发布通知；不再补一次 forceUpdate，其他情况下按原判断执行 |
| 组件依赖条件由响应式值或 props 切换 | 成功提交后旧分支解除、新分支生效；独立子组件不误归入父组件收集 |
| 同时读取源、getter、链式/菱形 computed | 一批只投递一次组件通知，不使用旧缓存；完全回退无主动通知 |
| getSnapshot 重复调用、props 重渲染 | 未变时快照身份稳定，不产生无限更新；subscribe 身份稳定 |
| render 到 subscribe 间被父/子 layout effect 改值 | 完成订阅与版本复查后显示最新数据，不能一直停在首轮旧值 |
| 新分支首次读取后、提交前该分支改变 | 即使旧 committedDeps 未订阅该属性，也能发现候选过期并重读 |
| StrictMode 重复 render/setup/cleanup | 最终每实例仅一份有效订阅；卸载后不再通知；重连后仍可更新 |
| 首次 Suspense、render 抛错、被中止的更新 | 未提交候选不留下 React 订阅，已提交依赖不被试探 render 提前替换 |
| RCC/RC 装饰类、两个实例、继承与 ref | 各实例依赖独立；原构造、静态成员、context 和实例方法可用 |
| 类生命周期、PureComponent、shouldComponentUpdate | 用户方法按原参数执行；外部依赖能请求 forceUpdate；卸载抛错也不残留订阅 |
| 类挂载窗口和 StrictMode mount/unmount/mount | 复查后补上挂载前变更；模拟卸载后能够重连 |
| useReactive 重渲染、新 initialState、两个实例 | 当前挂载的代理身份和值保留；内联初值各实例独立；共享 raw 时明确共享 |
| useWatch 默认创建、重渲染、卸载和重新挂载 | 提交时建立，默认首次不回调；卸载停止；重新挂载从新基线开始 |
| useWatch immediate、普通重渲染和选项变化 | render 不回调，setup 中收到初值与 undefined；内联选项、静默刷新或切换 immediate 不重复初始化 |
| useWatch immediate、StrictMode 与重新挂载 | 每次新建监听按选项执行首次回调；cleanup 后可再次调用；最终只有一份有效订阅，卸载后无通知 |
| useWatch immediate 首次回调抛错或引发同步更新 | 初始化失败立即停止并清空句柄；同步更新可找到活动句柄，不泄漏或递归初始化 |
| useWatch callback 引用更新后的 props | 使用最新已应用提交的值，被中止 render 的 props 不进入旧监听 |
| useWatch source 由响应式 props 选择 store 或字段 | props 提交正常触发 source 与 callback，使用上次成功值作为 oldValue；新依赖绑定、旧依赖解除，静默刷新不吞掉这次通知 |
| useWatch source 仅捕获普通 context 值或未包装组件的 props | 没有响应式依赖变化时只静默换绑定；与 RC/RFC 的响应式 props 语义区分 |
| 同批通知先触发组件提交、后处理 useWatch | 静默刷新不吞队列项、不覆盖待通知 oldValue；运行中刷新不递归执行节点 |
| SSR、hydrateRoot、两个请求的不同 store | 服务端不建立监听，immediate 也不执行 callback；客户端 hydration 提交后按选项初始化；初值一致时正常 hydration，请求之间无状态串用 |
| 三组 alias、直接包装、重复包装 | alias 引用相等，RC/RFC 对同一函数返回同一 memo 对象；本库 memo 对象重复传入仍原样返回，不叠加 memo 或观察器；非法组件形式明确失败 |

React 行为测试使用真实 React DOM 根节点及 `act` 驱动，在隔离 DOM 环境中断言最终内容、回调参数和卸载后的行为；必要时用测试专用计数器验证净通知次数，不假定 StrictMode 的 render 精确次数。memo 跳过与 props 不重复渲染分别设置无 StrictMode、无其他更新来源的用例：完成初次挂载后记录组件函数/render 调用次数，一次父级 props 更新只增加一次，并同时检查 watcher 参数与 listener/forceUpdate 次数；仅断言最终 DOM 不足以证明去重。集成用例继续检查更新正确性与生命周期。覆盖当前 React 19 开发版本，并在独立消费环境复跑 React 18.3；React 与 React DOM 使用匹配版本。并发测试应构造可控制的挂起/恢复与提交窗口，不靠随机计时。

设计 3.4～3.6 的新增验收矩阵如下：

| 验收场景 | 必须观察到的结果 |
| --- | --- |
| useReactive 对象/数组、两个组件实例 | 同挂载代理稳定，输入类型保留，内联初值实例独立；旧 useState 不再导出 |
| 3.4 示例两个 Chip 只读 a/b | 改 a 只执行 A 片段，改 b 只执行 B，父 Index 计数不增加；batch 回退不通知 |
| chip 工厂在父 render、条件或列表中调用 | 创建 element 时不执行 render 回调、不调用 Hook；类型稳定，同 key 不发生无故重挂载 |
| 普通 Chip 父级更新 children，回调读取 props | 使用新回调/新 props，只有一次正常片段更新，无自身 props 发布导致的补渲染 |
| Strict 两种形式，父级传新闭包、依赖变化、context 更新 | 父级 props 不主动驱动片段；响应式依赖/context 仍能更新；普通闭包的旧值限制及更换 key 重建符合文档 |
| Async 及 Async.Strict 在 useEffect 前后 | effect 前仅 fallback 且无 children 调用或片段订阅；effect 后显示最新值，Strict 仍响应自身依赖 |
| Async 在激活前卸载、StrictMode 重放、SSR/hydration | 无遗留订阅、无计时器依赖；服务端和首帧同为 fallback，无 hydration 警告 |
| Chip 条件依赖、嵌套片段、抛错/挂起、非法 children | 各自收集和清理，旧分支解除，未提交不订阅；非同步回调/Promise 结果明确失败 |
| useModel 字符串、布尔值、数组及自定义值 | 初值与对象/onChange 身份稳定，重渲染不重置；赋值及事件驱动 RC/Chip，提取 onChange 不丢 this |
| Model source / defineModel refer 两个设计示例 | 初始化控件值正确；输入写回代理；外部修改同步到控件，无需父组件主动订阅字段 |
| Model 嵌套对象整体替换、数组索引、symbol 与空 key | 写入当前终端位置；事件到达时重定位，不写旧对象；索引 0 和空字符串不被当作未绑定 |
| 可写 getter/setter，getter 内部读取 backing fields | 写入调用目标 setter 一次，内部读取不劫持目标，派生值及其他 effect 正常更新 |
| 常量、raw 属性、computed、只读 props/getter、可识别歧义 | 抛明确错误，不猜测或改写其他属性；捕获异常后上下文恢复，不影响下一次合法绑定 |
| source/控件在 render 中更换但挂起或中止 | 活动事件仍使用已提交配置；成功提交后改用新 source/postValue/onChange |
| 文本、checkbox/radio、单选/多选 select、数值转换 | value/checked 映射和默认提取正确；postValue 获取完整参数且只执行一次，数值转换显式 |
| 自定义对象值、valueProp、null/undefined 初值 | 对象不误判事件，布尔 value 可显式选择；原生显示默认值不回写模型，无受控切换警告 |
| 原 onChange、额外属性、children、key 与 ref | 先写模型再调用原回调一次，完整参数保留；选定受控值由模型覆盖，其余属性及引用保持 |
| postValue/写入/原 onChange 抛错，事件中同值或回退 | 转换/写入失败不触发原回调；原回调失败不回滚成功写入；无重复赋值，净变化规则不变 |
| Model 多/无子节点、Fragment、file input、卸载遗留事件 | 不支持的子节点明确失败；卸载停止观察且遗留事件不写源，StrictMode 重连有效 |
| useLoading 默认初值、true、0、正整数及非法数值 | 初值、模式、数值基线与 10.10.1 一致；新 initialLoading 不重置当前挂载 |
| 两个 load 并发，后发先完成，成功/失败混合 | stacksCount 按真实未完成数变化；布尔模式最后一个结束才为 false，数值模式最终回到基线 |
| fn 返回普通值、Promise/thenable、同步 throw 或 reject | load 的 Promise 保留成功值/错误，token 各释放一次，无额外未处理 rejection；失败后还能再次调用 |
| load 解构、fn 随 props 变更、props watch 同步调用 load | load 身份不变，参数完整，使用最新已提交 fn；运行中请求不被后来 fn 替换 |
| 首次 immediate useWatch 中调用 useModel.onChange/load | 同一次提交先使句柄有效再初始化监听，不误判未挂载；产生的写入遵守原队列及去重规则 |
| fn 候选被中止、调用间跨越卸载/StrictMode cleanup | 未提交 fn 不泄漏，断开期只做内部结算，重连恢复真实计数，遗留调用不启动新请求 |
| 多个 Hook 实例、真正卸载再挂载、SSR | 计数与 token 不串用；旧实例完成不更新新实例；SSR 不自动调用 fn |
| 父级 props watch + Strict Chip / Model + useLoading 联用 | 父级去重不吞子 owner 通知；事件和 watch 使用提交后的闭包，输入及 loading UI 都到达最新值 |

Chip 的局部性同时断言父组件、两个片段及必要的子组件调用计数，隔离 props 触发与 store 触发；StrictMode 只检查有效订阅与最终结果。Model 通过真实 input/change 事件验证同步写回、原回调及受控警告，辅以可控自定义组件验证参数元组；引用捕获的错误恢复在核心测试中覆盖。loading 使用手动 resolve/reject 的 deferred Promise 控制完成顺序，不访问网络或依赖固定延时；每次拒绝均由测试接住，并核对清理后的计数和可再次调用性。

### 12.3 工程与发布验收

- 保留 TypeScript、tsx、esbuild、传统装饰器配置和现有 ESM/CJS 构建。React/React DOM、jsdom 及类型继续用于开发测试，保留第 10.1 节已有可选 peer；本次无须新增运行时包，核心仍为零运行时依赖。
- React 实现继续使用 `.ts` 和 createElement；复用已有 `tsconfig.react-test.json` 的 JSX/DOM 配置、`test:react` 和类型检查脚本，新用例接入当前 npm test。保留核心 `typecheck:test`、`typecheck:dist` 和非 DOM 类型环境，不为 Model 把 DOM 类型引入根声明。
- 递归生成和复制两个格式中的 reference 与 React 新模块；源码相对导入继续使用 `.js` 后缀。保持 `dist/node.js` 五个核心导出，扩展 `dist/node-react.js` 为十八个 React 导出；不得导出内部捕获/提交函数。两条桥接、Chip.Strict / AsyncChip.Strict 及类型辅助声明均有产物检查。
- 保留 smoke-assertions 的五个核心导出断言，Computed 仅为类型导出，不进入 Node 桥接的运行时清单。更新 react-smoke 的八个导出假设为十八个，检查仅导出 useReactive（无旧 useState 导出），以及工厂 element.type 与对应组件相同。扩展 ESM/CJS 冒烟：用根入口创建 state，由 React 子入口读取计算值的 `.value`、使用 Chip/Model 消费和写回，再反向混合 import/require 验证同一对象、计算值身份识别、引用捕获上下文及通知；原生 ESM 两入口也单独验证。不要拿直接导入 dist/esm 与 Node 条件入口的混用代替受支持的共享内核检查。
- 计算值迁移同步覆盖 `src/computed.ts`、`src/reactive.ts`、`src/index.ts`、README、`test/test.ts`、`test/react.tsx`、核心及 React 消费端类型用例、两种格式的 smoke 与 `scripts/test-package.mjs` 涉及的消费示例。将计算值调用改成 `.value`，将把计算值当作 source 传入 watch/useWatch 的写法改成读取闭包；只迁移 computed 的返回值及其使用点，getter/source 回调和内核其他函数的签名保持原有职责。完成后检索旧返回签名、计算值调用和直接 source 传参，残留仅允许用于明确的负例或迁移说明。
- 在 `.mts` / `.cts` 中通过根入口导入 `Computed<T>`，验证标量、对象、undefined、函数结果及链式 `.value` 推断；增加计算值不可调用、value 不可赋值、不能直接传给 watch/useWatch 的类型负例。保留普通自动 getter 的类型（例如 `state.double: number`），确认内部缓存迁移不让其变成 Computed。React 类型与行为用例覆盖组件/Chip 内 `.value` 的读取和 props 候选缓存，独立核心消费仍启用无 DOM、无 React 及 `skipLibCheck: false`。
- 在消费端类型用例中覆盖 watch/useWatch 的标量/对象/void 推断与 WatchOptions：省略选项或 literal false 时 oldValue 为 T，literal true、boolean 变量、通用配置（含可能为 undefined 的配置变量）时为 `T | undefined`；校验旧值未判空、非布尔 immediate 和错误 callback 参数的类型错误。函数包装结果检查 NamedExoticComponent 类型、JSX 的 props 推断和必填字段，以及本库包装结果再次传入 RC/RFC 的类型兼容；类分支仍检查装饰后的构造/静态/实例签名，并保留 alias 及 useReactive 对象返回值检查。NodeNext 下分别检查 `.mts` 与 `.cts` 的两个入口；React 用例单独启用 DOM/JSX 类型，保留现有核心的 `types: []` 与非 DOM lib 检查。
- 补充设计 3.3 示例的消费端类型与行为用例：props 的必填/可选字段类型保留，`useWatch(() => props.count, cb)` 正确推断新旧值；props.ts 和提交上下文保持内部模块，根入口仍没有 React 类型或运行时依赖。
- 新增 3.4～3.6 的 `.mts`、`.cts`、`.tsx` 类型用例：Chip 的函数 children、两个 .Strict 和所有工厂；useReactive 的对象/数组返回值；useModel 的 T 与合法事件类型；Model source 推断和 postValue 返回类型；defineModel 的未注解 input 示例及显式自定义组件的必填 props、refer、完整事件元组；useLoading 的参数元组、Awaited 结果和布尔/数值/联合初值。用类型负例验证错误 children、缺失 source/refer、错误值转换、遗漏业务必填字段，以及将 boolean 误赋 number、将数字字面量当固定 loading 等情况。避免以 any、双重断言或跳过声明检查掩盖类型缺口。
- 从实际打包文件建立临时核心消费者，仅安装该包和必要的 TypeScript 检查工具，不安装 React/React DOM/@types/react，不让测试借用仓库 node_modules 或上级目录依赖。分别执行 import、require、watch/computed/batch，以及 `skipLibCheck: false` 的核心声明检查；核实可选 peer 未被当作强制依赖安装。
- 扩展已有 `scripts/test-package.mjs`，在匹配 React 18.3/19 的隔离环境中验证 `/react` 两种格式、十八个导出与声明，保留自动 memo、props 监听与去重、别名和包装幂等性；增加至少一个 Chip 局部更新、Model 写回及 loading 并发用例。确认 React 未嵌入产物，两个入口共用核心状态，根消费者无需解析 React 或 DOM 类型。
- README 将 computed 签名与全部显式取值示例统一为只读 `.value`，说明旧调用方式的迁移、watch/useWatch 的读取闭包以及自动 getter 仍直接取值。保留已有 watch、响应式 props、生命周期和模块格式说明，新增 3.4～3.6 的完整可运行示例及 API 表。明确 useState 到 useReactive 的重命名迁移及旧导出移除、Strict 闭包限制、Async 的 effect 后激活、Model 属性选择器限制与 source/refer 映射、原回调顺序、数值转换、loading 数值基线和 stacksCount 区别、Promise 错误及卸载行为。设计中的 Model 示例应在使用文档补全 Model 导入；不引入旧版 useAutorun/Proxyable 等未承诺接口。

实施后的检查顺序为：`npm test`（核心/watch、React 行为及源码/测试类型）→ `npm run build` → `npm run test:dist`（含两种格式的消费端类型）→ `npm pack --dry-run` 检查清单 → `npm run test:package` 使用实际 tarball 完成隔离消费者验证。实际检查结果记录于下节。本方案不包含 npm 发布。

完成标准：设计第 2.1～2.5 节与第 3.1～3.6 节示例全部可用，2.3 的 `.value` 迁移与 React 新需求一同完成。根入口保持五个运行时 API 并导出 Computed 类型；显式计算值通过只读 `.value` 取值，自动 getter 仍直接取值，所有正式源码、示例和测试完成旧接口迁移。React 子入口提供 10.1 中的十八个运行时导出和两个 .Strict 属性；props 监听不重复驱动所属组件，Chip 的局部更新和延迟/Strict 语义可验证，Model 同步双向写回且引用不串绑，loading 在并发、异常和卸载后正确结算。原有 watch/immediate、memo、computed 懒缓存、批次、装饰器、提交候选、自动清理及双格式共享内核行为全部保留，并通过无 React 消费验收。

## 13. 实施记录（2026-09-29）

同步设计 3.2 的后续重命名：局部状态 Hook 的实现与公开入口统一为 `useReactive`，删除原 `useState` 导出与别名，React 子入口保持十八个运行时导出。已迁移行为、冒烟和消费端类型用例；ESM/CJS 类型负例明确验证旧名称不能再从本库导入。React 原生 `useState` 的内部使用保持原有职责。

本轮已完成第 11 节全部步骤。新增 reference.ts 与 React 的 commit/chip/model/loading 模块，保留五个核心运行时 API，React 子入口扩为十八个运行时导出。computed 使用冻结外壳的只读 .value，源码、冒烟、消费端类型与 README 完成迁移；旧调用写法只保留于明确的类型负例和迁移说明。

行为回归新增 4 个核心用例与 27 个 React 用例：覆盖属性捕获的可写性、getter 隔离及错误恢复；Chip 局部更新、Strict 闭包、Async 激活和 SSR；Model 真实 DOM 事件、完整参数、ref、路径重定位与中止候选；loading 并发乱序、状态发布异常、初次 immediate、卸载、隐藏树恢复及多能力提交联动。消费端同时检查 .mts/.cts/.tsx、函数与类控件的 defineModel 推断及类型负例。

本轮测试发现并修复两处集成边界：props 快照比较不再读取 React 开发模式的保留 key/ref 警告访问器，同时仍保留普通类 state 中同名字段的浅比较；Suspense 隐藏时停止观察与事件句柄，但保留尚未被 React 取消的外部 store listener，重连后可发布真实 loading 计数。

| 验证命令 | 最终结果 |
| --- | --- |
| npm test | 71 个核心测试、55 个 React 行为测试全部通过；源码与测试类型检查通过 |
| npm run build | ESM、CJS、递归声明及两条 Node 桥接生成成功 |
| npm run test:dist | 五个核心 / 十八个 React 导出、混合格式共享内核、Chip/Model/loading 冒烟及 ESM/CJS 消费端类型通过 |
| npm pack --dry-run | 74 个预期文件，新增内部模块在两种格式中完整进入产物 |
| npm run test:package | 实际 tarball 的无 React / 无 DOM 核心消费者通过；React 19.3.0 和 18.3.1 的匹配 React DOM、完整行为套件、两种格式与声明检查全部通过 |

README 已补全 API 表、可运行示例、.value 迁移、Strict 闭包限制、Model 属性选择器与事件转换、loading 数值基线和卸载语义。未增加运行时依赖，本轮没有发布 npm 包。
