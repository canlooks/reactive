import './dom.js'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { act, Component, PureComponent, StrictMode, Suspense, createContext, createRef, useLayoutEffect, type ReactNode } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { renderToString } from 'react-dom/server'
import * as reactApi from '../src/react/index.js'
import { RC, RCC, Chip, Model, loading, useLoading } from '../src/react/index.js'
import { batch, computed, effect, reactive, watch } from '../src/index.js'
import { captureReference } from '../src/reference.js'

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
    return { promise, resolve, reject }
}

function decorate(target: object, key: PropertyKey, source: (ctx: any) => any) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key)!
    loading(source)(target, key as string | symbol, descriptor)
    Object.defineProperty(target, key, descriptor)
}

async function mounted(run: (root: Root, container: HTMLDivElement) => Promise<void>) {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    try { await run(root, container) } finally {
        await act(async () => root.unmount())
        container.remove()
    }
}

test('all class component entries observe ordinary instance fields without loading', async () => {
    for (const wrap of [reactApi.RC, reactApi.ReactiveComponent, reactApi.RCC, reactApi.ReactiveClassComponent]) {
        class Counter extends Component {
            count = 0
            override render() { return <span>{this.count}</span> }
        }
        const View = wrap(Counter)
        const ref = createRef<Counter>()
        await mounted(async (root, container) => {
            await act(async () => root.render(<View ref={ref} />))
            await act(async () => { ref.current!.count++ })
            assert.equal(container.textContent, '1')
        })
    }
})

test('React entry exports the loading method decorator', () => {
    assert.equal(typeof Reflect.get(reactApi, 'loading'), 'function')
})

test('class fields retain deep identity, per-instance subscriptions and batch net changes', async () => {
    const shared = { value: 1 }
    const existing = reactive({ value: 2 })
    const renders = [0, 0]
    @RC
    class View extends Component<{ index: number }> {
        count = 0
        nested = { values: [1] }
        shared = shared
        existing = existing
        override render() {
            renders[this.props.index]++
            return <span>{this.count}:{this.nested.values[0]}:{this.shared.value}:{this.existing.value}|</span>
        }
    }
    const a = createRef<View>(), b = createRef<View>()
    await mounted(async (root, container) => {
        await act(async () => root.render(<><View ref={a} index={0} /><View ref={b} index={1} /></>))
        const first = a.current!, second = b.current!
        assert.equal(first.existing, existing)
        assert.equal(first.shared, second.shared)
        assert.notEqual(first.nested, second.nested)
        await act(async () => batch(() => { first.count = 1; first.count = 0; first.nested.values[0] = 1 }))
        assert.deepEqual(renders, [1, 1])
        await act(async () => batch(() => { first.count = 1; first.count = 2; first.nested.values[0]++ }))
        assert.deepEqual(renders, [2, 1])
        await act(async () => { first.shared.value++ })
        assert.deepEqual(renders, [3, 2])
        assert.equal(container.textContent, '2:2:2:2|0:1:2:2|')
        const raw = { values: [7] }
        await act(async () => { first.nested = raw })
        const baseline = renders[0]
        await act(async () => { first.nested = reactive(raw) })
        assert.equal(renders[0], baseline)
    })
})

test('class descriptors, symbols, empty keys and private methods preserve the original instance', async () => {
    const symbol = Symbol('count')
    let original!: View
    let getterCalls = 0
    class View extends Component {
        #private = 3;
        [symbol] = 1
        '' = 2
        _user = 4
        declare hidden: number
        declare readonly fixed: number
        declare readonly frozen: number
        constructor(props: {}) {
            super(props)
            original = this
            Object.defineProperties(this, {
                hidden: { value: 5, writable: true, configurable: true },
                fixed: { value: 6, configurable: true },
                frozen: { value: 7 },
            })
        }
        get derived() { getterCalls++; return this[symbol] * 2 }
        privateValue() { return this.#private }
        override render() { return <span>{this[symbol]}:{this['']}:{this._user}:{this.hidden}:{this.derived}:{this.privateValue()}</span> }
    }
    const Wrapped = RC(View), ref = createRef<View>()
    await mounted(async (root, container) => {
        await act(async () => root.render(<Wrapped ref={ref} />))
        assert.equal(ref.current, original)
        assert.equal(Object.getOwnPropertyDescriptor(original, 'hidden')!.enumerable, false)
        assert.equal(Reflect.set(original, 'fixed', 8), false)
        assert.throws(() => captureReference(() => original.fixed), /readonly/)
        assert.equal(original.frozen, 7)
        const before = getterCalls
        void original.derived; void original.derived
        assert.equal(getterCalls, before + 2) // Class getters are not memoized.
        await act(async () => batch(() => { original[symbol]++; original['']++; original._user++; original.hidden++ }))
        assert.equal(container.textContent, '2:3:5:6:4:3')
    })
    let invalid!: Invalid
    class Invalid extends Component {
        valid = 1
        constructor(props: {}) {
            super(props); invalid = this
            Object.defineProperty(this, 'locked', { value: 0, writable: true })
        }
        override render() { return null }
    }
    const InvalidWrapped = RCC(Invalid)
    assert.throws(() => new InvalidWrapped({}), /locked/)
    assert.equal(Object.getOwnPropertyDescriptor(invalid, 'valid')!.value, 1)
})

test('bridged fields participate in effect, watch, computed, Chip and Model without parent renders', async () => {
    let parents = 0
    let input!: (value: string) => void
    function Control(props: { value?: string; onChange?: (value: string) => void }) {
        input = props.onChange!
        return <span>{props.value}</span>
    }
    @RCC
    class View extends Component {
        name = 'A'
        count = 1
        override render() {
            parents++
            return <><Model source={() => this.name}><Control /></Model><Chip>{() => this.count}</Chip></>
        }
    }
    const ref = createRef<View>()
    await mounted(async (root, container) => {
        await act(async () => root.render(<View ref={ref} />))
        const view = ref.current!
        const derived = computed(() => view.count * 2)
        const seen: number[] = [], changes: unknown[] = []
        const stop = effect(() => seen.push(derived.value))
        const stopWatch = watch(() => view.count, (next, prev) => changes.push([next, prev]))
        try {
            await act(async () => { input('B'); captureReference(() => view.count).write(2) })
            assert.equal(container.textContent, 'B2')
            assert.equal(parents, 1)
            assert.deepEqual(seen, [2, 4])
            assert.deepEqual(changes, [[2, 1]])
        } finally { stop(); stopWatch() }
    })
})

test('loading shares boolean/numeric tokens across methods and preserves results and this', async () => {
    for (const initial of [false, true, 0, 3]) {
        const requests = [deferred<string>(), deferred<string>()]
        const calls: unknown[] = []
        @RC
        class View extends Component {
            busy = initial
            @loading(ctx => ctx.busy)
            async fetch(index: number, suffix = '') {
                calls.push([this, index, suffix, this.busy])
                return await requests[index].promise + suffix
            }
            @loading<View>(ctx => ctx.busy)
            async other(index: number, ...suffix: string[]) { return this.fetch(index, suffix.join('')) }
            override render() { return <span>{String(this.busy)}</span> }
        }
        const ref = createRef<View>()
        await mounted(async (root, container) => {
            await act(async () => root.render(<View ref={ref} />))
            const view = ref.current!
            let a!: Promise<string>, b!: Promise<string>
            await act(async () => { a = view.fetch.call(view, 0, '!'); b = view.other.bind(view)(1, '?', '?') })
            assert.equal(container.textContent, String(typeof initial === 'number' ? initial + 3 : true))
            assert.deepEqual(calls, [[view, 0, '!', typeof initial === 'number' ? initial + 1 : true],
                [view, 1, '??', typeof initial === 'number' ? initial + 3 : true]])
            await act(async () => { requests[1].resolve('second'); assert.equal(await b, 'second??') })
            assert.equal(container.textContent, String(typeof initial === 'number' ? initial + 1 : true))
            await act(async () => { requests[0].resolve('first'); assert.equal(await a, 'first!') })
            assert.equal(container.textContent, String(typeof initial === 'number' ? initial : false))
            const { fetch } = view
            await assert.rejects(fetch(0), /RC|mount/)
        })
    }
})

test('loading fixes each selected field until settlement and separates inherited instances and hooks', async () => {
    const requests = [deferred<number>(), deferred<number>(), deferred<number>()]
    let selectLeft = true, selections = 0
    class Base extends Component {
        left = 0
        right = 2
        @loading<Base>(ctx => { selections++; return selectLeft ? ctx.left : ctx.right })
        async fetch(index: number) { return requests[index].promise }
        override render() { return <span>{this.left}:{this.right}|</span> }
    }
    @RC
    class View extends Base {
        override async fetch(index: number) { return await super.fetch(index) + 1 }
    }
    let hook!: ReturnType<typeof useLoading<[], Promise<number>>>
    function Hook() { hook = useLoading(() => requests[2].promise); return <Chip>{() => String(hook.loading)}</Chip> }
    const a = createRef<View>(), b = createRef<View>()
    await mounted(async (root, container) => {
        await act(async () => root.render(<><View ref={a} /><View ref={b} /><Hook /></>))
        let first!: Promise<number>, second!: Promise<number>, third!: Promise<number>
        await act(async () => { first = a.current!.fetch(0); selectLeft = false; second = b.current!.fetch(1); third = hook.load() })
        assert.equal(container.textContent, '1:2|0:3|true')
        await act(async () => { requests[0].resolve(5); assert.equal(await first, 6) })
        assert.equal(container.textContent, '0:2|0:3|true')
        await act(async () => { requests[1].resolve(6); requests[2].resolve(7); assert.equal(await second, 7); await third })
        assert.equal(container.textContent, '0:2|0:2|false')
        assert.equal(selections, 2)
    })
})

test('loading awaits JS values and thenables, releases rejected calls and aggregates notification failures', async () => {
    const business = new Error('business'), start = new Error('start'), end = new Error('end')
    let calls = 0, failNotifications = false
    class View extends Component {
        busy = false
        run(mode: string): unknown {
            calls++
            assert.equal(this.busy, true)
            if (mode === 'throw') throw business
            if (mode === 'reject') return Promise.reject(business)
            if (mode === 'then') return { then(resolve: (value: number) => void) { resolve(42) } }
            if (mode === 'getter') return { get then() { throw business } }
            return 7
        }
        override render() { return <span>{String(this.busy)}</span> }
    }
    decorate(View.prototype, 'run', ctx => ctx.busy)
    const Wrapped = RC(View), ref = createRef<View>()
    await mounted(async (root, container) => {
        await act(async () => root.render(<Wrapped ref={ref} />))
        const view = ref.current!
        const run = (mode: string) => view.run(mode) as Promise<number>
        for (const mode of ['throw', 'reject', 'getter']) {
            await act(async () => { await assert.rejects(run(mode), e => e === business) })
            assert.equal(container.textContent, 'false')
        }
        const stop = effect(() => { const busy = view.busy; if (failNotifications) throw busy ? start : end })
        try {
            failNotifications = true
            await act(async () => {
                await assert.rejects(run('throw'), e => {
                    assert.ok(e instanceof AggregateError)
                    assert.deepEqual(e.errors, [start, business, end])
                    return true
                })
            })
            assert.equal(container.textContent, 'false')
            failNotifications = false
            await act(async () => { assert.equal(await run('then'), 42); assert.equal(await run('value'), 7) })
            assert.equal(calls, 6)
        } finally { stop() }
    })
})

test('loading rejects invalid selectors before work and restores tracking and reference capture', async () => {
    let selector: (ctx: any) => any = ctx => ctx.busy
    let calls = 0
    const sourceError = new Error('source')
    @RC
    class View extends Component {
        busy = false
        other = false
        nested = { value: false }
        declare readonly fixed: boolean
        constructor(props: {}) {
            super(props)
            Object.defineProperty(this, 'fixed', { value: false, configurable: true })
        }
        get derived() { return this.busy }
        @loading(ctx => selector(ctx))
        async run() { calls++; return this.other }
        override render() { return <span>{String(this.busy)}</span> }
    }
    const ref = createRef<View>()
    await mounted(async (root, container) => {
        await act(async () => root.render(<View ref={ref} />))
        const view = ref.current!
        const invalid: Array<(ctx: any) => any> = [
            () => false, ctx => ctx.missing, ctx => !ctx.busy, ctx => (ctx.busy, ctx.other),
            ctx => (ctx.busy, ctx.busy), ctx => ctx.nested.value, ctx => ctx.derived, ctx => ctx.fixed,
            ctx => ctx.props, ctx => ctx.state, ctx => ctx.run(), ctx => { ctx.busy = true; return false },
            ctx => { delete ctx.busy; return false }, ctx => Object.defineProperty(ctx, 'busy', { value: true }),
            ctx => Object.setPrototypeOf(ctx, null), ctx => Object.preventExtensions(ctx),
            ctx => Object.keys(ctx), ctx => Object.getPrototypeOf(ctx), ctx => 'busy' in ctx,
        ]
        for (const source of invalid) {
            selector = source
            await assert.rejects(view.run(), TypeError)
            assert.equal(view.busy, false)
        }
        selector = ctx => { void ctx.busy; throw sourceError }
        await assert.rejects(view.run(), e => e === sourceError)
        assert.equal(calls, 0)
        selector = ctx => ctx.busy
        const raw = reactive({ value: 1, trigger: 0 })
        const requests: Promise<boolean>[] = []
        await act(async () => {
            const reference = captureReference(() => { requests.push(view.run()); return raw.value })
            reference.write(2)
            await Promise.all(requests)
        })
        assert.equal(raw.value, 2)
        let stop!: () => void
        await act(async () => { stop = effect(() => { void raw.trigger; requests.push(view.run()) }); await Promise.all(requests) })
        const baseline = calls
        await act(async () => { view.other = true })
        assert.equal(calls, baseline)
        await act(async () => { raw.trigger++; await Promise.all(requests) })
        assert.equal(calls, baseline + 1)
        stop()
        assert.equal(container.textContent, 'false')
        Object.defineProperty(view, 'busy', { value: false, writable: true })
        await assert.rejects(view.run(), /redefined/)
    })
})

test('loading validates numeric capacity and mode, guards active writes including Model and permits idle baselines', async () => {
    for (const initial of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER]) {
        let calls = 0
        @RC
        class Invalid extends Component {
            stack = initial
            @loading(ctx => ctx.stack)
            async run() { calls++ }
            override render() { return null }
        }
        const ref = createRef<Invalid>()
        await mounted(async root => {
            await act(async () => root.render(<Invalid ref={ref} />))
            await assert.rejects(ref.current!.run(), /integer|MAX_SAFE_INTEGER/)
            assert.ok(Object.is(ref.current!.stack, initial))
            assert.equal(calls, 0)
            ref.current!.stack = 0
            await ref.current!.run()
            assert.equal(calls, 1)
        })
    }
    const request = deferred<void>()
    let input!: (value: number) => void
    function Control(props: { value?: number; onChange?: (value: number) => void }) { input = props.onChange!; return <span>{props.value}</span> }
    @RC
    class View extends Component {
        stack = Number.MAX_SAFE_INTEGER - 1
        @loading(ctx => ctx.stack)
        async run() { return request.promise }
        override render() { return <Model source={() => this.stack}><Control /></Model> }
    }
    const ref = createRef<View>()
    await mounted(async (root, container) => {
        await act(async () => root.render(<View ref={ref} />))
        const view = ref.current!
        let running!: Promise<void>
        await act(async () => { running = view.run() })
        assert.equal(container.textContent, String(Number.MAX_SAFE_INTEGER))
        await assert.rejects(view.run(), RangeError)
        for (const write of [() => { view.stack = 0 }, () => input(0), () => captureReference(() => view.stack).write(0)]) {
            assert.throws(write, /active loading/)
        }
        view.stack = Number.MAX_SAFE_INTEGER // Idempotent external writes are allowed.
        assert.throws(() => Reflect.set(view, 'stack', true), /mode/)
        await act(async () => { request.resolve(); await running })
        assert.equal(container.textContent, String(Number.MAX_SAFE_INTEGER - 1))
        await act(async () => { view.stack = 5; await view.run() })
        assert.equal(container.textContent, '5')
        assert.throws(() => { view.stack = -1 }, /integer/)
        assert.throws(() => Reflect.set(view, 'stack', false), /mode/)
    })
})

test('loading registers tokens before reentrant watchers and protects other requests on rejection', async () => {
    const requests = [deferred<string>(), deferred<string>()]
    const rejected = new Error('rejected')
    @RC
    class View extends Component {
        stack = 0
        @loading(ctx => ctx.stack)
        async run(index: number) { return requests[index].promise }
        override render() { return <span>{this.stack}</span> }
    }
    const ref = createRef<View>()
    await mounted(async (root, container) => {
        await act(async () => root.render(<View ref={ref} />))
        const view = ref.current!
        let a!: Promise<string>, b!: Promise<string>
        const stop = watch(() => view.stack, next => { if (next === 1 && !b) b = view.run(1) })
        try {
            await act(async () => { a = view.run(0) })
            assert.equal(container.textContent, '2')
            const rejection = assert.rejects(b, e => e === rejected)
            await act(async () => { requests[1].reject(rejected); await rejection })
            assert.equal(container.textContent, '1')
            await act(async () => { requests[0].resolve('done'); assert.equal(await a, 'done') })
            assert.equal(container.textContent, '0')
        } finally { stop() }
    })
})

test('React state/context/refs, PureComponent and props deduplication coexist with loading field updates', async () => {
    const Context = createContext('context')
    const request = deferred<string>()
    const history: unknown[] = []
    let renders = 0, forces = 0
    @RC
    class View extends PureComponent<{ count: number }, { local: number }> {
        static override contextType = Context
        declare context: string
        override state = { local: 0 }
        busy = false
        count = 0
        stop = () => {}
        @loading(ctx => ctx.busy)
        async run() { return request.promise }
        override componentDidMount() {
            const force = this.forceUpdate
            this.forceUpdate = (...args) => { forces++; force.apply(this, args) }
            this.stop = watch(() => this.props.count, next => { if (next === 3) this.count++ })
        }
        override getSnapshotBeforeUpdate() { return 'snapshot' }
        override componentDidUpdate(props: { count: number }, state: { local: number }, snapshot: string) { history.push([props.count, state.local, snapshot]) }
        override componentWillUnmount() { this.stop() }
        override render() { renders++; return <span>{this.props.count}:{this.count}:{this.state.local}:{this.context}:{String(this.busy)}</span> }
    }
    const ref = createRef<View>()
    await mounted(async (root, container) => {
        const render = (count: number) => root.render(<View ref={ref} count={count} />)
        await act(async () => render(1))
        await act(async () => render(2))
        assert.equal(renders, 2)
        assert.equal(forces, 0)
        assert.deepEqual(history, [[1, 0, 'snapshot']])
        await act(async () => render(3))
        assert.equal(container.textContent, '3:1:0:context:false')
        assert.equal(forces, 1)
        await act(async () => ref.current!.setState({ local: 1 }))
        let running!: Promise<string>
        await act(async () => { running = ref.current!.run() })
        assert.equal(container.textContent, '3:1:1:context:true')
        await act(async () => { request.resolve('done'); await running })
        assert.equal(container.textContent, '3:1:1:context:false')
    })
    @RCC
    class NoUpdate extends Component {
        count = 0
        override shouldComponentUpdate() { return false }
        override render() { return <span>{this.count}</span> }
    }
    const second = createRef<NoUpdate>()
    await mounted(async (root, container) => {
        await act(async () => root.render(<NoUpdate ref={second} />))
        await act(async () => { second.current!.count++ })
        assert.equal(container.textContent, '1')
    })
})

test('class mount windows and loading in componentDidMount recover through StrictMode', async () => {
    const pending = deferred<number>()
    const requests: Promise<number>[] = []
    let mounts = 0, calls = 0
    function Child({ view }: { view: View }) { useLayoutEffect(() => { view.count = 2 }, [view]); return null }
    @RC
    class View extends Component {
        busy = false
        count = 1
        @loading(ctx => ctx.busy)
        async run() { calls++; return pending.promise }
        override componentDidMount() { mounts++; if (mounts === 1) requests.push(this.run()) }
        override render() { return <span>{this.count}:{String(this.busy)}<Child view={this} /></span> }
    }
    const ref = createRef<View>()
    await mounted(async (root, container) => {
        await act(async () => root.render(<StrictMode><View ref={ref} /></StrictMode>))
        assert.equal(container.textContent, '2:true')
        assert.equal(calls, 1)
        await act(async () => { pending.resolve(9); assert.equal(await requests[0], 9) })
        assert.equal(container.textContent, '2:false')
        await act(async () => { ref.current!.count++ })
        assert.equal(container.textContent, '3:false')
    })
})

test('loading stops publication while hidden, settles internally and restores real tokens and idle writes', async () => {
    for (const mode of ['active', 'settled', 'adjusted']) {
        const finishHidden = mode !== 'active'
        const pending = deferred<number>()
        const never = new Promise<void>(() => {})
        let instance!: View, calls = 0, forces = 0
        @RC
        class View extends Component<{ suspend: boolean }> {
            stack = 2
            constructor(props: { suspend: boolean }) { super(props); instance = this }
            @loading(ctx => ctx.stack)
            async run() { calls++; return pending.promise }
            override forceUpdate(callback?: () => void) { forces++; super.forceUpdate(callback) }
            override render() { if (this.props.suspend) throw never; return <span>{this.stack}</span> }
        }
        await mounted(async (root, container) => {
            const render = (suspend: boolean) => root.render(<Suspense fallback="hidden"><View suspend={suspend} /></Suspense>)
            await act(async () => render(false))
            let running!: Promise<number>
            await act(async () => { running = instance.run() })
            await act(async () => flushSync(() => render(true)))
            assert.ok(container.textContent?.includes('hidden'))
            const baseline = forces
            await assert.rejects(instance.run(), /unmount/)
            if (finishHidden) {
                await act(async () => { pending.resolve(7); assert.equal(await running, 7) })
                assert.equal(instance.stack, 3)
                assert.equal(forces, baseline)
                if (mode === 'adjusted') instance.stack = 5 // Idle edits become the new baseline.
            }
            await act(async () => render(false))
            assert.equal(container.textContent, mode === 'adjusted' ? '5' : finishHidden ? '2' : '3')
            if (!finishHidden) await act(async () => { pending.resolve(7); assert.equal(await running, 7) })
            assert.equal(container.textContent, mode === 'adjusted' ? '5' : '2')
            assert.equal(calls, 1)
        })
    }
})

test('unmount and a new instance cannot receive old loading completion or retained calls', async () => {
    const pending = deferred<number>()
    let calls = 0
    @RC
    class View extends Component {
        busy = false
        @loading(ctx => ctx.busy)
        async run() { calls++; return pending.promise }
        override render() { return <span>{String(this.busy)}</span> }
    }
    const ref = createRef<View>()
    let previous!: View, running!: Promise<number>
    const changes: boolean[] = []
    let stop!: () => void
    await mounted(async root => {
        await act(async () => root.render(<View ref={ref} />))
        previous = ref.current!
        stop = watch(() => previous.busy, next => changes.push(next))
        await act(async () => { running = previous.run() })
    })
    await assert.rejects(previous.run(), /unmount/)
    await mounted(async (root, container) => {
        await act(async () => root.render(<View ref={ref} />))
        assert.notEqual(previous, ref.current)
        await act(async () => { pending.resolve(42); assert.equal(await running, 42) })
        assert.equal(previous.busy, true)
        assert.deepEqual(changes, [true])
        assert.equal(container.textContent, 'false')
        assert.equal(calls, 1)
    })
    stop()
})

test('loading rejects construction, render and uncommitted/SSR calls without starting work', async () => {
    const rejected: Promise<void>[] = []
    let calls = 0, renders = 0
    const never = new Promise<void>(() => {})
    @RC
    class View extends Component<{ suspend?: boolean; attempt?: boolean }> {
        busy = false
        constructor(props: { suspend?: boolean; attempt?: boolean }) {
            super(props)
            rejected.push(assert.rejects(this.run(), /mount/))
        }
        @loading(ctx => ctx.busy)
        async run() { calls++ }
        override render() {
            renders++
            if (this.props.attempt) rejected.push(assert.rejects(this.run(), /render|mount/))
            if (this.props.suspend) throw never
            return <span>{String(this.busy)}</span>
        }
    }
    assert.equal(renderToString(<View attempt />), '<span>false</span>')
    const container = document.createElement('div')
    container.innerHTML = '<span>false</span>'
    document.body.append(container)
    let root!: Root
    try {
        await act(async () => { root = hydrateRoot(container, <View />) })
        await act(async () => root.render(<View attempt />))
        assert.equal(container.textContent, 'false')
    } finally { await act(async () => root.unmount()); container.remove() }
    await mounted(async root => {
        await act(async () => root.render(<Suspense fallback="waiting"><View suspend attempt /></Suspense>))
        const baseline = renders
        await Promise.all(rejected)
        assert.equal(renders, baseline)
    })
    await Promise.all(rejected)
    assert.equal(calls, 0)
})

test('failed mount and throwing unmount release observation and loading connectivity synchronously', async () => {
    const pending = deferred<number>(), failure = new Error('mount failure')
    let instance!: View, running!: Promise<number>, forces = 0
    @RC
    class View extends Component {
        busy = false
        count = 0
        constructor(props: {}) { super(props); instance = this }
        @loading(ctx => ctx.busy)
        async run() { return pending.promise }
        override componentDidMount() { running = this.run(); throw failure }
        override componentWillUnmount() { throw new Error('unmount failure') }
        override forceUpdate(callback?: () => void) { forces++; super.forceUpdate(callback) }
        override render() { return <span>{this.count}:{String(this.busy)}</span> }
    }
    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
        override state = { failed: false }
        static getDerivedStateFromError() { return { failed: true } }
        override render() { return this.state.failed ? 'failed' : this.props.children }
    }
    const original = console.error
    console.error = () => {}
    try {
        await mounted(async (root, container) => {
            await act(async () => root.render(<Boundary><View /></Boundary>))
            assert.equal(container.textContent, 'failed')
            const baseline = forces
            await assert.rejects(instance.run(), /unmount/)
            instance.count++
            pending.resolve(7)
            assert.equal(await running, 7)
            assert.equal(instance.busy, true)
            assert.equal(forces, baseline)
        })
    } finally { console.error = original }
})

test('loading validates legacy method descriptors and rejects unsupported decorator targets', async () => {
    class View extends Component {
        busy = false
        async run() {}
        static async staticRun() {}
        get getter() { return false }
        arrow = async () => {}
        override async componentDidMount() {}
        override render() { return null }
    }
    assert.throws(() => loading(null as never), TypeError)
    for (const [target, key] of [[View, 'staticRun'], [View.prototype, 'getter'], [View.prototype, 'arrow'],
        [View.prototype, 'render'], [View.prototype, 'componentDidMount'], [View.prototype, 'constructor']] as const) {
        assert.throws(() => decorate(target, key, ctx => ctx.busy), TypeError)
    }
    const stage3 = loading(ctx => ctx.busy) as Function
    assert.throws(() => stage3(() => {}, { kind: 'method', name: 'run' }), /legacy/)
    decorate(View.prototype, 'run', ctx => ctx.busy)
    assert.throws(() => decorate(View.prototype, 'run', ctx => ctx.busy), /twice/)
    await assert.rejects(new View({}).run(), /RC|mount/)
})

test('symbol and empty loading fields work from committed props watches without duplicate props notifications', async () => {
    const key = Symbol('loading')
    const pending = deferred<number>()
    const requests: Promise<number>[] = []
    const snapshots: unknown[] = []
    let renders = 0, forces = 0
    @RCC
    class View extends Component<{ count: number }> {
        [key] = false
        '' = 2
        stop = () => {}
        @loading<View>(ctx => ctx[key])
        async run() { snapshots.push([this[key], this['']]); return pending.promise }
        @loading<View>(ctx => ctx[''])
        async count() { return pending.promise }
        override componentDidMount() {
            this.stop = watch(() => this.props.count, next => { if (next === 2) requests.push(this.run(), this.count()) })
        }
        override componentWillUnmount() { this.stop() }
        override forceUpdate(callback?: () => void) { forces++; super.forceUpdate(callback) }
        override render() { renders++; return <span>{this.props.count}:{String(this[key])}:{this['']}</span> }
    }
    const ref = createRef<View>()
    await mounted(async (root, container) => {
        await act(async () => root.render(<View ref={ref} count={1} />))
        await act(async () => root.render(<View ref={ref} count={2} />))
        assert.equal(container.textContent, '2:true:3')
        assert.deepEqual(snapshots, [[true, 2]])
        assert.equal(forces, 1)
        assert.equal(renders, 3)
        await act(async () => { pending.resolve(9); assert.deepEqual(await Promise.all(requests), [9, 9]) })
        assert.equal(container.textContent, '2:false:2')
        await act(async () => { ref.current![key] = true }) // Valid idle boolean edits survive until another call.
        assert.equal(container.textContent, '2:true:2')
        await act(async () => { await ref.current!.run() })
        assert.equal(container.textContent, '2:false:2')
    })
})
