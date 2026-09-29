# @canlooks/reactive 设计方案

这是一个基于js/ts Proxy对象实现的轻量级数据响应式框架。

## 1 基础原理

通过Proxy感知数据的变化，从而做出相应动作。

## 2 核心功能

### 2.1 响应式数据

`reactive`作为一个通用api，用于创建响应式数据，例如：

```ts
const state = reactive({count: 1, message: 'hello'})
```

或：

```ts
@reactive
class Store {
    count = 1
    message = 'hello'

    static info = '@canlooks/reactive'
}

const store = new Store()
```

使用修饰器创建时，静态类与类的实例均为响应式对象。因此上述例子得到的`state`、`Store`与`store`均是响应式数据。

### 2.2 副作用与依赖绑定

`effect`方法用于定义副作用函数，副作用函数会自动绑定响应式数据对应的属性，如：

```ts
const dispose1 = effect(() => {
    console.log(`Count is: ${state.count}`)
})

const dispose2 = effect(() => {
    console.log(`Message is: ${state.message}`)
})

state.count++ // Count is: 2
state.message = 'Hi' // Message is: Hi
```

副作用函数会在定义时立即执行一次，从而获取绑定关系。而后每次执行都会更新绑定关系，确保副作用中所有引用到的属性全部建立起绑定关系。

当响应式数据中的属性变化时，所有已与该属性绑定的副作用都会触发

### 2.3 计算属性

`computed`方法用于定义一个计算属性，计算属性仅会在首次读取或依赖变化后才重新计算。

```ts
const double = computed(() => state.count * 2)

double.value // 2

const greeting = computed(() => state.message + ' canlooks')

greeting.value // Hello canlooks
```

仅在首次执行`double.value`或`state.count`变化后才执行count * 2。`greeting`同理

`getter`属性会自动定义成计算属性，如：

```ts
const state = reactive({
    count: 1,
    get double() {
        return this.count * 2
    }
})
```

### 2.4 批处理

`batch`方法包裹的同步方法会进入批处理：
- 批处理中变化的响应式数据仅做临时标记，不会立即触发副作用。
- 计算属性除外，批处理中的计算属性如果依赖变化也会立即标为`需要重新计算`。因为修改数据后有可能立即读取其派生的计算属性，这是应该能获取到新的计算结果。
- 批处理结束后统一判断哪些数据`真正的变化了`。`1 -> 2 -> 1`这种变回初始值的情况则认为数据没有变化，不触发相关副作用。
- 变化多次的数据也只触发一次相关副作用，如`1 -> 2 -> 3`这种情况仅触发一次相关副作用。

`batch`有两种使用方法，1.主动执行。2.修饰器自动分配。如：

```ts
// 主动执行批处理函数
batch(() => {
    state.count++
})

@reactive
class Store {
    count = 1

    // 自动定义成批处理函数，内部遵循批处理逻辑
    increase() {
        this.count++
    }
}

const store = new Store()

store.increase() // 执行批处理函数
```

### 2.5 监听函数

`watch`用于定义监听函数，其效果与`effect`类似，但绑定方法与副作用分开，如：

```ts
const dispose = watch(() => state.count, (newValue, oldValue) => {
    console.log(`Count change from ${oldValue} to ${newValue}`)
}, {immediate: false})
```

- 第一个参数为绑定方法，第二个参数为副作用函数，绑定方法中引用的属性会与副作用函数绑定。
- 首次定义仅执行绑定方法，不会执行副作用函数。
- 属性变化后会执行副作用函数，同时绑定方法也会执行以更新依赖关系。
- 绑定方法如果有返回值，新旧返回值会作为参数传入副作用函数。
- 第三个为可选参数，支持immediate属性，默认值为`false`。设为true时，副作用函数会立即执行。

## 3 React 集成

本框架可与React集成使用，但`React`并非必须的依赖。用户可在项目内安装`React`后使用集成功能，但不安装`React`也不影响其他功能使用。

### 3.1 响应式组件

可通过通用`ReactiveComponent`Api定义响应式组件，如：

```tsx
const Index = ReactiveComponent(() => {
    return (
        <div>Count is: {state.count}</div>
    )
})
```

此时`state.count`变化会使`Index`组件重新渲染。

`ReactiveComponent`也支持修饰器形式，用于class组件：

```tsx
@ReactiveComponent
class Index extends PureComponent {
    render() {
        return (
            <div>Count is: {state.count}</div>
        )
    }
}
```

- `ReactiveComponent`包裹的函数式组件会自动包上`memo`。
- 除此之外还支持`RC`作为`ReactiveComponent`的alias；
- `ReactiveFunctionComponent`明确指定用于函数式组件，`RFC`作为alias；
- `ReactiveClassComponent`明确指定用于类组件，`RCC`作为alias；

### 3.2 局部状态与局部监听函数

`useReactive`定义组件内的局部响应式数据

```ts
const state = useReactive({
    count: 1
})
```

`useWatch`定义局部监听函数，效果与`watch`方法相同，但会在组件销毁时自动销毁监听函数。

```ts
useWatch(() => state.count, (newValue, oldValue) => {
    console.log(`Count change from ${oldValue} to ${newValue}`)
})
```

### 3.3 响应props

`React`组件的`props`属性会被自动定义成响应式数据，可与自定义监听函数绑定，如：

```tsx
const Index = RC((props: { count: number }) => {
    useWatch(() => props.count, () => {
        console.log(`Count is: ${props.count}`)
    })

    return <div></div>
})
```

props需要特殊处理，因为props改变原本就会使组件重新渲染，而`RC`组件自带数据响应，props现又作为响应式数据。因此需保障props改变不会导致组件重复渲染2次。

### 3.4 Chip组件

`Chip`组件用于定义一个局部更新的jsx片段，如：

```tsx
const Index = RC(() => {
    const data = useReactive({a: 1, b: 2})

    return (
        <div>
            <Chip>
                {/* Only re-renders when data.a changes */}
                {() => <ChildA value={data.a} />}
            </Chip>
            <Chip>
                {/* Only re-renders when data.b changes */}
                {() => <ChildB value={data.b} />}
            </Chip>
        </div>
    )
    // Parent component Index never re-renders
})
```

同时支持函数形式的定义：

```tsx
// Equivalent to <Chip>{() => <Child />}</Chip>
chip(() => <Child />)
```

chip的额外用法：

| Component / Function | Description |
|----------------------|-------------|
| `<Chip>` / `chip()` | Wraps render in a reactive effect |
| `<Chip.Strict>` / `strictChip()` | Memoized variant — never re-renders from parent props |
| `<AsyncChip>` / `asyncChip()` | Defers rendering until after the first `useEffect`; children still render synchronously |
| `<AsyncChip.Strict>` / `asyncStrictChip()` | Async + Strict combined |

### 3.5 Model双向绑定

Two-way binding for form controls. Keeps a reactive value synced with an `<input>`, `<select>`, or any controlled component.

**`useModel(initialValue)`** — Hook returning `{value, onChange}`:

```tsx
import {RC, useModel} from '@canlooks/reactive/react'

const Form = RC(() => {
    const name = useModel('Alice')

    return (
        <div>
            <input value={name.value} onChange={name.onChange}/>
            <p>Current: {name.value}</p>
        </div>
    )
})
```

**`<Model>`** — Wraps a child element with two-way binding:

```tsx
import {RC, useReactive, Model} from '@canlooks/reactive/react'

const Form = RC(() => {
    const data = useReactive({name: 'Alice'})

    return (
        <Model source={() => data.name}>
            <input />
        </Model>
    )
})
```

**`defineModel(Component, postValue?)`** — HOC for reusable model components:

```tsx
import {defineModel} from '@canlooks/reactive/react'

const TextInput = defineModel(props => <input {...props} />)

// Usage
<TextInput refer={() => data.name} />
```

### 3.6 `useLoading(fn, initialLoading?)`

Tracks the loading state of an async function. Returns `{load, loading, stacksCount}`.

```tsx
import {RC, useLoading} from '@canlooks/reactive/react'

const Comp = RC(() => {
    const {load, loading} = useLoading(async (id: number) => {
        const res = await fetch(`/api/user/${id}`)
        return res.json()
    })

    return loading
        ? <div>Loading...</div>
        : <button onClick={() => load(42)}>Fetch User</button>
})
```

When `initialLoading` is a `number`, `loading` acts as a stack counter (increments for concurrent calls, decrements on return) instead of a boolean.
