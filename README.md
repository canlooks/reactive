# @canlooks/reactive

This is a simple and lightweight `React` tool for responding data, auto re-render and managing state.   

## Installation

```bash
npm i @canlooks/reactive
```

## <a name="example">A quick example</a>

A `react-class-component` which using `@canlooks/reactive` will look like this.

```tsx
import {RC} from '@canlooks/reactive/react'

@RC
export default class Index extends React.Component {
    count = 1
    test = 2

    onClick() {
        this.count++ // This component will update.
    }

    myTest() {
        this.test++
        // This component will not update,
        // because "test" have never referred in "render()" 
    }

    render() {
        return (
            <div>
                <div>{this.count}</div>
                <button onClick={this.onClick}>Increase</button>
                <button onClick={this.myTest}>Test</button>
            </div>
        )
    }
}
```

and `Function component` will look like this:

```tsx
import {RC, useReactive} from '@canlooks/reactive/react'

const Index = RC(() => {
    const data = useReactive({
        count: 1
    })

    const increase = () => {
        data.count++
    }

    return (
        <div>
            <div>{data.count}</div>
            <button onClick={increase}>Increase</button>
        </div>
    )
})
```

## Contents  

Basic API
- [reactive()](#reactive)
- [reactive.deep()](#reactive)
- [reactiveClass()](#reactiveClass)
- [reactiveFC()](#reactiveClass)
- [reactor()](#reactor)
- [autorun()](#autorun)
- [action()](#action)
- [act()](#act)

[automatic allocation](#allocation)

[External data & sharing state](#store)

[Additional functions](#additional)

- [\<Chip/>](#chip)
- [\<Model/>](#model)
- [defineModel()](#defineModel)
- [useModel()](#useModel)
- [@watch()](#watch)
- [@loading()](#loading)
- [useLoading()](#useLoading)
- [autoload()](#autoload)
- [defineStorage()](#storage)
- [defineForage()](#forage)

[Hooks](#hooks)

- [useReactive()](#useReactive)
- [useReactor()](#useReactor)
- [useAutorun()](#useAutorun)
- [useAction()](#useAction)

---

### <a name="reactive">reactive() & reactive.deep()</a>

There are 3 ways to create a `reactive data`.

```tsx
import {reactive} from '@canlooks/reactive'

// create by object
const data = reactive({
    a: 1,
    b: 2
})

// create by class
const DataClass = reactive(class {
    a = 1
    static b = 2 // Both instance and static properties are reactive.
})

// using decorator
@reactive
class Data {
    a = 1
}
```

You can also create a `reactive React Component` like [quick example](#example).

---

### <a name="reactor">reactor()</a>

```tsx
import {act, reactive, reactor} from '@canlooks/reactive'

const obj = reactive({
    a: 1,
    b: 2
})

const disposer = reactor(() => obj.a, (to, from) => {
    console.log(`"obj.a" was changed from ${from} to ${to}`)
})

act(() => obj.a++) // log: "obj.a" was changed from 1 to 2
act(() => obj.b++) // nothing happen

disposer() // Remember to dispose if you don't use it anymore.
```

```tsx
declare type ReactorOptions = {
    immediate?: boolean
    once?: boolean
}

declare function reactor<T>(refer: () => T, effect: (newValue: T, oldValue: T) => void, options?: ReactorOptions): () => void
```

---

### <a name="autorun">autorun()</a>

```tsx
const obj = reactive({
    a: 1
})

const disposer = autorun(() => {
    console.log('Now "obj.a" is: ' + obj.a)
})
```

---

### <a name="action">action()</a>

Every methods for modifying `reactive data` are strongly suggest wrapping in "action".

```tsx
const obj = reactive({
    a: 1,
    b: 2
})

reactor(() => [obj.a, obj.b], () => {
    // ...
})

// Good, effect will trigger only once.
const increase = action(() => {
    obj.a++
    obj.b++
})

// Bad, effect will trigger twice.
const decrease = () => {
    obj.a++
    obj.b++
}
```

---

### <a name="act">act()</a>

IIFE for `action()`

```tsx
act(() => {
    //
})
// is equivalent to
action(() => {
    //
})()
```

---

## <a name="allocation">Automatic allocation</a>

Each property in reactive `object` or `class` will allocate automatically. 

```tsx
const data = reactive({
    // Become reactive property
    count: 1,
    
    // Become computed property
    get double() {
        // This function will not execute repeatedly until "count" change.
        return this.count * 2
    },
    
    // Become action
    increase() {
        this.count++
    }
})
```

---

## <a name="store">External data & sharing state</a>

**No** `provide/inject`, just use it.

```tsx
import {act, reactive} from '@canlooks/reactive'
import {RC} from '@canlooks/reactive/react'

const data = reactive({
    a: 1,
    b: 2
})

@RC
class A extends React.Component {
    render() {
        return (
            <div>{data.a}</div>
        )
    }
}

const B = RC(() => {
    return (
        <div>
            <div>{data.a}</div>
            <div>{data.b}</div>
        </div>
    )
})

// Modify data everywhere.
act(() => data.a++) // Both component "A" and "B" will update.
act(() => data.b++) // Only component "B" will update.
```

---

## <a name="additional">Additional functions</a>

### <a name="chip">\<Chip/></a>

`<Chip/>` can take component to pleces for updating only a small part.

```tsx
import {Chip, RC, useReactive} from '@canlooks/reactive/react'

// In this case, component "Index" will never re-render.
const Index = RC(() => {
    const data = useReactive({
        a: 1,
        b: 2
    })

    return (
        <div>
            <Chip>
                {/*Re-render when only "a" is modified*/}
                {() => <ChildA count={data.a}/>}
            </Chip>
            <Chip>
                {/*Re-render when only "b" is modified*/}
                {() => <ChildB data={data.b}/>}
            </Chip>
        </div>
    )
})
```

`chip()` is an function way for `<Chip/>`

```tsx
chip(() => <AnyComponent/>)
// is equivalent to
<Chip>{() => <AnyComponent/>}</Chip>
```

---

### <a name="model">\<Model/></a>

Binding form controls' value to `reactive data`

```tsx
const Index = RC(() => {
    const data = useReactive({
        // This value always sync with value of <input/>
        value: 'Hello'
    })

    return (
        <div>
            <Model refer={() => data.value}>
                <input/>
            </Model>
        </div>
    )
})
```

### <a name="defineModel">defineModel()</a>

Using High-Order function to create an `<Model/>` component.

```tsx
import {defineModel} from '@canlooks/reactive/react'

const InputModel = defineModel(props => {
    return <input {...props}/>
})

// Then use it like
const Index = RC(() => {
    const data = useReactive({
        value: 'Hello'
    })

    return <InputModel refer={() => data.value}/>
})
```

### <a name="useModel">useModel()</a>

```tsx
const Index = RC(() => {
    const model = useModel('Hello Reactive')
    // "data" has "value" and "onChange" props.

    return (
        <div>
            <p>Input value is: {data.value}</p>
            <input {...model}/>
        </div>
    )
})
```

---

### <a name="watch">@watch()</a>

`@watch()` is a syntactic sugar of `reactor()`

```tsx
import {watch} from '@canlooks/reactive'
import {RC} from '@canlooks/reactive/react'

@RC
class Index extends React.Component {
    @watch(() => someExternal.data)
    effect1() {
        // This effect will trigger when "someExternal.data" modified.
    }

    a = 1

    @watch(t => t.a) // t === this
    effect2() {
        // This effect will trigger when "this.a" modified.
    }
}
```

---

### <a name="loading">@loading()</a>

```tsx
import {loading} from '@canlooks/reactive'
import {RC} from '@canlooks/reactive/react'

@RC
class Index extends React.Component {
    busy = false

    @loading(t => t.busy) // t === this
    async myAsyncMethod() {
        // It changes "busy" to true,
        // and changes false back until this function return.
    }

    stack = 0

    @loading(t => t.stack)
    async concurrent() {
        // It make "stack" +1,
        // and -1 until this function return.
    }

    render() {
        return (
            <div>
                {(this.busy || this.stack !== 0) &&
                    <div>I'm busy</div>
                }
            </div>
        )
    }
}
```

### <a name="useLoading">useLoading()</a>

```tsx
const Index = RC(() => {
    const method = useLoading(async () => {
        // ...
    })
    
    return method.loading
        ? <div>Loading...</div>
        : <button onClick={method.load}>button</button>
})
```

---

### <a name="autoload">autoload()</a>

To define a common business data automatically.

```tsx
abstract class Autoload<D, A> {
    loading: boolean
    data: D
    setData(v: D | undefined): void
    abstract loadData(...args: A[]): D | Promise<D>
    update(...args: A[]): Promise<D>
}

function autoload<D, A>(loadData: (...args: A[]) => D | Promise<D>, options?: ReactiveOptions): Autoload<D, A>
```

example:

```tsx
@reactive
class MyData extends Autoload {
    async loadData() {
        const res = await fetch('fetch/my/data')
        return await res.json()
    }
}

const myData = new MyData()

// Automatic load data on first use.
console.log(myData.data)

// Load data again.
myData.update()
```

---

### <a name="storage">defineStorage()</a>

This method create a `reactive data` which always sync with 'localStorage' or 'sessionStorage'.

```ts
type Options = {
    mode?: 'localStorage' | 'sessionStorage'
    async?: boolean
    debounce?: number
}

declare function defineStorage<T>(
    name: string,
    initialvalues?: T,
    options?: Options
): T
```

example:

```ts
const userStorage = defineStorage('user', {
    name: 'canlooks',
    age: 18
})
// then modifying "userStorage" will sync with 'localStorage'
userStorage.age++
```

---

### <a name="forage">defineForage()</a>

It's similar to `defineStorage()`, but it use `localforage` to store data.

```ts
type Options = {
    instance?: typeof localforage
    deep?: boolean
}

declare function defineForage<T>(
    name: string,
    initialvalues?: T,
    options?: Options
): T
```

or using `Forage` class which extends `Autoload`

```ts
class Forage extends Autoload {
    dispose(): void
}
```

---

## <a name="hooks">Hooks</a>

### <a name="useReactive">useReactive()</a>

It's encapsulated like:

```ts
function useReactive<T>(initialValue: T): T {
    return useMemo(() => reactive(initialValue), [])
}
```

### <a name="useReactor">useReactor()</a>

```ts
function useReactor(refer: () => T, effect: (newValue: T, oldValue: T) => void, options?: ReactorOptions): void {
    useEffect(() => {
        return index(refer, effect, options)
    }, [])
}
```

### <a name="useAutorun">useAutorun()</a>

```ts
function useAutorun(fn: () => void): void {
    useEffect(() => {
        return autorun(fn)
    }, [])
}
```

### <a name="useAction">useAction()</a>

```ts
function useAction<F extends (...args: any[]) => any>(fn: F): F {
    return useCallback(action(fn), [])
}
```

---

### <a name="useAutoload">useAutoload()</a>

```ts
function useAutoload<D, A>(loadData: (...args: A[]) => D | Promise<D>, options?: ReactiveOptions): Autoload<D, A> {
    return useMemo(() => autoload(), [])
}
```