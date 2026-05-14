# @canlooks/reactive

A lightweight, fine-grained reactive state management framework for React. No providers, no context — just mutate data and components update automatically.

## Features

- **Auto-allocation**: Properties, getters, and methods are automatically classified as reactive data, computed values, or batched actions
- **Dependency-aware rendering**: Components only re-render when the specific properties they reference change
- **Fine-grained updates**: `<Chip/>` enables partial re-renders without touching the parent component
- **"No-provider" sharing**: Reactive data created anywhere is automatically accessible — no `Provider`, no `inject`
- **Deep reactivity**: Optional recursive reactivity for nested objects with `reactive.deep()`
- **Form bindings**: `<Model/>` and `useModel()` provide two-way binding for form controls
- **Built-in persistence**: Sync reactive state with `localStorage`, `sessionStorage`, or custom async storage engines
- **TypeScript-first**: Full type inference throughout

## Installation

```bash
npm i @canlooks/reactive
```

## Quick Example

### Class Component

```tsx
import {RC} from '@canlooks/reactive/react'

@RC
export default class Counter extends React.Component {
    count = 1
    unused = 2

    onClick = () => {
        this.count++  // Component updates — "count" is referenced in render()
    }

    noOp = () => {
        this.unused++  // Component does NOT update — "unused" is never referenced in render()
    }

    render() {
        return (
            <div>
                <div>{this.count}</div>
                <button onClick={this.onClick}>Increase</button>
            </div>
        )
    }
}
```

### Function Component

```tsx
import {RC, useReactive} from '@canlooks/reactive/react'

const Counter = RC(() => {
    const data = useReactive({
        count: 1
    })

    return (
        <div>
            <div>{data.count}</div>
            <button onClick={() => data.count++}>Increase</button>
        </div>
    )
})
```

---

## Core Concepts

### Automatic Allocation

Every property in a reactive object or class instance is automatically classified:

```tsx
import {reactive} from '@canlooks/reactive'

const data = reactive({
    // Plain property → reactive (tracked for dependency)
    count: 1,

    // Getter → computed (memoized, re-evaluates only when dependencies change)
    get double() {
        return this.count * 2
    },

    // Method → action (batched — all mutations inside fire as one update)
    increase() {
        this.count++
    }
})
```

You can **opt-out** individual properties using the `@ignore` decorator.

### Dependency Tracking

Components subscribe **only** to the properties they actually read during render. If `data.count` changes, only components that accessed `data.count` will re-render. Components that only accessed `data.b` are unaffected.

### Batching with `action()` / `act()`

Multiple mutations outside an action trigger multiple updates. Wrap them to batch:

```tsx
import {reactive, reactor, action, act} from '@canlooks/reactive'

const data = reactive({a: 1, b: 2})

reactor(() => [data.a, data.b], (next, prev) => {
    console.log('changed!')
})

// Bad — effect fires twice
data.a++; data.b++

// Good — effect fires once
action(() => {
    data.a++
    data.b++
})()

// Equivalent IIFE form
act(() => {
    data.a++
    data.b++
})
```

---

## API Reference

### `@canlooks/reactive` — Core

#### `reactive(target)` / `reactive.deep(target)`

Creates a reactive object or class. Accepts an object literal, a class, or used as a decorator.

```tsx
import {reactive} from '@canlooks/reactive'

// Object
const data = reactive({a: 1, b: 2})

// Class (constructor)
const DataClass = reactive(class {
    a = 1
    static b = 2  // Static properties are also reactive
})

// Class (decorator)
@reactive
class Data {
    a = 1
}
```

`reactive.deep(target)` enables recursive reactivity — nested objects and arrays are also proxied.

```tsx
const data = reactive.deep({
    nested: {count: 0}
})
data.nested.count++  // Deeply tracked
```

#### `reactiveClass(target)` / `reactiveClass.deep(target)`

Explicitly create a reactive class. Use when `reactive()` cannot distinguish between a class and a regular function.

```tsx
import {reactiveClass} from '@canlooks/reactive'

const MyClass = reactiveClass(class {
    value = 0
})
```

#### `reactiveObject(target)` / `reactiveObject.deep(target)`

Explicitly create a reactive object without class-allocation logic.

```tsx
import {reactiveObject} from '@canlooks/reactive'

const data = reactiveObject({count: 0})
```

#### `@ignore`

Property decorator — excludes a property from auto-allocation on a reactive class.

```tsx
import {reactive, ignore} from '@canlooks/reactive'

@reactive
class Data {
    a = 1

    @ignore
    internal = Symbol()  // Not reactive, not tracked
}
```

#### `reactor(refer, effect, options?)`

Watches a derived value and fires `effect` when it changes. Returns a dispose function.

```tsx
import {reactive, reactor, act} from '@canlooks/reactive'

const obj = reactive({a: 1, b: 2})

const dispose = reactor(() => obj.a, (newValue, oldValue) => {
    console.log(`a changed from ${oldValue} to ${newValue}`)
})

act(() => obj.a++)  // Logs: a changed from 1 to 2
act(() => obj.b++)  // Nothing happens

dispose()  // Stop watching
```

Options:

| Option | Type | Description |
|--------|------|-------------|
| `immediate` | `boolean` | Run effect immediately on creation (default: `false`) |
| `once` | `boolean` | Dispose after first invocation (default: `false`) |

#### `autorun(fn)`

Automatically tracks all reactive properties accessed inside `fn`. Re-runs whenever any of them change. Returns a dispose function.

```tsx
import {reactive, autorun, act} from '@canlooks/reactive'

const obj = reactive({a: 1})

const dispose = autorun(() => {
    console.log('a is now:', obj.a)
})

act(() => obj.a++)  // Logs: a is now: 2
```

#### `action(fn)`

Wraps a function so that all reactive mutations inside it are batched into a single update cycle.

```tsx
import {reactive, action} from '@canlooks/reactive'

const data = reactive({a: 1})

const increment = action(() => {
    data.a++  // Batched
})

increment()
```

#### `act(fn)`

IIFE (Immediately Invoked Function Expression) for `action()`.

```tsx
import {act} from '@canlooks/reactive'

act(() => {
    // Mutations here are batched
})
```

#### `getOriginalObject(proxy)`

Returns the raw (unproxied) object behind a reactive proxy.

```tsx
import {reactive, getOriginalObject} from '@canlooks/reactive'

const data = reactive({a: 1})
const raw = getOriginalObject(data)
console.log(raw)  // {a: 1}
```

---

### `@canlooks/reactive/react` — React Integration

#### `RC` / `reactiveComponent(target)`

The main entry point. Wraps a React component (class or function) to make it reactive. Automatically detects component type.

```tsx
import {RC, useReactive} from '@canlooks/reactive/react'

// Function component
const Counter = RC(() => {
    const data = useReactive({count: 1})
    return <div onClick={() => data.count++}>{data.count}</div>
})

// Class component
@RC
class Counter extends React.Component {
    count = 1
    render() {
        return <div onClick={() => this.count++}>{this.count}</div>
    }
}
```

`RC.deep` / `reactiveComponent.deep` enables deep reactivity on class component properties.

#### `reactiveFC(target)`

Explicitly wraps a function component. Use when you need manual type discrimination.

```tsx
import {reactiveFC} from '@canlooks/reactive/react'

const MyComp = reactiveFC((props: {name: string}) => {
    return <div>{props.name}</div>
})
```

#### `reactiveClassComponent(target)` / `reactiveClassComponent.deep(target)`

Explicitly wraps a class component.

```tsx
import {reactiveClassComponent} from '@canlooks/reactive/react'

const MyClassComp = reactiveClassComponent(class extends React.Component {
    value = 0
    render() {
        return <div>{this.value}</div>
    }
})
```

---

### React Hooks

#### `useReactive(initialValue, options?)`

Creates a stable reactive object that persists across re-renders. Accepts a value or a factory function.

```tsx
import {RC, useReactive} from '@canlooks/reactive/react'

const Comp = RC(() => {
    const data = useReactive({
        count: 1,
        name: 'world'
    })

    // Or lazy initialization
    const lazy = useReactive(() => ({
        count: expensiveComputation()
    }))

    return <div>{data.count}</div>
})
```

#### `useAutorun(fn)`

Runs `autorun` scoped to the component's lifecycle (auto-disposes on unmount).

```tsx
import {RC, useReactive, useAutorun} from '@canlooks/reactive/react'

const Comp = RC(() => {
    const data = useReactive({count: 1})

    useAutorun(() => {
        console.log('count changed:', data.count)
    })

    return <div>{data.count}</div>
})
```

#### `useReactor(refer, effect, options?)`

Runs `reactor` scoped to the component's lifecycle.

```tsx
import {RC, useReactive, useReactor} from '@canlooks/reactive/react'

const Comp = RC(() => {
    const data = useReactive({name: 'Alice'})

    useReactor(() => data.name, (newName, oldName) => {
        console.log(`Name changed: ${oldName} → ${newName}`)
    })

    return <input {...useModel(data.name)} />
})
```

#### `useAction(fn)`

Wraps a callback in `action()` with a stable reference (like `useCallback`).

```tsx
import {RC, useReactive, useAction} from '@canlooks/reactive/react'

const Comp = RC(() => {
    const data = useReactive({a: 1, b: 2})

    const increment = useAction(() => {
        data.a++
        data.b++  // Batched with data.a++
    })

    return <button onClick={increment}>Increment Both</button>
})
```

#### `useExternalReactive(refer)`

Subscribes to an externally-defined reactive value — triggers re-render when it changes.

```tsx
import {reactive, act} from '@canlooks/reactive'
import {RC, useExternalReactive} from '@canlooks/reactive/react'

const store = reactive({count: 0})

const Comp = RC(() => {
    const count = useExternalReactive(() => store.count)
    return <div>{count}</div>
})

// Anywhere in the app:
act(() => store.count++)  // Comp re-renders
```

---

### Components

#### `<Chip>` / `chip()`

Fine-grained partial update. Anything inside `<Chip>` subscribes to its own reactive dependencies independently of the parent.

```tsx
import {RC, useReactive, Chip} from '@canlooks/reactive/react'

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

Function form:

```tsx
import {chip} from '@canlooks/reactive/react'

// Equivalent to <Chip>{() => <Child />}</Chip>
return chip(() => <Child />)
```

**Chip variants:**

| Component / Function | Description |
|----------------------|-------------|
| `<Chip>` / `chip()` | Wraps render in a reactive effect |
| `<Chip.Strict>` / `strictChip()` | Memoized variant — never re-renders from parent props |
| `<AsyncChip>` / `asyncChip()` | Defers rendering until after `useEffect` (avoids React mount warnings) |
| `<AsyncChip.Strict>` / `asyncStrictChip()` | Async + Strict combined |

#### `<Model>` / `defineModel()` / `useModel()`

Two-way binding for form controls. Keeps a reactive value synced with an `<input>`, `<select>`, or any controlled component.

**`useModel(initialValue)`** — Hook returning `{value, onChange}`:

```tsx
import {RC, useModel} from '@canlooks/reactive/react'

const Form = RC(() => {
    const name = useModel('Alice')

    return (
        <div>
            <input {...name} />
            <p>Current: {name.value}</p>
        </div>
    )
})
```

**`<Model>`** — Wraps a child element with two-way binding:

```tsx
import {RC, useReactive, Chip} from '@canlooks/reactive/react'

const Form = RC(() => {
    const data = useReactive({name: 'Alice'})

    return (
        <Chip refer={() => data.name}>
            <input />
        </Chip>
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

---

### Loading & Autoload

#### `useLoading(fn, initialLoading?)`

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

#### `useAutoload(loadData, options?)`

Defines a lazy-loading data object that loads on first access.

```tsx
import {RC, useAutoload} from '@canlooks/reactive/react'

const Comp = RC(() => {
    const user = useAutoload(async () => {
        const res = await fetch('/api/user')
        return res.json()
    })

    // Auto-loads on first access
    return <div>{user.loading ? 'Loading...' : user.data?.name}</div>
})
```

---

### Decorators

#### `@watch(refer, options?)`

Class method decorator — syntactic sugar for `reactor()`. The decorated method runs whenever the referenced value changes.

```tsx
import {watch} from '@canlooks/reactive'
import {RC} from '@canlooks/reactive/react'

@RC
class Index extends React.Component {
    a = 1

    @watch(ctx => ctx.a)
    onAChanged(newValue: number, oldValue: number) {
        console.log(`a: ${oldValue} → ${newValue}`)
    }

    @watch(() => externalStore.value)
    onExternalChange(newVal: any) {
        // Called when externalStore.value changes
    }
}
```

#### `@loading(refer)`

Class method decorator — toggles a boolean or increments a counter property during async method execution.

```tsx
import {loading} from '@canlooks/reactive'
import {RC} from '@canlooks/reactive/react'

@RC
class Index extends React.Component {
    busy = false
    stack = 0

    // Boolean loading: sets busy = true during execution, false afterwards
    @loading(ctx => ctx.busy)
    async fetchData() {
        const res = await fetch('/api/data')
        return res.json()
    }

    // Stack loading: increments stack during execution, decrements afterwards
    @loading(ctx => ctx.stack)
    async concurrentTask() {
        // Multiple concurrent calls increase the stack
    }

    render() {
        return this.busy ? <div>Loading...</div> : <div>Ready</div>
    }
}
```

---

### `Autoload` / `defineAutoload()`

A pattern for data that auto-loads on first access and can be manually refreshed. Available from both the core and React packages.

```tsx
import {reactive, Autoload} from '@canlooks/reactive'

@reactive
class UserData extends Autoload {
    async loadData(id: number) {
        const res = await fetch(`/api/user/${id}`)
        return res.json()
    }
}

const user = new UserData()

// Auto-loads on first access
console.log(user.data)  // Triggers fetch

// Manually refresh with new params
await user.update(42)
```

Or with the factory function:

```tsx
import {defineAutoload} from '@canlooks/reactive'

const user = defineAutoload(async (id: number) => {
    const res = await fetch(`/api/user/${id}`)
    return res.json()
})
```

Autoload API:

| Member | Description |
|--------|-------------|
| `loading` | `boolean` — whether data is currently loading |
| `data` | The loaded data (lazy — triggers `loadData` on first get) |
| `setData(v)` | Override the data value |
| `load()` | Trigger load (deduplicates concurrent calls) |
| `update(...args)` | Load with arguments, managing loading state |
| `loadData(...args)` | **Abstract** — implement your data-fetching logic here |
| `onLoad()` | Optional callback after data is loaded |

---

### Storage — `defineStorage()` / `registerStorageEngine()`

Creates a reactive object that automatically persists to `localStorage` or `sessionStorage`.

```tsx
import {defineStorage} from '@canlooks/reactive'

const user = defineStorage('user', {
    name: 'canlooks',
    age: 18
})

// Mutations sync to localStorage automatically
user.age++       // localStorage['user'] updated
user.name = 'Bob' // localStorage['user'] updated
```

Options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `'localStorage' \| 'sessionStorage'` | `'localStorage'` | Storage backend |
| `async` | `boolean` | `true` | Sync after `nextTick` instead of synchronously |
| `debounce` | `number` | — | Debounce writes by this many ms |
| `deep` | `boolean` | `false` | Deep reactivity |

For non-browser environments, register a custom storage engine:

```tsx
import {registerStorageEngine, defineStorage} from '@canlooks/reactive'

registerStorageEngine({
    setItem(key, value) { /* ... */ },
    getItem(key) { /* ... */ },
    removeItem(key) { /* ... */ }
})

const data = defineStorage('my-key', {value: 1})
```

---

### Async Storage — `defineAsyncStorage()` / `registerAsyncStorageEngine()`

Same as `defineStorage()`, but for async storage backends (e.g., React Native AsyncStorage, Electron storage).

```tsx
import {registerAsyncStorageEngine, defineAsyncStorage} from '@canlooks/reactive'
import AsyncStorage from '@react-native-async-storage/async-storage'

registerAsyncStorageEngine(AsyncStorage)

const settings = await defineAsyncStorage('settings', {
    theme: 'dark',
    lang: 'en'
})

settings.theme = 'light'  // Synced asynchronously
```

---

### `@canlooks/reactive/forage` — IndexedDB Persistence

Uses [localforage](https://github.com/localForage/localForage) for IndexedDB storage with optional fallback.

```tsx
import {defineForage} from '@canlooks/reactive/forage'

const user = defineForage('user', {name: 'Alice', age: 30})

// Automatically loads from IndexedDB on first access
console.log(user.data)       // {name: 'Alice', age: 30}
console.log(user.loading)    // false

// Mutations are persisted to IndexedDB
user.data.name = 'Bob'

// Manual refresh
await user.update()
```

`Forage` extends `Autoload`, so it supports all `Autoload` methods:

```tsx
import {Forage} from '@canlooks/reactive/forage'

class UserStore extends Forage<User> {
    constructor() {
        super('user', {name: ''})
    }

    async loadData() {
        // Custom load logic
        const cached = await localforage.getItem(this.name)
        return cached ?? {name: 'Guest'}
    }
}
```

---

## External Data & Sharing State

No providers, no context — create reactive data anywhere and use it everywhere.

```tsx
// shared/store.ts
import {reactive} from '@canlooks/reactive'

export const store = reactive({
    user: {name: 'Alice'},
    count: 0
})
```

```tsx
// ComponentA.tsx
import {RC} from '@canlooks/reactive/react'
import {store} from './store'

export const CompA = RC(() => {
    // Only re-renders when store.count changes
    return <div>{store.count}</div>
})
```

```tsx
// ComponentB.tsx
import {RC} from '@canlooks/reactive/react'
import {store} from './store'

export const CompB = RC(() => {
    // Only re-renders when store.user.name changes
    return <div>{store.user.name}</div>
})
```

```tsx
// anywhere.ts
import {act} from '@canlooks/reactive'
import {store} from './store'

act(() => store.count++)  // CompA re-renders, CompB does NOT
```

---

## Module Structure

| Entry Point | Contents |
|-------------|----------|
| `@canlooks/reactive` | Core: `reactive`, `reactor`, `autorun`, `action`, `act`, `ignore`, `watch`, `loading`, `Autoload`, `defineAutoload`, `defineStorage`, `defineAsyncStorage`, `registerStorageEngine`, `registerAsyncStorageEngine`, `reactiveClass`, `reactiveObject`, `getOriginalObject` |
| `@canlooks/reactive/react` | React: `RC`, `reactiveFC`, `reactiveClassComponent`, `useReactive`, `useAutorun`, `useReactor`, `useAction`, `useExternalReactive`, `Chip`, `Model`, `defineModel`, `useModel`, `useLoading`, `useAutoload` |
| `@canlooks/reactive/forage` | Persistence: `Forage`, `defineForage` |

---

## License

MIT
