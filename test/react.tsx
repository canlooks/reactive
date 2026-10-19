import type { Computed } from '../src/index.js'
import './dom.js'
import './react-features.js'
import './react-loading.js'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    act, Component, PureComponent, StrictMode, Suspense, createContext, createRef,
    startTransition, useContext, useLayoutEffect, useState as useReactState,
    type ReactNode,
} from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { renderToString } from 'react-dom/server'
import { batch, computed, effect, reactive, watch } from '../src/index.js'
import { RC, RFC, RCC, ReactiveComponent, ReactiveFunctionComponent, ReactiveClassComponent, useReactive, useWatch } from '../src/react/index.js'
import { Observer } from '../src/react/observer.js'
import { captureDependencies, createEffectNode, depVersion, getDep, replaceDeps, stopEffect } from '../src/effect.js'

async function mounted(run: (root: Root, container: HTMLDivElement) => Promise<void>) {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    try { await run(root, container) } finally {
        await act(() => root.unmount())
        container.remove()
    }
}

test('aliases, memo identity, repeated wrapping and invalid categories', () => {
    assert.equal(RC, ReactiveComponent)
    assert.equal(RFC, ReactiveFunctionComponent)
    assert.equal(RCC, ReactiveClassComponent)
    const View = () => null
    const Wrapped = RFC(View)
    assert.equal(RC(View), Wrapped)
    assert.equal(RFC(Wrapped), Wrapped)
    assert.equal(RC(Wrapped), Wrapped)
    class ClassView extends Component { override render() { return null } }
    assert.equal(RC(ClassView), RCC(ClassView))
    assert.equal(RCC(RCC(ClassView)), RCC(ClassView))
    assert.throws(() => RFC(ClassView as never), TypeError)
    assert.throws(() => RCC(View as never), TypeError)
    assert.throws(() => RC({} as never), TypeError)
    assert.throws(() => RFC(async () => null), TypeError)
})

test('function memo skips unchanged props while store, React state and context still update', async () => {
    await mounted(async (root, container) => {
        const state = reactive({ count: 1, unused: 0 })
        const Context = createContext(0)
        let renders = 0
        let setLocal!: (value: number) => void
        const View = RC(({ label }: { label: string }) => {
            renders++
            const [local, set] = useReactState(0)
            setLocal = set
            return <div>{label}:{state.count}:{local}:{useContext(Context)}</div>
        })
        const render = (label = 'a', context = 0) => root.render(<Context.Provider value={context}><View label={label} /></Context.Provider>)
        await act(() => render())
        const baseline = renders
        await act(() => render())
        await act(() => { state.unused++ })
        assert.equal(renders, baseline)
        await act(() => batch(() => { state.count = 2; state.count = 3 }))
        assert.equal(container.textContent, 'a:3:0:0')
        assert.equal(renders, baseline + 1)
        await act(() => batch(() => { state.count = 4; state.count = 3 }))
        assert.equal(renders, baseline + 1)
        await act(() => setLocal(5))
        await act(() => render('a', 7))
        assert.equal(container.textContent, 'a:3:5:7')
        await act(() => render('b', 7))
        assert.equal(container.textContent, 'b:3:5:7')
    })
})

test('reactive props watch fires without JSX reads and never adds a second own render', async () => {
    for (const readInJsx of [false, true]) await mounted(async (root, container) => {
        const changes: unknown[] = []
        let renders = 0
        let reads = 0
        const View = RFC((props: { count: number; extra?: number }) => {
            renders++
            useWatch(() => { reads++; return props.count }, (next, prev) => changes.push([next, prev, props.count]))
            return <div>{readInJsx ? props.count : 'view'}</div>
        })
        await act(() => root.render(<View count={1} />))
        assert.equal(reads, 1)
        assert.deepEqual(changes, [])
        await act(() => root.render(<View count={2} />))
        assert.equal(renders, 2)
        assert.equal(reads, 2)
        assert.deepEqual(changes, [[2, 1, 2]])
        assert.equal(container.textContent, readInJsx ? '2' : 'view')
        await act(() => root.render(<View count={2} extra={1} />))
        assert.equal(renders, 3)
        assert.deepEqual(changes, [[2, 1, 2]])
        await act(() => root.render(<View count={3} extra={2} />))
        assert.equal(renders, 4)
        assert.deepEqual(changes.at(-1), [3, 2, 3])
    })
})

test('props derived computed chains use candidate caches and commit once', async () => {
    await mounted(async (root, container) => {
        let renders = 0
        let derived!: Computed<number>
        const values: unknown[] = []
        const View = RC((props: { count: number; left: boolean }) => {
            renders++
            const [read] = useReactState(() => {
                const left = computed(() => props.count * 2)
                const right = computed(() => props.count + 10)
                return computed(() => props.left ? left.value : right.value)
            })
            derived = read
            useWatch(() => read.value, (next, prev) => values.push([next, prev]))
            return <div>{read.value}:{read.value}</div>
        })
        await act(() => root.render(<View count={1} left />))
        await act(() => root.render(<View count={2} left={false} />))
        assert.equal(container.textContent, '12:12')
        assert.equal(renders, 2)
        assert.equal(derived.value, 12)
        assert.deepEqual(values, [[12, 2]])
        await act(() => root.render(<View count={3} left />))
        assert.equal(container.textContent, '6:6')
        assert.equal(renders, 3)
        assert.deepEqual(values.at(-1), [6, 12])
    })
})

test('props proxy is stable, shallow, readonly and handles existence and Object.is', async () => {
    await mounted(async (root) => {
        const nested = { value: 1 }
        const fn = () => 1
        const store = reactive({ value: 1 })
        let first: object | undefined
        const seen: unknown[] = []
        const View = RFC((props: { count?: number; nested: object; fn: () => number; store: typeof store; children?: ReactNode }) => {
            first ??= props
            assert.equal(props, first)
            assert.equal(props.nested, nested)
            assert.equal(props.fn, fn)
            assert.equal(props.store, store)
            assert.equal(Reflect.set(props, 'count', 99), false)
            assert.equal(Reflect.deleteProperty(props, 'count'), false)
            assert.equal(Reflect.defineProperty(props, 'x', { value: 1 }), false)
            assert.equal(Reflect.preventExtensions(props), false)
            assert.ok(Object.keys(props).includes('nested'))
            useWatch(() => props.count, (next, prev) => seen.push([next, prev]))
            return <div>{props.store.value}</div>
        })
        const render = (extra: { count?: number }) => root.render(<View nested={nested} fn={fn} store={store} {...extra} />)
        await act(() => render({}))
        await act(() => render({ count: undefined }))
        await act(() => render({ count: NaN }))
        await act(() => render({ count: NaN }))
        await act(() => render({ count: +0 }))
        await act(() => render({ count: -0 }))
        await act(() => render({}))
        assert.equal(seen.length, 5)
        assert.deepEqual(seen[0], [undefined, undefined])
        await act(() => { store.value++ })
    })
})

test('props-selected watch updates closures and branches without swallowing oldValue', async () => {
    await mounted(async (root) => {
        const state = reactive({ a: 1, b: 10 })
        const seen: unknown[] = []
        const View = RC((props: { chooseA: boolean; label: string }) => {
            useWatch(() => props.chooseA ? state.a : state.b, (next, prev) => seen.push([next, prev, props.label]))
            return <div>{state.a}</div>
        })
        await act(() => root.render(<View chooseA label="first" />))
        await act(() => root.render(<View chooseA={false} label="second" />))
        assert.deepEqual(seen, [[10, 1, 'second']])
        await act(() => { state.a = 2 })
        assert.equal(seen.length, 1)
        await act(() => { state.b = 11 })
        assert.deepEqual(seen.at(-1), [11, 10, 'second'])
    })
})

test('local state identity, immediate commit timing, refresh and StrictMode cleanup', async () => {
    const state = reactive({ count: 1 })
    let callbacks = 0
    let inRender = false
    let local!: { count: number }
    const identities: object[] = []
    const View = RFC(({ initial, immediate }: { initial: number; immediate: boolean }) => {
        inRender = true
        local = useReactive({ count: initial })
        identities.push(local)
        useWatch(() => state.count, (next, prev) => {
            assert.equal(inRender, false)
            assert.equal(next, state.count)
            if (prev === undefined) assert.equal(next, 1)
            callbacks++
        }, { immediate })
        const result = <div>{local.count}</div>
        inRender = false
        return result
    })
    await mounted(async (root, container) => {
        await act(() => root.render(<StrictMode><View initial={2} immediate /></StrictMode>))
        const setups = callbacks
        assert.ok(setups >= 1)
        const committed = local
        await act(() => { local.count = 3 })
        await act(() => root.render(<StrictMode><View initial={100} immediate={false} /></StrictMode>))
        assert.equal(local, committed)
        assert.equal(container.textContent, '3')
        assert.equal(callbacks, setups)
        await act(() => { state.count++ })
        assert.equal(callbacks, setups + 1)
    })
    const stopped = callbacks
    state.count++
    assert.equal(callbacks, stopped)
    assert.ok(identities.length > 1)
})

test('layout changes in the render/subscribe window and a new branch are detected', async () => {
    await mounted(async (root, container) => {
        const state = reactive({ a: 1, b: 10 })
        function Mutator({ field, value }: { field: 'a' | 'b'; value: number }) {
            useLayoutEffect(() => { state[field] = value }, [field, value])
            return null
        }
        const View = RC(({ branch }: { branch: boolean }) => <div>{branch ? state.a : state.b}<Mutator field={branch ? 'a' : 'b'} value={branch ? 2 : 11} /></div>)
        await act(() => root.render(<View branch />))
        assert.equal(container.textContent, '2')
        await act(() => root.render(<View branch={false} />))
        assert.equal(container.textContent, '11')
        await act(() => { state.b = 12 })
        assert.equal(container.textContent, '12')
    })
})

test('suspended renders retain committed props, watch closures and computed caches', async () => {
    await mounted(async (root, container) => {
        const state = reactive({ count: 1 })
        const never = new Promise<void>(() => {})
        const seen: unknown[] = []
        let read!: Computed<number>
        let propsView!: { count: number; suspend: boolean }
        const View = RC((props: { count: number; suspend: boolean }) => {
            propsView = props
            const [derived] = useReactState(() => computed(() => props.count * state.count))
            read = derived
            useWatch(() => state.count, () => seen.push(props.count))
            useWatch(() => props.count, (next, prev) => seen.push([next, prev]))
            const value = derived.value
            if (props.suspend) throw never
            return <div>{value}</div>
        })
        await act(() => root.render(<Suspense fallback="pending"><View count={1} suspend={false} /></Suspense>))
        await act(() => startTransition(() => root.render(<Suspense fallback="pending"><View count={2} suspend /></Suspense>)))
        assert.equal(container.textContent, '1')
        assert.equal(propsView.count, 1)
        assert.equal(read.value, 1)
        assert.deepEqual(seen, [])
        await act(() => root.render(<Suspense fallback="pending"><View count={3} suspend={false} /></Suspense>))
        assert.equal(container.textContent, '3')
        assert.deepEqual(seen, [[3, 1]])
        await act(() => { state.count = 2 })
        assert.equal(container.textContent, '6')
        assert.deepEqual(seen.at(-1), 3)
    })
})

test('props changes inside an enclosing batch preserve watcher baselines and net rollback', async () => {
    await mounted(async (root, container) => {
        const seen: unknown[] = []
        const View = RC((props: { a: number; b: number }) => {
            useWatch(() => props.a + props.b, (next, prev) => seen.push([next, prev]))
            return <div>{props.a + props.b}</div>
        })
        await act(() => root.render(<View a={1} b={1} />))
        await act(() => batch(() => {
            flushSync(() => root.render(<View a={2} b={2} />))
            assert.deepEqual(seen, [])
            flushSync(() => root.render(<View a={3} b={3} />))
        }))
        assert.deepEqual(seen, [[6, 2]])
        assert.equal(container.textContent, '6')
        await act(() => batch(() => {
            flushSync(() => root.render(<View a={4} b={4} />))
            flushSync(() => root.render(<View a={3} b={3} />))
        }))
        assert.equal(seen.length, 1)
    })
})

test('props callback writes remain separate updates, including notify-time synchronous commits', async () => {
    await mounted(async (root, container) => {
        const state = reactive({ count: 0 })
        let renders = 0
        const View = RFC((props: { count: number }) => {
            renders++
            useWatch(() => props.count, next => { state.count = next })
            useLayoutEffect(() => { if (state.count === 2) state.count = 3 })
            return <div>{props.count}:{state.count}</div>
        })
        await act(() => root.render(<View count={1} />))
        await act(() => root.render(<View count={2} />))
        assert.equal(container.textContent, '2:3')
        assert.ok(renders >= 3)
    })
})

test('class refs, PureComponent, lifecycle args, props watchers and independent instances', async () => {
    const messages: unknown[] = []
    const state = reactive({ count: 1 })
    let renders = 0
    class View extends PureComponent<{ count: number; label: string }> {
        static marker = 42
        stop = () => {}
        override componentDidMount() {
            this.stop = watch(() => this.props.count, (next, prev) => messages.push([next, prev, this.props.label]))
        }
        override componentDidUpdate(previous: { count: number; label: string }) { messages.push(previous.count) }
        override componentWillUnmount() { this.stop() }
        override render() { renders++; return <div>{this.props.label}:{this.props.count}:{state.count}</div> }
    }
    const Wrapped = RCC(View)
    const ref = createRef<View>()
    assert.equal(Wrapped.marker, 42)
    const originalError = console.error
    const warnings: unknown[][] = []
    console.error = (...args) => warnings.push(args)
    try {
        await mounted(async (root, container) => {
            await act(() => root.render(<Wrapped ref={ref} count={1} label="a" />))
            assert.ok(ref.current instanceof View)
            await act(() => root.render(<Wrapped ref={ref} count={2} label="b" />))
            assert.equal(renders, 2)
            assert.equal(container.textContent, 'b:2:1')
            assert.deepEqual(messages, [[2, 1, 'b'], 1])
            await act(() => { state.count++ })
            assert.equal(container.textContent, 'b:2:2')
        })
        assert.deepEqual(warnings, [])
    } finally { console.error = originalError }
    const baseline = renders
    state.count++
    assert.equal(renders, baseline)
})

test('class SCU is honored except active props consumers and external forceUpdate', async () => {
    await mounted(async (root, container) => {
        const state = reactive({ count: 1 })
        const seen: unknown[] = []
        let renders = 0
        let scu = 0
        @RC
        class View extends Component<{ count: number }> {
            stop = () => {}
            override shouldComponentUpdate() { scu++; return false }
            override componentDidMount() { this.stop = watch(() => this.props.count, (next, prev) => seen.push([next, prev])) }
            override componentWillUnmount() { this.stop() }
            override render() { renders++; return <div>{this.props.count}:{state.count}</div> }
        }
        await act(() => root.render(<View count={1} />))
        await act(() => root.render(<View count={2} />))
        assert.equal(renders, 2)
        assert.equal(scu, 1)
        assert.deepEqual(seen, [[2, 1]])
        await act(() => { state.count++ })
        assert.equal(container.textContent, '2:2')
    })
})

test('SSR does not initialize watchers and hydration establishes the initial baseline', async () => {
    const seen: unknown[] = []
    const View = RC(({ state }: { state: { count: number } }) => {
        useWatch(() => state.count, (next, prev) => seen.push([next, prev]), { immediate: true })
        return <div>{state.count}</div>
    })
    const first = reactive({ count: 1 })
    const second = reactive({ count: 2 })
    const browserWindow = globalThis.window
    Reflect.deleteProperty(globalThis, 'window')
    let html: string
    try {
        html = renderToString(<View state={first} />)
        assert.equal(renderToString(<View state={second} />), '<div>2</div>')
    } finally { globalThis.window = browserWindow }
    assert.deepEqual(seen, [])
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.append(container)
    let root!: Root
    await act(() => { root = hydrateRoot(container, <View state={first} />) })
    try {
        assert.deepEqual(seen, [[1, undefined]])
        await act(() => { first.count++ })
        assert.equal(container.textContent, '2')
        assert.deepEqual(seen.at(-1), [2, 1])
    } finally { await act(() => root.unmount()); container.remove() }
})

test('ordinary useWatch refreshes captured props silently and uses latest callback', async () => {
    await mounted(async (root) => {
        const state = reactive({ a: 1, b: 10 })
        const seen: unknown[] = []
        function View({ chooseA, label }: { chooseA: boolean; label: string }) {
            useWatch(() => chooseA ? state.a : state.b, (next, prev) => seen.push([next, prev, label]))
            return null
        }
        await act(() => root.render(<View chooseA label="a" />))
        await act(() => root.render(<View chooseA={false} label="b" />))
        assert.deepEqual(seen, [])
        await act(() => { state.b++ })
        assert.deepEqual(seen, [[11, 10, 'b']])
    })
})

test('queued useWatch keeps oldValue when an earlier consumer synchronously renders', async () => {
    await mounted(async (root) => {
        const state = reactive({ count: 1 })
        const seen: unknown[] = []
        let render = () => {}
        const stop = effect(() => { void state.count; render() })
        function View() {
            useWatch(() => state.count, (next, prev) => seen.push([next, prev]))
            return null
        }
        render = () => flushSync(() => root.render(<View />))
        await act(() => render())
        await act(() => { state.count++ })
        assert.deepEqual(seen, [[2, 1]])
        stop()
    })
})

test('candidate collection never subscribes, but notices invalidations before subscription', () => {
    const state = reactive({ count: 1 })
    const raw = { count: 1 }
    const proxy = reactive(raw)
    const captured = captureDependencies(() => proxy.count)
    assert.equal(captured.value, 1)
    const dep = getDep(raw, 'count')
    const read = captured.reads.get(dep)
    proxy.count++
    assert.notEqual(depVersion(dep), read)
    const observer = new Observer({})
    let notifications = 0
    const abandoned = observer.attempt({})
    observer.render(abandoned, () => state.count)
    state.count++
    observer.subscribe(() => notifications++)
    assert.equal(notifications, 0)
    observer.commit(abandoned)
    assert.equal(notifications, 1)
    observer.disconnect()
})

test('observer props acknowledgments keep other owners and ordinary store causes', () => {
    const state = reactive({ count: 1 })
    const first = new Observer({ count: 1 })
    const second = new Observer({ count: 10 })
    const combined = computed(() => first.props.proxy.count + second.props.proxy.count + state.count)
    let notifications = 0
    first.subscribe(() => notifications++)
    const commitFirst = (count: number) => {
        const attempt = first.attempt({ count })
        first.render(attempt, () => combined.value)
        first.commit(attempt)
    }
    const commitSecond = (count: number) => {
        const attempt = second.attempt({ count })
        second.render(attempt, () => second.props.proxy.count)
        second.commit(attempt)
    }
    commitSecond(10)
    commitFirst(1)
    commitFirst(2)
    assert.equal(notifications, 0)
    batch(() => { commitFirst(3); state.count++ })
    assert.equal(notifications, 1)
    const baseline = notifications
    batch(() => { commitFirst(4); commitSecond(20) })
    assert.equal(notifications, baseline + 1)
    assert.equal(combined.value, 26)
    first.disconnect(); second.disconnect()
})

test('notify nodes retain dependencies and can be queued again during notification', () => {
    const raw = { count: 1 }
    const state = reactive(raw)
    const node = createEffectNode(() => assert.fail('notify cannot execute a render function'))
    let notifications = 0
    node.notify = () => {
        notifications++
        if (state.count === 2) state.count = 3
    }
    replaceDeps(node, [getDep(raw, 'count')])
    state.count = 2
    assert.equal(notifications, 2)
    state.count = 4
    assert.equal(notifications, 3)
    stopEffect(node)
    state.count = 5
    assert.equal(notifications, 3)
})

test('render dependencies switch branches and ignore event-only and child-only reads', async () => {
    await mounted(async (root, container) => {
        const state = reactive({ branch: true, a: 1, b: 10, child: 0, event: 0 })
        let parents = 0
        let children = 0
        const Child = RC(() => { children++; return <span>{state.child}</span> })
        const Parent = RC(() => {
            parents++
            return <button onClick={() => { void state.event }}>{state.branch ? state.a : state.b}<Child /></button>
        })
        await act(() => root.render(<Parent />))
        await act(() => container.querySelector('button')!.click())
        await act(() => { state.child++; state.event++ })
        assert.equal(parents, 1)
        assert.equal(children, 2)
        await act(() => { state.branch = false })
        await act(() => { state.a++ })
        assert.equal(parents, 2)
        await act(() => { state.b++ })
        assert.equal(container.textContent, '111')
    })
})

test('initial suspended and throwing renders never initialize their watchers', async () => {
    const state = reactive({ count: 1 })
    let callbacks = 0
    let renders = 0
    const never = new Promise<void>(() => {})
    const View = RC(() => {
        renders++
        useWatch(() => state.count, () => callbacks++, { immediate: true })
        void state.count
        throw never
    })
    await mounted(async (root) => {
        await act(() => root.render(<Suspense fallback="loading"><View /></Suspense>))
        const baseline = renders
        await act(() => { state.count++ })
        assert.equal(renders, baseline)
        assert.equal(callbacks, 0)
    })
    state.count++
    assert.equal(callbacks, 0)
})

test('multiple watch setups clean every initialized handle when a later immediate callback fails', async () => {
    const state = reactive({ count: 1 })
    let callbacks = 0
    const error = new Error('failed immediate setup')
    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
        override state = { failed: false }
        static getDerivedStateFromError() { return { failed: true } }
        override componentDidCatch(caught: unknown) { assert.equal(caught, error) }
        override render() { return this.state.failed ? 'failed' : this.props.children }
    }
    const View = RC(() => {
        useWatch(() => state.count, () => callbacks++, { immediate: true })
        useWatch(() => state.count, () => { throw error }, { immediate: true })
        return null
    })
    const originalError = console.error
    console.error = () => {}
    try {
        await mounted(async (root, container) => {
            await act(() => root.render(<Boundary><View /></Boundary>))
            assert.equal(container.textContent, 'failed')
            const before = callbacks
            state.count++
            assert.equal(callbacks, before)
        })
    } finally { console.error = originalError }
})

test('class field lifecycles, context, StrictMode reconnection and mount-window writes', async () => {
    await mounted(async (root, container) => {
        const Context = createContext('context')
        const state = reactive({ count: 1 })
        let mounts = 0
        let unmounts = 0
        class Base extends Component {
            static override contextType = Context
            declare context: string
            override componentDidMount = () => { mounts++; state.count = 2 }
            override componentWillUnmount = () => { unmounts++ }
            override render = () => <div>{this.context}:{state.count}</div>
        }
        class Derived extends Base {}
        const View = RCC(Derived)
        await act(() => root.render(<StrictMode><View /></StrictMode>))
        assert.equal(container.textContent, 'context:2')
        await act(() => { state.count = 3 })
        assert.equal(container.textContent, 'context:3')
        assert.ok(mounts >= 1)
        assert.equal(mounts - unmounts, 1)
    })
})

test('class props notify the whole slot without duplicate forceUpdate and preserve historical refs', async () => {
    await mounted(async (root) => {
        const seen: unknown[] = []
        const history: unknown[] = []
        let renders = 0
        let forces = 0
        let originalProps: unknown
        class View extends Component<{ count: number; other: number }> {
            stop = () => {}
            override componentDidMount() {
                originalProps = this.props
                const update = this.forceUpdate
                this.forceUpdate = (...args) => { forces++; return update.apply(this, args) }
                this.stop = watch(() => this.props.count, (next, prev) => seen.push([next, prev]))
            }
            override componentDidUpdate(prev: unknown) { history.push(prev) }
            override componentWillUnmount() { this.stop() }
            override render() { renders++; return <div>{this.props.count}</div> }
        }
        const Wrapped = RC(View)
        await act(() => root.render(<Wrapped count={1} other={1} />))
        await act(() => root.render(<Wrapped count={1} other={2} />))
        assert.deepEqual(seen, [[1, 1]])
        assert.equal(history[0], originalProps)
        assert.equal(renders, 2)
        assert.equal(forces, 0)
    })
})

test('inline local states are independent while explicit shared raw state stays shared', async () => {
    await mounted(async (root, container) => {
        const locals: Array<{ count: number }> = []
        const raw = { count: 10 }
        const View = RC(({ index, shared }: { index: number; shared: boolean }) => {
            const state = useReactive(shared ? raw : { count: index })
            locals[index] = state
            return <span>{state.count},</span>
        })
        await act(() => root.render(<><View index={0} shared={false} /><View index={1} shared={false} /><View index={2} shared /><View index={3} shared /></>))
        assert.notEqual(locals[0], locals[1])
        assert.equal(locals[2], locals[3])
        await act(() => { locals[0]!.count = 2; locals[2]!.count = 20 })
        assert.equal(container.textContent, '2,1,20,20,')
    })
})

test('source reads after destructuring stay plain values; props fields retain reference semantics', async () => {
    await mounted(async (root) => {
        let renders = 0
        let capturedCallbacks = 0
        let referenceCallbacks = 0
        const View = RC((props: { count: number; value: object; fn: () => void }) => {
            renders++
            const { count } = props
            useWatch(() => count, () => capturedCallbacks++)
            useWatch(() => props.value, () => referenceCallbacks++)
            return null
        })
        const value = {}
        const fn = () => {}
        await act(() => root.render(<View count={1} value={value} fn={fn} />))
        await act(() => root.render(<View count={2} value={value} fn={fn} />))
        assert.equal(capturedCallbacks, 0)
        assert.equal(referenceCallbacks, 0)
        await act(() => root.render(<View count={2} value={{}} fn={() => {}} />))
        assert.equal(renders, 3)
        assert.equal(referenceCallbacks, 1)
    })
})

test('immediate watches created inside an outer batch initialize during setup', async () => {
    await mounted(async (root) => {
        const state = reactive({ count: 1 })
        const seen: unknown[] = []
        const View = RC(() => {
            useWatch(() => state.count, (next, prev) => seen.push([next, prev]), { immediate: true })
            return null
        })
        await act(() => batch(() => {
            flushSync(() => root.render(<View />))
            assert.deepEqual(seen, [[1, undefined]])
            state.count = 2
        }))
        assert.deepEqual(seen, [[1, undefined], [2, 1]])
    })
})

test('props commits inside an outer batch do not invalidate their own snapshot before settlement', async () => {
    await mounted(async (root, container) => {
        let renders = 0
        const changes: unknown[] = []
        const View = RC((props: { count: number }) => {
            renders++
            const [double] = useReactState(() => computed(() => props.count * 2))
            useWatch(() => double.value, (next, prev) => changes.push([next, prev]))
            return <div>{props.count}:{double.value}</div>
        })
        await act(() => root.render(<View count={1} />))
        await act(() => batch(() => {
            flushSync(() => root.render(<View count={2} />))
            assert.equal(renders, 2)
            flushSync(() => root.render(<View count={3} />))
            assert.equal(renders, 3)
        }))
        assert.equal(renders, 3)
        assert.equal(container.textContent, '3:6')
        assert.deepEqual(changes, [[6, 2]])
    })
})
