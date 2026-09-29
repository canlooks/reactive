# @canlooks/reactive

基于 JavaScript Proxy 的轻量级响应式库，自行实现依赖追踪与同步调度，无运行时依赖。

核心提供五个 API：`reactive`、`effect`、`computed`、`batch`、`watch`，支持对象与数组的按需深层代理、getter 自动缓存、类装饰器和类方法自动批处理。独立的 `@canlooks/reactive/react` 入口提供响应式组件和 Hook；只使用核心时无需安装 React 或 React 类型。

## 安装与导入

```sh
npm install @canlooks/reactive
```

```ts
// ESM
import { reactive, effect, computed, batch, watch } from '@canlooks/reactive'
```

```js
// CommonJS
const { reactive, effect, computed, batch, watch } = require('@canlooks/reactive')
```

包同时提供 ESM、CommonJS 产物及各自的 TypeScript 声明，按项目的 `import` / `require` 自动选择入口。五个核心 API、React 子入口和两种装饰器写法在两种模块格式下保持一致。Node.js 中混合使用 `import` 与 `require` 时，两个入口共用同一套响应式内核；浏览器和构建工具的原生 ESM 入口也共用内核。不要混用直接引用的 `dist/esm` 文件与 Node 条件入口。

构建目标为 ES2022。运行环境需要支持 Proxy、Reflect、WeakMap 和 AggregateError。本仓库开发与测试使用 Node.js 24。

## 快速开始

```ts
const state = reactive({ count: 1, message: 'hello' })
const double = computed(() => state.count * 2)

const stop = effect(() => {
    console.log(state.count, double.value)
}) // 立即输出：1 2

state.count = 2 // 同步输出：2 4

batch(() => {
    state.count = 3
    state.count = 4
}) // 结束前只输出一次：4 8

batch(() => {
    state.count = 5
    state.count = 4
}) // 回到批次初值，不输出

stop() // 停止订阅；重复调用也安全
state.count = 6 // 不再输出
```

## API

```ts
function reactive<T extends object>(target: T): T
function reactive(): <T extends object>(target: T) => T
function effect(fn: () => void): () => void
interface Computed<T> { readonly value: T }
function computed<T>(getter: () => T): Computed<T>
function batch<T>(fn: () => T): T
interface WatchOptions { immediate?: boolean }
function watch<T>(source: () => T, callback: (next: T, previous: T) => void,
    options?: WatchOptions & { immediate?: false }): () => void
function watch<T>(source: () => T, callback: (next: T, previous: T | undefined) => void,
    options?: WatchOptions): () => void
```

### reactive(target)

返回保持原始类型的响应式代理。普通对象、数组及普通用户类实例中的嵌套对象在读取时才创建代理，支持循环引用。

```ts
const raw = { profile: { name: 'Alice' } }
const state = reactive(raw)

reactive(raw) === state // true
reactive(state) === state // true
state.profile === state.profile // true

effect(() => console.log(state.profile.name))
state.profile.name = 'Bob' // 通知
state.profile = { name: 'Carol' } // 通知，并切换到新对象的依赖
```

必须通过代理读写以参与响应式；直接修改 `raw` 不会通知。不传参数的 `reactive()` 返回装饰器；显式传入 `undefined`、`null` 或其他基本类型会抛出 `TypeError`。`Map`、`Set`、`Date`、Promise、`URL`、`Headers` 等内建对象原样返回，整体替换它们所在的响应式属性仍会通知。

`reactive(Store)` 也可代理用户类构造函数，其静态数据、实例和方法行为与下文的 `@reactive` 相同。直接调用 `reactive(new Store())` 会代理实例属性，类方法不会因此自动进入批次。

### effect(fn)

立即执行一次回调，订阅同步执行期间实际读取的响应式属性。每次执行都会清除旧依赖并重新收集，因此条件分支改变后，不再订阅旧分支。

```ts
const state = reactive({ enabled: true, a: 1, b: 10 })
const stop = effect(() => {
    console.log(state.enabled ? state.a : state.b)
})

state.enabled = false // 输出 10
state.a = 2 // 不输出
state.b = 20 // 输出 20
stop()
```

返回值仅用于停止订阅，不是重新执行回调的 runner。回调的返回值不会作为清理函数使用。嵌套创建的 effect 需要分别停止；外层 effect 不会自动管理内层订阅。

通知同步执行，不合并到微任务。批次外连续两次赋值各自通知；批次内直到最外层边界结束才通知。同一个 effect 对同一批次的净变化只接收一次通知；其他 effect 随后的写入属于新批次，可以再次触发它。回调中的同步写入不会直接递归触发正在运行的自身，多个 effect 循环写入不属于支持的用法。

### computed(getter)

返回稳定的只读 `Computed<T>` 对象，通过 `.value` 取值。创建时不求值，首次读取时计算并缓存，依赖变化后失效，下次读取再计算。computed 可以依赖其他 computed。

```ts
const state = reactive({ count: 1 })
const double = computed(() => state.count * 2)
const label = computed(() => `double: ${double.value}`)

double.value // 2，首次计算
double.value // 2，复用缓存
state.count = 2 // 使缓存失效
label.value // 'double: 4'

watch(() => double.value, (next, previous) => console.log(previous, next))
```

`Computed` 是根入口导出的类型。外壳冻结且 value 没有 setter，不能赋值或当函数调用；计算结果本身保留原引用，不会自动代理或冻结。`reactive(double) === double`，对象或数组内保存 computed 也不自动解包。

迁移旧写法时，将 `double()` 改成 `double.value`，将 `watch(double, callback)` / `useWatch(double, callback)` 改成 `watch(() => double.value, callback)` / `useWatch(() => double.value, callback)`。提前解构 `const { value } = double` 只保存当时值，不保持监听。自动 getter 仍直接读取 `state.double`。

已有 effect 读取 computed 时，源属性变化会在批次结束时让该 effect 同步重跑，并按需计算新值。没有消费者读取则不会主动求值。

getter 应为同步、无副作用的计算，只依赖可追踪的数据。求值失败不会缓存失败结果，下次读取重试；循环读取会抛出明确错误。不会额外比较派生结果：例如 `computed(() => state.count % 2)` 的源从 1 变为 3 时，消费者仍会收到通知。

### getter 自动缓存

对象、实例及静态 getter 自动使用 computed 语义，无需显式调用 `computed`。缓存按接收对象隔离，继承同一 getter 的不同实例不会共享计算值。

```ts
const state = reactive({
    count: 1,
    get double() {
        return this.count * 2
    },
    set double(value: number) {
        this.count = value / 2
    },
})

effect(() => console.log(state.double)) // 2
state.double = 8 // count 变为 4，输出 8
```

配套 setter 内的可追踪字段写入会使 getter 缓存失效；setter 修改多个字段时，消费者在 setter 完成后统一收到通知。仅修改闭包变量、时间等不可追踪来源不会刷新缓存。

### batch(fn)

立即执行一次回调，保留返回值与泛型类型。传入非函数会抛出 `TypeError`。需要参数或接收对象时使用闭包：`batch(() => store.update(value))`。

```ts
const state = reactive({ count: 1, message: 'hello' })
const double = computed(() => state.count * 2)

const result = batch(() => {
    state.count = 2
    console.log(double.value) // 立即得到 4
    batch(() => {
        state.count = 3
        state.message = 'hi'
    }) // 内层结束不通知
    return state.count
}) // 最外层结束，统一通知后返回 3
```

写入立即生效，computed 每次依赖变化也立即失效。批次延迟的是 effect 通知，不隔离读取，也不回滚数据。批次内新建 effect 仍立即执行，可能读到中间状态；结束时遵循整个批次的净变化规则。

净变化按属性比较：

- 以最外层批次中首次改变前的状态为基线，`1 → 2 → 1` 不通知，`1 → 2 → 3` 通知一次。
- 数据值使用 `Object.is`，重复写入 `NaN` 不变化，`+0` 与 `-0` 不同；本库 raw/proxy 引用比较前统一为原对象。
- 属性存在性参与比较：不存在与值为 `undefined` 不同。新增后删除、删除后恢复同值数据属性，在最终状态相同时不通知。
- 对象不做深比较，嵌套字段独立追踪。访问器按 getter/setter 身份比较，不为比较而主动求值。
- 批次中途读取后，即使计算分支发生切换，结束时仍根据原有依赖判断净变化；临时分支不会造成额外通知。

### watch(source, callback, options?)

`source` 同步读取依赖并返回当前值，`callback` 接收新旧值。默认第一次只执行 source；`immediate: true` 时，在 watch 返回前执行一次 `callback(initialValue, undefined)`。之后 oldValue 为上一次成功求得的值。

```ts
const state = reactive({ count: 1 })
const stop = watch(() => state.count, (next, previous) => {
    console.log(previous, next)
}, { immediate: true }) // undefined, 1

batch(() => { state.count = 2; state.count = 3 }) // 1, 3
batch(() => { state.count = 4; state.count = 3 }) // 不通知
stop()
```

只有 source 的同步读取建立绑定，callback 中的读取不会被监听，也不会泄漏给外层 effect。依赖净变化时总会回调，不比较返回值：`watch(() => state.count % 2, cb)` 在 count 从 1 变到 3 时仍收到 `(1, 1)`。source 返回 `void` 或 `undefined` 也可正常监听。

对象结果保留引用，不深拷贝或隐式深监听。`watch(() => state.user, cb)` 监听 user 的替换；读取 `state.user.name` 才监听姓名。对象 oldValue 不是历史快照。回调返回值不作为清理函数；异步任务由调用方管理。

创建时读取一次 immediate，之后修改配置不会补发首次回调。首次 source 或首次 callback 抛错会立即清理订阅。后续 source 失败保留上一次成功值；后续 callback 失败则保留本次新值，其他通知仍继续执行。停止函数幂等，同步写回自身源不会直接递归调用当前 watcher。

## React 集成

支持 React 18.3.1 和 19。使用子入口的应用安装 React；使用 React DOM 和 TypeScript 时另外安装对应版本的 renderer 和类型。它们是可选 peer 或应用依赖，核心入口及核心声明不引用 React。

```sh
npm install react react-dom
npm install -D @types/react @types/react-dom
```

```tsx
import { reactive } from '@canlooks/reactive'
import { RC, useReactive, useWatch } from '@canlooks/reactive/react'

const store = reactive({ message: 'Hello' })

const Counter = RC((props: { count: number }) => {
    const local = useReactive({ clicks: 0 })
    useWatch(() => props.count, (next, previous) => {
        console.log(previous, next, props.count)
    })
    return <button onClick={() => local.clicks++}>
        {store.message}: {props.count} / {local.clicks}
    </button>
})
```

### 组件包装

`ReactiveComponent`（`RC`）同时接收普通同步函数组件和 React 类组件。`ReactiveFunctionComponent`（`RFC`）只接收函数，`ReactiveClassComponent`（`RCC`）只接收类。三组别名分别是同一个函数引用。RC/RFC 返回 `React.NamedExoticComponent<P>`，保留 JSX 必填 props；类包装保留构造、静态成员、实例类型与 ref。

函数组件自动包裹 `memo`，使用 React 原始 props 的默认 `Object.is` 比较。相同 props 的父级更新可跳过子组件；对象、函数引用变化仍正常更新。store、局部响应式字段、组件自身 React state 和 context 更新不会被 memo 屏蔽。`RC(Component) === RFC(Component)`；同一组件重复包装、本库包装结果再次传给 RC/RFC，都返回同一对象。

```tsx
import { PureComponent } from 'react'
import { RCC } from '@canlooks/reactive/react'

@RCC // 也可以用 @RC；组件包装不提供无参装饰器工厂
class Greeting extends PureComponent {
    render() { return <div>{store.message}</div> }
}
```

render 只记录本次实际读取的字段，成功提交才建立订阅；事件回调的读取不算 render 依赖，独立子组件也需各自包装。挂起或被放弃的 render 不改变已提交订阅。类组件通过 `forceUpdate` 响应外部数据，保留用户生命周期及历史参数，不代理整个组件实例。

本阶段不接收用户预先创建的 `memo`、`forwardRef`、`lazy` 对象，也不支持异步组件或 React 18 ref 转发。类组件在提交后复查读取版本，不承诺具有函数组件 `useSyncExternalStore` 的全部并发提交前保证。

### 局部状态与监听

`useReactive(initialObject)` 返回稳定的响应式对象，**不返回** React 原生 Hook 的 `[value, setValue]`。相同挂载忽略之后的新初值；不同内联对象各自独立，显式传同一个 raw 对象则共享代理。该 Hook 本身不会让普通组件自动响应，视图读取应放在 RC/RFC、Chip 或 Model 中。

原本从 `@canlooks/reactive/react` 导入的 `useState` 需改为 `useReactive`；库不再导出 `useState`。React 原生 `useState` 仍从 `react` 导入。

`useWatch` 支持与 watch 相同的 source、callback 和 `WatchOptions`，返回 `void`，卸载时自动停止。它也可用于普通函数组件。默认首次只建立绑定；`immediate: true` 的“立即”发生在提交后的 layout setup，首次参数是 `(initialValue, undefined)`，render 与 SSR 中不执行 callback。

```tsx
useWatch(() => local.clicks, (next, previous) => {
    // previous 在 immediate 模式下可能为 undefined
    console.log(previous, next)
}, { immediate: true })
```

后续提交使用最新 source/callback，普通重渲染或更改 immediate 不重新初始化。响应式 props 变化正常回调并保留旧值；普通 context 值或未包装组件 props 只静默刷新闭包与绑定，不模拟一次响应式变化。开发模式 StrictMode 可重复 setup/cleanup，immediate 也可随新建监听再次执行；最终每次挂载只保留一份有效订阅。source 和首次 callback 失败会立即停止对应监听。

### 响应式 props

函数组件收到同一挂载稳定的浅层只读 props 视图。render 中读取本次 props；监听和事件中读取最后已提交的 props。React 原始 props（包括开发模式冻结对象）不会被改写。顶层写入、删除、defineProperty 等操作被拒绝；嵌套普通对象、函数、children 和 React element 保留引用，已有 reactive store 字段仍可深层追踪。

```tsx
const View = RC((props: { count: number }) => {
    useWatch(() => props.count, (next, previous) => console.log(previous, next))
    return <div /> // 即使 JSX 没读 count，父级 1 → 2 提交后也会回调 (2, 1)
})
```

监听必须在 source 内读取 `props.count`。先 `const { count } = props` 再监听 `() => count` 只捕获普通值，不建立 props 监听。字段按存在性和 `Object.is` 通知，不做深比较；保存 props 代理也不等于保存历史快照。

props 发布发生在成功提交阶段，多字段变化合并通知。本轮 render 已覆盖的自身 props 变化不会再追加一次组件更新；watch、其他消费者照常通知。computed/getter 在 render 中使用本轮 props 的候选结果，挂起或放弃的结果不会覆盖已提交缓存。外部 store 变化、其他组件的 props，以及 watch callback 写入数据，仍可触发必要的后续更新。

类组件保留 React 原始 `this.props` 引用与生命周期的 `prevProps`。`watch(() => this.props.count, cb)` 追踪整个 props 槽，所以其他 props 字段改变也可能回调并传入相同 count；类中手动创建的 watch 需在卸载时自行 stop。原 `shouldComponentUpdate` 仍会调用，但存在活动 props 消费者且 props 浅层变化时会放行本次正常更新；其他情况遵循用户判断或 PureComponent 的浅比较。

批次在结束前把净变化通知交给 React，DOM 提交时机由 React 决定。SSR 不建立组件订阅或监听；每个请求应创建独立 store，hydration 前提供与服务端相同的数据。客户端首次提交按 immediate 配置初始化，不补发挂载前的历史变化。

### React API 一览

子入口共十八个运行时导出；接口和辅助类型仅用于 TypeScript。

| API | 用途 |
| --- | --- |
| `ReactiveComponent` / `RC` | 包装函数或类组件 |
| `ReactiveFunctionComponent` / `RFC` | 函数组件观察器，自动 memo |
| `ReactiveClassComponent` / `RCC` | 类组件观察器，支持类装饰器 |
| `useReactive` | 保存局部响应式对象 |
| `useWatch` | 提交后建立监听，卸载自动停止 |
| `Chip` / `chip` | 独立更新的同步 render 片段 |
| `Chip.Strict` / `strictChip` | 忽略父级 props 更新的片段 |
| `AsyncChip` / `asyncChip` | 首次 useEffect 后激活片段 |
| `AsyncChip.Strict` / `asyncStrictChip` | 延迟激活且忽略父级 props 更新 |
| `useModel` | 稳定的 `{ value, onChange }` 局部模型 |
| `Model` | 用 `source` 将单个子控件绑定到响应式属性 |
| `defineModel` | 生成使用 `refer` 的可复用模型组件 |
| `useLoading` | 稳定的 `load` 函数、loading 与并发计数 |

### Chip 局部更新

父组件只创建 element，Chip 渲染时才执行 `children()` 并收集自己的依赖。下例修改 a 只更新 A 片段，修改 b 只更新 B 片段；Index 没有在自己的 render 内读取这两个字段，因此不会被这些写入驱动。

```tsx
import { RC, Chip, useReactive } from '@canlooks/reactive/react'

export const Index = RC(() => {
    const data = useReactive({ a: 1, b: 2 })
    return <div>
        <Chip>{() => <button onClick={() => data.a++}>A: {data.a}</button>}</Chip>
        <Chip>{() => <button onClick={() => data.b++}>B: {data.b}</button>}</Chip>
    </div>
})
```

`chip(() => <Child />)` 等价于 `<Chip>{() => <Child />}</Chip>`；四个工厂只创建 element，可以在条件或列表中调用，不执行回调或调用 Hook。组件类型稳定，列表仍需提供 key。回调必须是无参数的同步、纯读取函数，可以返回文本、null、数组或 Fragment；非函数、async 函数或 Promise 结果会抛出 TypeError。不要在回调内调用 Hook；需要 Hook 时返回一个独立的子组件。子组件自己的响应式读取需由它自己的 RC/Chip 观察。

普通 Chip 在父组件更新时采用最新 children；`Chip.Strict` 忽略父级 props 更新，但仍响应自己的响应式依赖和 React context 更新。被跳过的新闭包不会偷偷替换旧回调，普通局部变量可能停留在旧值。需要持续读取最新值时使用稳定的 reactive 对象或 RC 的 props 视图，也可以使用普通 Chip，或更换 key 重建 Strict 片段。

```tsx
import { reactive } from '@canlooks/reactive'
import { AsyncChip, strictChip } from '@canlooks/reactive/react'

const data = reactive({ message: 'Hello' })

export function Delayed() {
    return <>
        {strictChip(() => data.message)}
        <AsyncChip fallback={<span>准备中…</span>}>{() => <div>{data.message}</div>}</AsyncChip>
        <AsyncChip.Strict fallback="准备中…">{() => data.message}</AsyncChip.Strict>
    </>
}
```

Async 只表示在首次 `useEffect` 后挂载观察片段。服务端与 hydration 首帧均输出 `fallback ?? null`；激活前不调用 children、不订阅其数据，激活时读取最新值。工厂 `asyncChip` / `asyncStrictChip` 使用默认空 fallback，需要自定义 fallback 时使用 JSX。它不等待 children 的 Promise，也不保证浏览器已经绘制一帧。

### Model 双向绑定

`useModel(initialValue)` 返回稳定的局部响应式对象和稳定的 onChange。初值只在首次挂载保存，函数初值按数据保存；onChange 支持直接值与对应原生控件事件，不解释 updater 函数。解构 onChange 不依赖 this。普通组件可将读取放在 Chip 内，或使用 RC/RFC。

```tsx
import { RC, Model, defineModel, useModel, useReactive } from '@canlooks/reactive/react'

const TextInput = defineModel(props => <input {...props} />)

export const Form = RC(() => {
    const name = useModel('Alice')
    const enabled = useModel(false)
    const data = useReactive({ nickname: 'Bob' })
    return <div>
        <input value={name.value} onChange={name.onChange} />
        <input type="checkbox" checked={enabled.value} onChange={enabled.onChange} />
        <p>{name.value}: {String(enabled.value)}</p>
        <Model source={() => data.nickname}><input /></Model>
        <TextInput refer={() => data.nickname} placeholder="昵称" />
    </div>
})
```

Model 自身是观察边界，控件同步写回和外部数据更新都不要求父组件订阅该字段。Model 使用 `source`，defineModel 的产物使用 `refer`，后者内部映射到 source；这些配置不会传入 DOM。defineModel 应在组件外创建，保留业务 props 的必填性、模型值类型和 onChange 参数元组。无注解箭头函数默认获得 input props 上下文；显式声明的控件必须包含 value/checked 和 onChange。

source/refer 必须直接选择一个可写的响应式属性，例如 `() => data.name`、`() => data.user.name`、`() => list[0]`、symbol 或空字符串 key。有 setter 的业务 getter 也可绑定。事件到达时重新解析当前路径，因此中间对象已被替换时写入新对象。事件处理器仅采用最后成功提交的 source、postValue 和子 onChange，挂起或放弃的候选不会生效。

常量、raw 对象属性、只读 props/getter、`computedValue.value`、算术/拼接和多条独立读取路径不属于属性选择器。运行时会拒绝可识别的无效或歧义引用，但 Proxy 无法证明任意 JavaScript 表达式都是可赋值位置；不能依靠碰巧相等的计算结果构造绑定。属性引用仅供库内部使用，没有新增公开 ref API。

| 输入 | 默认提取 |
| --- | --- |
| 文本 input、textarea、单选 select 事件 | 字符串 value |
| checkbox、单个布尔 radio 事件 | 布尔 checked |
| multiple select 事件 | 所选 value 的字符串数组 |
| 自定义组件直接值 | 第一个参数，包括对象和函数 |
| 提供 postValue | 原始参数完整传给转换函数一次，使用其结果 |

原生事件在调用期间同步读取 currentTarget/target。只有 target 字段的普通对象仍按数据处理。数值输入不会自动把字符串变成 number；应显式决定空值/NaN 的转换策略：

```tsx
import type { ChangeEvent } from 'react'
import { Model, useReactive } from '@canlooks/reactive/react'

export function Quantity() {
    const data = useReactive({ quantity: 1, checked: undefined as boolean | undefined })
    return <>
        <Model source={() => data.quantity}
            postValue={(event: ChangeEvent<HTMLInputElement>) => Number(event.currentTarget.value)}>
            <input type="number" />
        </Model>
        <Model source={() => data.checked} valueProp="checked"><input type="checkbox" /></Model>
    </>
}
```

`useModel<number>().onChange` 只接收 number，先转换再调用。默认布尔模型注入 checked，其他值注入 value；`valueProp="value"` 支持布尔 value 自定义控件，`valueProp="checked"` 支持初值为空的 checkbox。原生控件中，null/undefined 显示为 `''`、多选的 `[]` 或 checked 的 false，这些显示默认值不会写回模型；自定义组件保留原值。

Model 要求恰好一个有效子 element，不接受数组、多子节点、文本、Fragment、portal 或原生 file input。它覆盖选定的受控属性和 onChange，移除对应 defaultValue/defaultChecked，保留其他 props、children、key、ref。原生 checkbox 的提交用 value 也保留。自定义控件应遵循 value/onChange 或 checked/onChange；其他协议、radio group 等通过适配组件转换。

事件顺序为：解析引用、转换一次，在同一个同步 batch 中写模型一次，再用完整原参数调用原 onChange 一次。原回调可以读到新值，其额外写入也参与净变化结算。转换或写入失败不会调用原回调；原回调抛错不会回滚已成功的写入。

卸载后保留的 Model/useModel onChange 不再写状态或调用子回调；StrictMode 重连后可继续使用。SSR 只输出当前受控值，不写入、不建立观察订阅。Model 保留子 element 的 ref，但 defineModel 不提供 React 18 ref 转发、静态成员复制或任意泛型组件的完整高阶类型保真。

### useLoading 并发状态

`useLoading(fn, initialLoading?)` 返回稳定的 `{ load, loading, stacksCount }`，后两项只读。它不自动执行 fn；load 不依赖 this，每次调用固定最新已提交的 fn 和完整参数，始终返回 `Promise<Awaited<R>>`。后续渲染或新初值不会重置本次挂载的状态，进行中的请求继续使用开始时的函数。

```tsx
import { RC, useLoading, useReactive } from '@canlooks/reactive/react'

export const UserLoader = RC(() => {
    const state = useReactive({ name: '', error: '' })
    const { load, loading, stacksCount } = useLoading(async (id: number) => {
        const response = await fetch(`/api/user/${id}`)
        if (!response.ok) throw new Error(`请求失败: ${response.status}`)
        const user: { name: string } = await response.json()
        return user.name
    })
    return <div>
        <button disabled={loading} onClick={() => {
            state.error = ''
            void load(42).then(name => { state.name = name }).catch(error => {
                state.error = String(error)
            })
        }}>加载用户</button>
        <p>{loading ? `加载中 (${stacksCount})` : state.name}</p>
        <p>{state.error}</p>
    </div>
})
```

| initialLoading | 初始 loading / stacksCount | 接受调用后 | 所有调用结束后 |
| --- | --- | --- | --- |
| 省略 / false | false / 0 | 至少一个请求未完成时为 true | false / 0 |
| true | true / 0 | 首次调用后按实际未完成数驱动 | false / 0 |
| 非负安全整数 n | n / 0 | loading = n + stacksCount | n / 0 |

stacksCount 始终表示当前 Hook 实例真正未完成的调用数。数值初值是基线，不是假请求：初值 0 的两个并发调用可观察到 `0 → 1 → 2 → 1 → 0`，初值 2 则是 `2 → 3 → 4 → 3 → 2`。非法数值初值（负数、小数、NaN、Infinity 等）抛出 TypeError。布尔 true 在从未调用时保持 true。布尔/数值类型均会拓宽，不把字面量 true 或 0 当成恒定返回类型。

普通返回值、Promise、thenable 都统一处理，成功值和业务异常原样交给调用者。每个调用无论成功、失败或乱序完成都只释放自己的计数；状态发布的同步消费者也抛错时保留全部错误，必要时使用 AggregateError。调用方应处理 load 的拒绝。

load 应来自事件、已提交 effect 或其他业务回调，不在 render/SSR 中调用。首次提交前或断开后调用遗留 load 会拒绝且不启动 fn。卸载不会取消进行中的 Promise，它们继续向原调用者兑现并释放内部计数，但不再发布旧实例状态；StrictMode 或隐藏树重连会按实际未完成数恢复。不同实例和真正重新挂载的计数互相独立。

useLoading 不自动提供取消、超时、去重、串行队列、错误字段或“只保留最后一次结果”；可由 fn 接收 AbortSignal 等参数实现业务策略。普通函数组件不会因使用 Hook 隐式刷新，显示 loading 的读取需放在 RC/RFC 或 Chip 内。

## 类装饰器与方法自动批处理

TypeScript 使用传统类装饰器配置：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true
  }
}
```

```ts
@reactive() // 也可写成 @reactive，效果相同
class Store {
    static count = 1

    static increase() {
        this.count++
        this.count++
    }

    constructor(public count = 1) {}

    get double() {
        return this.count * 2
    }

    increase(by = 1) {
        this.count += by
        this.count += by
        return this.count
    }

    roundTrip() {
        this.count++
        this.count--
    }
}

const store = new Store(1)
effect(() => console.log(store.count, store.double)) // 1 2
store.increase() // 一次通知：3 6；返回 3
store.roundTrip() // 不通知

effect(() => console.log(Store.count)) // 1
Store.increase() // 一次通知：3
```

装饰器支持 `@reactive` 和 `@reactive()`，两种写法的实例响应式、静态成员、getter 缓存和方法自动批处理行为相同。不使用装饰器时，`const ReactiveStore = reactive(Store)` 提供相同功能。

用户类原型上的实例方法及非枚举静态方法自动进入批次，包含继承方法。方法互调、`super` 调用、显式 `batch` 共用最外层边界。构造参数、返回值、异常、原型与 `instanceof` 语义保留。

重复读取方法返回同一个包装函数。包装不绑定 `this`，`.call` / `.apply` 仍使用调用者提供的接收对象；提取方法后无接收对象直接调用，遵循原方法的规则。

普通对象的函数属性、实例自有函数字段、静态函数字段、getter 返回的函数及数组原型方法不自动包装。构造函数中的箭头函数字段或 `.bind(this)` 捕获的是构造时的对象，不应依赖它们完成响应式写入；使用原型方法和代理接收对象。

## 同步与异步边界

`batch` 不等待 Promise，正常返回时保留原 Promise 身份。async 回调或 async 类方法只有返回 Promise 前的同步部分属于当前批次；`await` 后需要再次显式批处理。

```ts
const state = reactive({ count: 0 })

const pending = batch(async () => {
    state.count++
    state.count++ // 前两次写入统一通知

    await Promise.resolve()

    batch(() => {
        state.count++
        state.count++ // 新批次，再通知一次
    })
})

await pending
```

未包裹的 `await` 后写入各自同步通知。微任务、定时器和生成器后续迭代也不会延续之前的批次。effect 只收集同步调用期间的读取，异步回调中的读取不归属原 effect。

## 异常处理

批次回调、setter 或类方法抛错时，已成功的写入仍会在最外层退出时结算。一个 effect 更新失败不阻止其他已排队的 effect 执行，更新失败的节点仍可响应后续变化。

只有一个异常时原样抛出；回调和通知同时失败，或多个 effect 失败时，抛出 `AggregateError`，回调异常排在 `errors` 的首位。首次执行就抛错的 effect 会自动停止，避免留下无法停止的订阅。异常之后依赖收集与批处理仍可继续使用。

## 数组与使用范围

支持数组索引、`length`、`push`、索引删除和长度截断。写入索引隐式增加长度、缩短长度隐式删除元素时，都通知实际受影响的属性。稀疏数组截断只枚举实际自有索引。

```ts
const list = reactive([1, 2, 3])
effect(() => console.log(list.length, list[2]))

batch(() => {
    list.push(4)
    list.pop()
}) // 完全恢复，不通知

batch(() => {
    list.length = 1
    list.length = 3
}) // 尾部元素已丢失，读取 list[2] 的消费者仍会收到通知
```

数组原型方法保持原样。单独调用 `splice` 等方法时，底层多次写入可能分别通知；使用显式 batch 或响应式类方法合并通知。

首版边界：

- 不追踪 `in`、`Object.keys`、`for...in` 的结构变化，也不承诺 `defineProperty`、`setPrototypeOf` 的响应式通知。
- 不可配置且不可写的自有属性返回原值，以满足 Proxy 不变量；固定对象引用不强制深层代理。
- 不支持 ES `#private` 字段、依赖原生内部槽的类及多种改变构造行为的装饰器混用。TypeScript `private` 普通字段可使用。
- 通过保留的原始对象、原始类名或原型直接写入会绕过追踪；静态方法和静态 getter 应通过 `this` 访问数据。
- 不提供数组搜索的 raw/proxy 身份修正、内部读取屏蔽或特殊锁定索引兼容。
- 根入口只有五个核心 API，React 从独立子入口导入。不包含旧版持久化、`ref` 或异步事务。

## 本地开发与验证

```sh
npm install
npm test                 # 行为测试、源码类型检查、测试类型检查
npm run build           # 生成 dist/esm、dist/cjs 及对应类型声明
npm run test:dist       # 验证 ESM、CJS、混合引用及两种模块的消费端类型
npm pack --dry-run      # 检查包内文件；prepack 会自动构建
npm run test:package    # 实际 tarball：无 React 核心消费者及 React 18.3/19 隔离消费者
```

也可单独执行 `npm run test:node`、`npm run test:react`、`npm run typecheck`、`npm run typecheck:test`、`npm run typecheck:react`。构建后可运行 `npm run typecheck:dist`，检查两个入口在 ESM 与 CommonJS 消费端的类型。行为测试使用 Node 的 `node:test`、`node:assert/strict`，React 测试使用 jsdom、真实 React DOM 与 act。

构建脚本先用 TypeScript 生成原生 ESM 和声明文件，再用开发依赖 esbuild 转换出 CommonJS。`dist/cjs/package.json` 标识该目录中的代码和声明为 CommonJS；`exports` 分别指定两种格式的代码和类型入口。发布包没有运行时依赖。

源码分为依赖与批次内核（`effect.ts`）、公开批处理入口（`batch.ts`）、计算缓存（`computed.ts`）、对象/类代理（`reactive.ts`）、内部属性位置捕获（`reference.ts`）和监听（`watch.ts`）；`index.ts` 仅导出五个核心运行时 API，以及 Computed/WatchOptions 类型。`react/` 包含提交观察器、props 视图、共享闭包提交、组件适配、Chip、Model 和 loading，内核不反向依赖 React。`test/reference.ts` 与 `test/react-features.tsx` 补充新增能力，完整 React 行为测试会在实际 tarball 的 React 18.3/19 隔离环境中复跑。打包验证仅在本地执行，不发布 npm 包。
