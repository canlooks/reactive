import './dom.js'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    act, Component, PureComponent, StrictMode, Suspense, createContext, createRef, startTransition,
    useContext, useEffect, useLayoutEffect, type ReactNode, type ChangeEvent,
} from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { renderToString } from 'react-dom/server'
import { batch, computed, effect, reactive, watch } from '../src/index.js'
import {
    RC, Chip, AsyncChip, chip, strictChip, asyncChip, asyncStrictChip,
    Model, defineModel, useModel, useLoading, useReactive, useWatch,
    type UseLoadingReturn, type UseModelReturn,
} from '../src/react/index.js'

async function mounted(run: (root: Root, container: HTMLDivElement) => Promise<void>) {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    try { await run(root, container) } finally {
        await act(async () => root.unmount())
        container.remove()
    }
}

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
    return { promise, resolve, reject }
}

function serverRender(element: ReactNode): string {
    const previous = globalThis.window
    Reflect.deleteProperty(globalThis, 'window')
    try { return renderToString(element) } finally { globalThis.window = previous }
}

function inputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const prototype = input instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
}

test('useLoading counts concurrent tokens, settles out of order and preserves boolean/numeric baselines', async () => {
    for (const initial of [undefined, false, true, 0, 2]) {
        const requests = [deferred<string>(), deferred<string>()]
        let loading!: UseLoadingReturn<[number], Promise<string>, boolean | number>
        let renders = 0
        const View = RC(({ initial }: { initial?: boolean | number }) => {
            renders++
            loading = useLoading((index: number) => requests[index].promise, initial)
            return <span>{String(loading.loading)}:{loading.stacksCount}</span>
        })
        await mounted(async (root, container) => {
            await act(async () => root.render(<View initial={initial} />))
            assert.equal(loading.loading, initial ?? false)
            assert.equal(loading.stacksCount, 0)
            const first = loading
            const { load } = loading
            const snapshots: unknown[] = []
            const stop = effect(() => snapshots.push([loading.loading, loading.stacksCount]))
            let a!: Promise<string>
            let b!: Promise<string>
            await act(async () => { a = load(0); b = load(1) })
            assert.equal(loading.loading, typeof initial === 'number' ? initial + 2 : true)
            assert.equal(loading.stacksCount, 2)
            await act(async () => root.render(<View initial={99} />))
            assert.equal(loading, first)
            assert.equal(loading.load, load)
            await act(async () => { requests[1].resolve('second'); assert.equal(await b, 'second') })
            assert.equal(loading.stacksCount, 1)
            assert.equal(loading.loading, typeof initial === 'number' ? initial + 1 : true)
            const error = new Error('first failed')
            const rejection = assert.rejects(a, e => e === error)
            await act(async () => { requests[0].reject(error); await rejection })
            const baseline = typeof initial === 'number' ? initial : false
            assert.equal(container.textContent, `${baseline}:0`)
            assert.deepEqual(snapshots, [[initial ?? false, 0],
                [typeof initial === 'number' ? initial + 1 : true, 1],
                [typeof initial === 'number' ? initial + 2 : true, 2],
                [typeof initial === 'number' ? initial + 1 : true, 1], [baseline, 0]])
            assert.ok(renders >= 4)
            stop()
        })
    }
})

test('load wraps values and thenables, preserves synchronous/asynchronous failures and can retry', async () => {
    const error = new Error('request')
    let loading!: UseLoadingReturn<[string], unknown, boolean>
    function View() {
        loading = useLoading((mode: string) => {
            if (mode === 'throw') throw error
            if (mode === 'reject') return Promise.reject(error)
            if (mode === 'then') return { then(resolve: (value: number) => void) { resolve(42) } }
            if (mode === 'getter') return { get then() { throw error } }
            return mode
        })
        return <Chip>{() => `${loading.loading}:${loading.stacksCount}`}</Chip>
    }
    await mounted(async (root, container) => {
        await act(async () => root.render(<View />))
        for (const mode of ['throw', 'reject', 'getter']) {
            await act(async () => { await assert.rejects(loading.load(mode), e => e === error) })
            assert.equal(container.textContent, 'false:0')
        }
        await act(async () => {
            assert.equal(await loading.load('then'), 42)
            assert.equal(await loading.load('success'), 'success')
        })
        assert.equal(container.textContent, 'false:0')
        assert.equal(Reflect.set(loading, 'loading', 1), false)
        assert.equal(Reflect.set(loading, 'stacksCount', 2), false)
    })
    for (const invalid of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        function Invalid() { useLoading(() => 1, invalid); return null }
        assert.throws(() => serverRender(<Invalid />), TypeError)
    }
})

test('loading releases tokens and preserves every error when both business code and state subscribers fail', async () => {
    const startError = new Error('start subscriber')
    const endError = new Error('end subscriber')
    const businessError = new Error('business')
    let fail = true
    let armed = false
    let loading!: UseLoadingReturn<[], number, boolean>
    function View() { loading = useLoading(() => { if (fail) throw businessError; return 7 }); return null }
    await mounted(async root => {
        await act(async () => root.render(<View />))
        const stop = effect(() => {
            const active = loading.loading
            if (armed) throw active ? startError : endError
        })
        armed = true
        await assert.rejects(loading.load(), (error: unknown) => {
            assert.ok(error instanceof AggregateError)
            assert.deepEqual(error.errors, [startError, businessError, endError])
            return true
        })
        assert.equal(loading.loading, false)
        assert.equal(loading.stacksCount, 0)
        armed = false
        fail = false
        assert.equal(await loading.load(), 7)
        stop()
    })
})

test('immediate and props watches see active model/load handles and the latest committed function', async () => {
    const calls: Promise<string>[] = []
    let loading!: UseLoadingReturn<[number, string], string, boolean>
    let model!: UseModelReturn<string>
    const View = RC((props: { count: number; label: string }) => {
        const { label } = props
        useWatch(() => props.count, count => {
            model.onChange(label)
            calls.push(loading.load(count, '!'))
        }, { immediate: true })
        model = useModel('initial')
        loading = useLoading((count: number, suffix: string) => label + count + suffix)
        return <>{model.value}:{String(loading.loading)}</>
    })
    await mounted(async (root, container) => {
        await act(async () => root.render(<View count={1} label="A" />))
        assert.equal(await calls[0], 'A1!')
        assert.equal(container.textContent, 'A:false')
        const load = loading.load
        await act(async () => root.render(<View count={2} label="B" />))
        assert.equal(await calls[1], 'B2!')
        assert.equal(loading.load, load)
        assert.equal(container.textContent, 'B:false')
    })
})

test('load never adopts a suspended candidate and running requests retain their original closure', async () => {
    const wait = deferred<void>()
    const never = new Promise<void>(() => {})
    let loading!: UseLoadingReturn<[string], Promise<string>, boolean>
    const View = RC(({ label, suspend }: { label: string; suspend: boolean }) => {
        loading = useLoading(async (suffix: string) => { await wait.promise; return label + suffix })
        if (suspend) throw never
        return null
    })
    await mounted(async root => {
        const render = (label: string, suspend = false) => root.render(<Suspense fallback="waiting"><View label={label} suspend={suspend} /></Suspense>)
        await act(async () => render('A'))
        const load = loading.load
        let a!: Promise<string>
        await act(async () => { a = load('1') })
        await act(async () => startTransition(() => render('B', true)))
        let b!: Promise<string>
        await act(async () => { b = load('2') })
        await act(async () => render('C'))
        let c!: Promise<string>
        await act(async () => { c = load('3') })
        await act(async () => {
            wait.resolve()
            assert.deepEqual(await Promise.all([a, b, c]), ['A1', 'A2', 'C3'])
        })
        assert.equal(loading.stacksCount, 0)
    })
})

test('load settles internally after unmount, rejects retained invocations and isolates new mounts', async () => {
    let calls = 0
    const pending = deferred<number>()
    let loading!: UseLoadingReturn<[], Promise<number>, number>
    function View() { loading = useLoading(() => { calls++; return pending.promise }, 2); return null }
    let result!: Promise<number>
    await mounted(async root => {
        await act(async () => root.render(<View />))
        result = loading.load()
        assert.equal(loading.loading, 3)
    })
    const old = loading
    await assert.rejects(old.load(), /unmount/)
    assert.equal(calls, 1)
    await mounted(async root => {
        await act(async () => root.render(<View />))
        assert.notEqual(loading, old)
        pending.resolve(42)
        assert.equal(await result, 42)
        assert.equal(old.loading, 3) // Disconnected public state is no longer published.
        assert.equal(old.stacksCount, 1)
        assert.equal(loading.loading, 2)
        assert.equal(loading.stacksCount, 0)
    })
})

test('StrictMode loading reconnects its tokens, SSR does not invoke functions and instances stay separate', async () => {
    const pending = deferred<number>()
    let calls = 0
    let a!: UseLoadingReturn<[], Promise<number>, boolean>
    let b!: typeof a
    let request: Promise<number> | undefined
    const rejected: Promise<unknown>[] = []
    const fn = () => { calls++; return pending.promise }
    function View() {
        a = useLoading(fn, true)
        b = useLoading(fn)
        useLayoutEffect(() => {
            request ??= a.load()
            return () => { rejected.push(assert.rejects(a.load(), /unmount/)) }
        }, [])
        return <Chip>{() => `${a.loading}:${a.stacksCount}/${b.loading}:${b.stacksCount}`}</Chip>
    }
    function ServerView() { const value = useLoading(fn, true); return <span>{String(value.loading)}</span> }
    assert.equal(serverRender(<ServerView />), '<span>true</span>')
    assert.equal(calls, 0)
    await mounted(async (root, container) => {
        await act(async () => root.render(<StrictMode><View /></StrictMode>))
        assert.equal(calls, 1)
        assert.equal(container.textContent, 'true:1/false:0')
        await act(async () => { pending.resolve(1); await request })
        assert.equal(container.textContent, 'false:0/false:0')
    })
    await Promise.all(rejected)
})

test('calling load from an effect does not subscribe it to token bookkeeping or function reads', async () => {
    const state = reactive({ trigger: 0, other: 1 })
    const requests: Promise<number>[] = []
    let loading!: UseLoadingReturn<[], number, boolean>
    function View() { loading = useLoading(() => state.other); return null }
    await mounted(async root => {
        await act(async () => root.render(<View />))
        const stop = effect(() => { void state.trigger; requests.push(loading.load()) })
        await Promise.all(requests)
        assert.equal(requests.length, 1)
        state.other++
        assert.equal(requests.length, 1)
        state.trigger++
        await Promise.all(requests)
        assert.equal(requests.length, 2)
        stop()
    })
})

test('loading resumes from real tokens after a hidden Suspense tree completes its requests', async () => {
    const pending = deferred<number>()
    const never = new Promise<void>(() => {})
    let loading!: UseLoadingReturn<[], Promise<number>, number>
    const View = RC(({ suspend }: { suspend: boolean }) => {
        loading = useLoading(() => pending.promise, 2)
        if (suspend) throw never
        return <span>{loading.loading}:{loading.stacksCount}</span>
    })
    await mounted(async (root, container) => {
        const render = (suspend: boolean) => root.render(<Suspense fallback="hidden"><View suspend={suspend} /></Suspense>)
        await act(async () => render(false))
        let request!: Promise<number>
        await act(async () => { request = loading.load() })
        await act(async () => flushSync(() => render(true)))
        assert.ok(container.textContent?.includes('hidden'))
        await assert.rejects(loading.load(), /unmount/)
        await act(async () => { pending.resolve(1); assert.equal(await request, 1) })
        assert.equal(loading.stacksCount, 1)
        await act(async () => render(false))
        assert.equal(container.textContent, '2:0')
        assert.equal(loading.stacksCount, 0)
    })
})

test('failed commit setup disconnects all model and loading handles before their own layout cleanup', async () => {
    let loading!: UseLoadingReturn<[], number, boolean>
    let model!: UseModelReturn<string>
    let calls = 0
    const error = new Error('setup')
    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
        override state = { failed: false }
        static getDerivedStateFromError() { return { failed: true } }
        override componentDidCatch(caught: unknown) { assert.equal(caught, error) }
        override render() { return this.state.failed ? 'failed' : this.props.children }
    }
    const View = RC(() => {
        model = useModel('A')
        loading = useLoading(() => ++calls)
        useWatch(() => 1, () => { throw error }, { immediate: true })
        return null
    })
    const original = console.error
    console.error = () => {}
    try {
        await mounted(async (root, container) => {
            await act(async () => root.render(<Boundary><View /></Boundary>))
            assert.equal(container.textContent, 'failed')
            model.onChange('B')
            assert.equal(model.value, 'A')
            await assert.rejects(loading.load(), /unmount/)
            assert.equal(calls, 0)
        })
    } finally { console.error = original }
})

test('props watch, Strict Chip, Model and load share commit ordering without suppressing child updates', async () => {
    const data = reactive({ name: 'A' })
    let loading!: UseLoadingReturn<[number], number, boolean>
    const requests: Promise<number>[] = []
    const View = RC((props: { count: number }) => {
        const { count } = props
        useWatch(() => props.count, next => { requests.push(loading.load(next)); data.name = String(next) })
        loading = useLoading(value => value * count)
        return <>
            <Chip.Strict>{() => `${props.count}:${String(loading.loading)}|`}</Chip.Strict>
            <Model source={() => data.name}><input /></Model>
        </>
    })
    await mounted(async (root, container) => {
        await act(async () => root.render(<View count={1} />))
        await act(async () => root.render(<View count={2} />))
        assert.equal(await requests[0], 4)
        assert.equal(container.textContent, '2:false|')
        assert.equal(container.querySelector('input')!.value, '2')
        await act(async () => inputValue(container.querySelector('input')!, '3'))
        assert.equal(data.name, '3')
    })
})

test('useModel preserves identities and treats function initial values and object inputs as data', async () => {
    let model!: UseModelReturn<string>
    let checked!: UseModelReturn<boolean>
    let object!: UseModelReturn<{ target: { value: string } }>
    let functionModel!: UseModelReturn<() => string>
    let parentRenders = 0
    const fn = () => 'initial'
    function Parent({ initial }: { initial: string }) {
        parentRenders++
        model = useModel(initial)
        checked = useModel(false)
        object = useModel({ target: { value: 'initial' } })
        functionModel = useModel(fn)
        return <Chip>{() => <>
            <input value={model.value} onChange={model.onChange} />
            <input type="checkbox" checked={checked.value} onChange={checked.onChange} />
            <span>{model.value}:{String(checked.value)}</span>
        </>}</Chip>
    }
    await mounted(async (root, container) => {
        await act(async () => root.render(<Parent initial="A" />))
        const first = model
        const change = model.onChange
        assert.equal(functionModel.value, fn)
        const [text, checkbox] = container.querySelectorAll('input')
        await act(async () => inputValue(text, 'B'))
        await act(async () => checkbox.click())
        assert.equal(model.value, 'B')
        assert.equal(checked.value, true)
        assert.equal(parentRenders, 1)
        await act(async () => change('C'))
        assert.equal(text.value, 'C')
        await act(async () => { model.value = 'D' })
        assert.equal(text.value, 'D')
        await act(async () => root.render(<Parent initial="reset" />))
        assert.equal(model, first)
        assert.equal(model.onChange, change)
        assert.equal(model.value, 'D')
        object.onChange({ target: { value: 'data' } })
        assert.deepEqual(object.value, { target: { value: 'data' } })
        const next = () => 'next'
        functionModel.onChange(next)
        assert.equal(functionModel.value, next)
    })
    const oldValue = model.value
    model.onChange('after unmount')
    assert.equal(model.value, oldValue)
})

test('Model and defineModel bind real inputs, preserve refs and merge callbacks after one batched write', async () => {
    const data = reactive({ name: 'Alice', extra: 0 })
    const ref = createRef<HTMLInputElement>()
    const changes: unknown[] = []
    let parents = 0
    let mounts = 0
    const TextInput = defineModel(props => {
        useEffect(() => { mounts++ }, [])
        return <input {...props} />
    })
    function Form() {
        parents++
        return <>
            <Model source={() => data.name}><input key="name" ref={ref} data-kind="text" defaultValue="ignored"
                onChange={event => { changes.push([data.name, event.currentTarget.value]); data.extra++ }} /></Model>
            <TextInput refer={() => data.name} aria-label="reusable" />
        </>
    }
    const effects: unknown[] = []
    const stop = effect(() => effects.push([data.name, data.extra]))
    const warnings: unknown[] = []
    const original = console.error
    console.error = (...args) => { warnings.push(args) }
    try {
        await mounted(async (root, container) => {
            await act(async () => root.render(<Form />))
            const input = ref.current!
            assert.equal(input, container.querySelector('input'))
            assert.equal(input.value, 'Alice')
            assert.equal(input.dataset.kind, 'text')
            await act(async () => inputValue(input, 'Bob'))
            assert.equal(data.name, 'Bob')
            assert.deepEqual(changes, [['Bob', 'Bob']])
            assert.deepEqual(effects, [['Alice', 0], ['Bob', 1]])
            assert.equal(container.querySelectorAll('input')[1].value, 'Bob')
            await act(async () => { data.name = 'Carol' })
            assert.equal(input.value, 'Carol')
            assert.equal(parents, 1)
            assert.equal(mounts, 1)
        })
        assert.equal(ref.current, null)
        assert.deepEqual(warnings, [])
    } finally { console.error = original; stop() }
})

test('Model handles checkbox/radio, text areas, selects, explicit numbers and nullable display values', async () => {
    const data = reactive({ check: undefined as boolean | undefined, radio: false, text: null as string | null,
        single: 'b', many: undefined as string[] | undefined, number: 3 })
    const warnings: unknown[] = []
    const original = console.error
    console.error = (...args) => warnings.push(args)
    try {
        await mounted(async (root, container) => {
            await act(async () => root.render(<>
                <Model source={() => data.check} valueProp="checked"><input type="checkbox" value="submit" defaultChecked /></Model>
                <Model source={() => data.radio}><input type="radio" /></Model>
                <Model source={() => data.text}><textarea /></Model>
                <Model source={() => data.single}><select><option value="a">A</option><option value="b">B</option></select></Model>
                <Model source={() => data.many}><select multiple><option value="a">A</option><option value="b">B</option></select></Model>
                <Model source={() => data.number} postValue={(event: ChangeEvent<HTMLInputElement>) => event.currentTarget.valueAsNumber}>
                    <input type="number" />
                </Model>
            </>))
            const [check, radio, number] = container.querySelectorAll('input')
            const [single, multi] = container.querySelectorAll('select')
            const text = container.querySelector('textarea')!
            assert.equal(check.checked, false)
            assert.equal(check.value, 'submit')
            assert.equal(text.value, '')
            assert.equal(multi.selectedOptions.length, 0)
            assert.equal(data.check, undefined)
            assert.equal(data.text, null)
            assert.equal(data.many, undefined)
            await act(async () => { check.click(); radio.click(); inputValue(text, 'text'); inputValue(number, '12') })
            await act(async () => {
                single.value = 'a'
                single.dispatchEvent(new window.Event('change', { bubbles: true }))
                for (const option of multi.options) option.selected = true
                multi.dispatchEvent(new window.Event('change', { bubbles: true }))
            })
            assert.deepEqual({ ...data }, { check: true, radio: true, text: 'text', single: 'a', many: ['a', 'b'], number: 12 })
        })
        assert.deepEqual(warnings, [])
    } finally { console.error = original }
})

test('Model resolves the current nested target at event time and retains committed event configuration during Suspense', async () => {
    const first = reactive({ user: { name: 'A' } })
    const second = reactive({ user: { name: 'B' } })
    const never = new Promise<void>(() => {})
    let handler!: (value: string, suffix: string) => void
    const callbacks: string[] = []
    function Control({ value, onChange, suspend }: { value: string; onChange?: typeof handler; suspend: boolean }) {
        if (onChange) handler = onChange
        if (suspend) throw never
        return <span>{value}</span>
    }
    const render = (store: typeof first, label: string, suspend: boolean) => <Suspense fallback="waiting">
        <Model source={() => store.user.name} postValue={(value: string, suffix: string) => value + suffix + label}>
            <Control value="ignored" suspend={suspend} onChange={(...args) => callbacks.push(label + args.join(':'))} />
        </Model>
    </Suspense>
    await mounted(async (root, container) => {
        await act(async () => root.render(render(first, 'old', false)))
        const stable = handler
        const oldUser = first.user
        await act(async () => {
            batch(() => {
                first.user = { name: 'new object' }
                handler('X', '!')
                assert.equal(first.user.name, 'X!old')
            })
        })
        assert.equal(oldUser.name, 'A')
        await act(async () => startTransition(() => root.render(render(second, 'new', true))))
        await act(async () => stable('Y', '?'))
        assert.equal(first.user.name, 'Y?old')
        assert.equal(second.user.name, 'B')
        await act(async () => root.render(render(second, 'new', false)))
        assert.equal(handler, stable)
        await act(async () => handler('Z', '!'))
        assert.equal(second.user.name, 'Z!new')
        assert.equal(container.textContent, 'Z!new')
        assert.deepEqual(callbacks, ['oldX:!', 'oldY:?', 'newZ:!'])
    })
    handler('ignored', '!')
    assert.equal(second.user.name, 'Z!new')
    assert.equal(callbacks.length, 3)
})

test('custom Model values, valueProp and defineModel preserve complete argument tuples and business props', async () => {
    const data = reactive({ enabled: true, object: { target: 'data' }, amount: 2 })
    let toggle!: (value: boolean) => void
    let changeObject!: (value: { target: string }) => void
    let amount!: (value: number, unit: string) => void
    const calls: unknown[] = []
    function BooleanControl(props: { value?: boolean; onChange?: typeof toggle }) { toggle = props.onChange!; return String(props.value) }
    function ObjectControl(props: { value?: { target: string }; onChange?: typeof changeObject }) { changeObject = props.onChange!; return props.value?.target }
    const Amount = defineModel((props: { value: number; onChange: typeof amount; label: string }) => {
        amount = props.onChange
        return <span>{props.label}:{props.value}</span>
    }, (value, unit) => { calls.push(['convert', value, unit]); return value * 2 })
    await mounted(async (root, container) => {
        await act(async () => root.render(<>
            <Model source={() => data.enabled} valueProp="value"><BooleanControl /></Model>
            <Model source={() => data.object}><ObjectControl /></Model>
            <Amount label="amount" refer={() => data.amount} onChange={(...args) => calls.push(['original', data.amount, ...args])} />
        </>))
        assert.equal(container.textContent, 'truedataamount:2')
        await act(async () => { toggle(false); changeObject({ target: 'kept as object' }); amount(4, 'kg') })
        assert.equal(container.textContent, 'falsekept as objectamount:8')
        assert.deepEqual(calls, [['convert', 4, 'kg'], ['original', 8, 4, 'kg']])
    })
})

test('Model conversion/write/callback failures preserve ordering, errors and net-change batching', async () => {
    const state = reactive({ value: 1 })
    const error = new Error('business')
    let change!: (value: number) => void
    let originals = 0
    function Control(props: { value?: number; onChange?: typeof change }) { change = props.onChange!; return null }
    const seen: number[] = []
    const stop = watch(() => state.value, value => seen.push(value))
    await mounted(async (root) => {
        const render = (mode: 'convert' | 'write' | 'callback' | 'rollback') => root.render(
            <Model source={() => state.value} postValue={(value: number) => {
                if (mode === 'convert') throw error
                return value
            }}><Control onChange={() => {
                originals++
                if (mode === 'callback') throw error
                if (mode === 'rollback') state.value = 2
            }} /></Model>)
        await act(async () => render('convert'))
        assert.throws(() => change(2), e => e === error)
        assert.equal(state.value, 1)
        assert.equal(originals, 0)
        await act(async () => render('callback'))
        await act(async () => { assert.throws(() => change(2), e => e === error) })
        assert.equal(state.value, 2)
        assert.deepEqual(seen, [2])
        await act(async () => render('rollback'))
        await act(async () => change(3))
        assert.equal(state.value, 2)
        assert.deepEqual(seen, [2])
        await act(async () => render('write'))
        Object.defineProperty(state, 'value', { writable: false })
        assert.throws(() => change(4), /readonly/)
        assert.equal(originals, 2)
    })
    stop()
})

test('Model validates selectors and child shape, with readonly props and computed cache hits rejected', () => {
    const data = reactive({ name: 'A', get readonly() { return this.name } })
    const derived = computed(() => data.name)
    void derived.value
    for (const source of [() => 'A', () => ({ name: 'A' }).name, () => derived.value, () => data.readonly]) {
        assert.throws(() => serverRender(<Model source={source}><input /></Model>), /Model/)
    }
    const View = RC((props: { name: string }) => <Model source={() => props.name}><input /></Model>)
    assert.throws(() => serverRender(<View name="A" />), /readonly/)
    for (const children of [null, 'text', [<input key="1" />], <><input /></>, <input type="file" />]) {
        assert.throws(() => serverRender(<Model source={() => data.name}>{children as never}</Model>), /Model/)
    }
})

test('Model reconnects after StrictMode cleanup and ignores retained handlers after unmount', async () => {
    const state = reactive({ value: 'A' })
    let change!: (value: string) => void
    function Control(props: { value?: string; onChange?: typeof change }) { change = props.onChange!; return props.value }
    await mounted(async (root, container) => {
        await act(async () => root.render(<StrictMode><Model source={() => state.value}><Control /></Model></StrictMode>))
        await act(async () => change('B'))
        assert.equal(container.textContent, 'B')
        await act(async () => { state.value = 'C' })
        assert.equal(container.textContent, 'C')
    })
    change('D')
    assert.equal(state.value, 'C')
})

test('PureComponent state fields named key/ref remain part of shallow comparison', async () => {
    class View extends PureComponent<{}, { key: number; ref: number }> {
        override state = { key: 1, ref: 2 }
        override render() { return <span>{this.state.key}:{this.state.ref}</span> }
    }
    const Wrapped = RC(View)
    const ref = createRef<View>()
    await mounted(async (root, container) => {
        await act(async () => root.render(<Wrapped ref={ref} />))
        await act(async () => ref.current!.setState({ key: 3 }))
        assert.equal(container.textContent, '3:2')
        await act(async () => ref.current!.setState({ ref: 4 }))
        assert.equal(container.textContent, '3:4')
    })
})

test('Chip factories are inert, stable and independently update a/b without rendering their parent', async () => {
    for (const [factory, component] of [[chip, Chip], [strictChip, Chip.Strict], [asyncChip, AsyncChip], [asyncStrictChip, AsyncChip.Strict]] as const) {
        assert.equal(factory(() => assert.fail('factory called children')).type, component)
    }
    const state = reactive({ a: 1, b: 2 })
    const renders = { parent: 0, a: 0, b: 0 }
    const Parent = RC(() => {
        renders.parent++
        return <><Chip>{() => { renders.a++; return state.a }}</Chip>
            {chip(() => { renders.b++; return state.b })}</>
    })
    await mounted(async (root, container) => {
        await act(async () => root.render(<Parent />))
        assert.deepEqual(renders, { parent: 1, a: 1, b: 1 })
        await act(async () => { state.a++ })
        assert.deepEqual(renders, { parent: 1, a: 2, b: 1 })
        await act(async () => { state.b++ })
        assert.deepEqual(renders, { parent: 1, a: 2, b: 2 })
        assert.equal(container.textContent, '23')
        await act(async () => batch(() => { state.a++; state.a-- }))
        assert.deepEqual(renders, { parent: 1, a: 2, b: 2 })
    })
    state.a++
    assert.deepEqual(renders, { parent: 1, a: 2, b: 2 })
})

test('normal Chip adopts new closures once; Strict skips parent props, accepts context and resets by key', async () => {
    const state = reactive({ count: 1 })
    const Context = createContext('one')
    let normal = 0
    let strict = 0
    function ContextChild() { return <span>{useContext(Context)}</span> }
    await mounted(async (root, container) => {
        const render = (label: string, context: string, key = 'stable') => root.render(<Context.Provider value={context}>
            <Chip>{() => { normal++; return `${label}:${state.count}|` }}</Chip>
            <Chip.Strict key={key}>{() => { strict++; return <>{label}:{state.count}|<ContextChild /></> }}</Chip.Strict>
        </Context.Provider>)
        await act(async () => render('A', 'one'))
        await act(async () => render('B', 'two'))
        assert.equal(normal, 2)
        assert.equal(strict, 1)
        assert.equal(container.textContent, 'B:1|A:1|two')
        await act(async () => { state.count++ })
        assert.equal(container.textContent, 'B:2|A:2|two')
        await act(async () => render('C', 'two', 'new'))
        assert.equal(container.textContent, 'C:2|C:2|two')
    })
})

test('Strict Chip receives parent reactive props and computed updates across owner acknowledgments', async () => {
    let parentRenders = 0
    const Parent = RC((props: { count: number }) => {
        parentRenders++
        const local = useReactive({ double: computed(() => props.count * 2) })
        return <Chip.Strict>{() => `${props.count}:${local.double.value}`}</Chip.Strict>
    })
    await mounted(async (root, container) => {
        await act(async () => root.render(<Parent count={1} />))
        await act(async () => root.render(<Parent count={2} />))
        assert.equal(container.textContent, '2:4')
        assert.equal(parentRenders, 2)
    })
})

test('Chip branch subscriptions, nested children and StrictMode cleanup remain independent', async () => {
    const state = reactive({ left: true, a: 1, b: 2, c: 3 })
    let outer = 0
    let inner = 0
    function Child() { return state.c }
    const View = <StrictMode><Chip>{() => {
        outer++
        return <>{state.left ? state.a : state.b}<Chip>{() => { inner++; return state.c }}</Chip><Child /></>
    }}</Chip></StrictMode>
    await mounted(async (root, container) => {
        await act(async () => root.render(View))
        const before = outer
        await act(async () => { state.c = 4 })
        assert.equal(outer, before)
        assert.equal(container.textContent, '143')
        await act(async () => { state.left = false })
        const switched = outer
        await act(async () => { state.a++ })
        assert.equal(outer, switched)
        await act(async () => { state.b++ })
        assert.equal(container.textContent, '344')
    })
    const stopped = [outer, inner]
    state.b++; state.c++
    assert.deepEqual([outer, inner], stopped)
})

test('Async gates render fallback through SSR and layout, then activate with current values', async () => {
    for (const Fragment of [AsyncChip, AsyncChip.Strict]) {
        const state = reactive({ count: 1 })
        let calls = 0
        const render = () => { calls++; return <span>{state.count}</span> }
        const element = <Fragment fallback={<b>waiting</b>}>{render}</Fragment>
        const html = serverRender(element)
        assert.equal(html, '<b>waiting</b>')
        assert.equal(calls, 0)
        const container = document.createElement('div')
        container.innerHTML = html
        const errors: unknown[] = []
        let root!: Root
        function Layout() {
            useLayoutEffect(() => { assert.equal(calls, 0); state.count = 2 }, [])
            return element
        }
        await act(async () => { root = hydrateRoot(container, <Layout />, { onRecoverableError: error => errors.push(error) }) })
        assert.equal(container.textContent, '2')
        assert.deepEqual(errors, [])
        await act(async () => { state.count = 3 })
        assert.equal(container.textContent, '3')
        await act(async () => root.unmount())
        const stopped = calls
        state.count++
        assert.equal(calls, stopped)
    }
})

test('Async gates replay safely in StrictMode and never activate an uncommitted tree', async () => {
    for (const Fragment of [AsyncChip, AsyncChip.Strict]) {
        const state = reactive({ count: 1 })
        const never = new Promise<void>(() => {})
        let calls = 0
        function Suspend(): ReactNode { throw never }
        await mounted(async root => {
            await act(async () => root.render(<Suspense fallback="waiting">
                <Fragment>{() => { calls++; return state.count }}</Fragment><Suspend />
            </Suspense>))
            assert.equal(calls, 0)
        })
        state.count++
        assert.equal(calls, 0)
        await mounted(async (root, container) => {
            await act(async () => root.render(<StrictMode><Fragment>{() => { calls++; return state.count }}</Fragment></StrictMode>))
            assert.equal(container.textContent, '2')
            await act(async () => { state.count++ })
            assert.equal(container.textContent, '3')
        })
        const stopped = calls
        state.count++
        assert.equal(calls, stopped)
    }
})

test('Chip rejects non-synchronous callbacks and discarded renders never subscribe', async () => {
    assert.throws(() => serverRender(<Chip>{'invalid' as never}</Chip>), /synchronous/)
    assert.throws(() => serverRender(<Chip>{async () => null}</Chip>), /synchronous/)
    assert.throws(() => serverRender(<Chip>{() => Promise.resolve(null)}</Chip>), /synchronously/)
    const state = reactive({ count: 1 })
    const never = new Promise<void>(() => {})
    let calls = 0
    await mounted(async (root) => {
        await act(async () => root.render(<Suspense fallback="waiting"><Chip>{() => {
            calls++; void state.count; throw never
        }}</Chip></Suspense>))
        const before = calls
        await act(async () => { state.count++ })
        assert.equal(calls, before)
    })
})
