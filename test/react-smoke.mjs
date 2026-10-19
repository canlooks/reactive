import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import * as React from 'react'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
const { createRoot } = await import('react-dom/client')

export default async function verifyReact(api, reactApi, decoratorApi = reactApi) {
    assert.deepEqual(Object.keys(reactApi).sort(), [
        'RC', 'RCC', 'RFC', 'ReactiveClassComponent', 'ReactiveComponent', 'ReactiveFunctionComponent', 'useWatch',
        'useReactive', 'Chip', 'AsyncChip', 'chip', 'strictChip', 'asyncChip', 'asyncStrictChip', 'useModel', 'Model', 'defineModel', 'useLoading', 'loading',
    ].sort())
    assert.equal(reactApi.RC, reactApi.ReactiveComponent)
    assert.equal(reactApi.RFC, reactApi.ReactiveFunctionComponent)
    assert.equal(reactApi.RCC, reactApi.ReactiveClassComponent)
    for (const [factory, Component] of [[reactApi.chip, reactApi.Chip], [reactApi.strictChip, reactApi.Chip.Strict],
        [reactApi.asyncChip, reactApi.AsyncChip], [reactApi.asyncStrictChip, reactApi.AsyncChip.Strict]]) {
        assert.equal(factory(() => assert.fail('factory must not render')).type, Component)
    }
    const raw = { count: 1 }
    const state = api.reactive(raw)
    const double = api.computed(() => state.count * 2)
    const changes = []
    const propsChanges = []
    let renders = 0
    const View = reactApi.RC(props => {
        renders++
        assert.equal(reactApi.useReactive(raw), state)
        reactApi.useWatch(() => double.value, (next, prev) => changes.push([next, prev]))
        reactApi.useWatch(() => props.count, (next, prev) => propsChanges.push([next, prev]))
        return React.createElement('div', null, `${props.count}:${double.value}`)
    })
    assert.equal(reactApi.RFC(View), View)
    assert.equal(reactApi.RC(View), View)
    const container = document.createElement('div')
    const root = createRoot(container)
    try {
        await React.act(async () => root.render(React.createElement(View, { count: 1 })))
        await React.act(() => root.render(React.createElement(View, { count: 1 })))
        assert.equal(renders, 1)
        await React.act(() => root.render(React.createElement(View, { count: 2 })))
        assert.equal(renders, 2)
        assert.deepEqual(propsChanges, [[2, 1]])
        await React.act(() => api.batch(() => { state.count = 2; state.count = 3 }))
        assert.equal(container.textContent, '2:6')
        assert.deepEqual(changes, [[6, 2]])
        const data = api.reactive({ name: 'A', other: 1, double })
        let parents = 0
        let fragments = 0
        let change
        let loading
        const complete = []
        function Control(props) { change = props.onChange; return React.createElement('input', { value: props.value, onChange: props.onChange }) }
        const ModelControl = reactApi.defineModel(Control, (value, suffix) => value + suffix)
        function Features() {
            parents++
            assert.equal(reactApi.useReactive(raw), state)
            assert.equal(reactApi.useReactive({ double }).double, double)
            loading = reactApi.useLoading(() => new Promise(resolve => complete.push(resolve)), 2)
            return React.createElement(React.Fragment, null,
                reactApi.chip(() => { fragments++; return `${data.other}|${data.double.value}|` }),
                React.createElement(ModelControl, { refer: () => data.name }),
                reactApi.strictChip(() => `${loading.loading}:${loading.stacksCount}`))
        }
        await React.act(async () => root.render(React.createElement(Features)))
        await React.act(async () => { data.other++ })
        assert.equal(parents, 1)
        assert.equal(fragments, 2)
        await React.act(async () => change('B', '!'))
        assert.equal(data.name, 'B!')
        await React.act(async () => { data.name = 'C' })
        assert.equal(container.querySelector('input').value, 'C')
        let first, second
        await React.act(async () => { first = loading.load(); second = loading.load() })
        assert.equal(loading.loading, 4)
        assert.equal(loading.stacksCount, 2)
        await React.act(async () => { complete[1](2); assert.equal(await second, 2) })
        assert.equal(loading.loading, 3)
        await React.act(async () => { complete[0](1); assert.equal(await first, 1) })
        assert.equal(loading.loading, 2)
        assert.equal(loading.stacksCount, 0)
        assert.equal(container.textContent, '2|6|2:0')

        class ClassView extends React.Component {
            count = 0
            busy = false
            stack = 2
            async run(promise, suffix) {
                assert.equal(this.busy, true)
                return await promise + suffix
            }
            async concurrent(promise) { return promise }
            render() { return React.createElement('span', null, `${this.count}:${this.busy}:${this.stack}`) }
        }
        for (const [method, source] of [['run', ctx => ctx.busy], ['concurrent', ctx => ctx.stack]]) {
            const descriptor = Object.getOwnPropertyDescriptor(ClassView.prototype, method)
            decoratorApi.loading(source)(ClassView.prototype, method, descriptor)
            Object.defineProperty(ClassView.prototype, method, descriptor)
        }
        const Class = reactApi.RC(ClassView)
        const ref = React.createRef()
        await React.act(async () => root.render(React.createElement(Class, { ref })))
        const instance = ref.current
        await React.act(async () => { instance.count++ })
        assert.equal(container.textContent, '1:false:2')
        let resolve, reject, a, b, numeric
        const one = new Promise(done => { resolve = done })
        const two = new Promise((_done, fail) => { reject = fail })
        await React.act(async () => { a = instance.run(one, '!'); b = instance.run(two, '?'); numeric = instance.concurrent(one) })
        assert.equal(container.textContent, '1:true:3')
        const error = new Error('smoke failure')
        const rejected = assert.rejects(b, e => e === error)
        await React.act(async () => { reject(error); await rejected })
        assert.equal(container.textContent, '1:true:3')
        await React.act(async () => { resolve('done'); assert.equal(await a, 'done!'); assert.equal(await numeric, 'done') })
        assert.equal(container.textContent, '1:false:2')
        let finish, retained
        await React.act(async () => { retained = instance.run(new Promise(done => { finish = done }), '') })
        await React.act(async () => root.render(null))
        await assert.rejects(instance.run(Promise.resolve('late'), ''), /unmount/)
        finish('settled')
        assert.equal(await retained, 'settled')
        assert.equal(instance.busy, true)
    } finally { await React.act(() => root.unmount()) }
    state.count++
    assert.deepEqual(changes, [[6, 2]])
}
