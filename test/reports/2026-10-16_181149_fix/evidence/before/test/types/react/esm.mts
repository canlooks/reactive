import { Component, type NamedExoticComponent } from 'react'
import { RC, RFC, RCC, ReactiveComponent, ReactiveFunctionComponent, ReactiveClassComponent, useReactive, useWatch, type WatchOptions } from '@canlooks/reactive/react'

const state = useReactive({ count: 1 })
const count: number = state.count
const View: NamedExoticComponent<{ count: number; optional?: string }> = RFC(props => {
    useWatch(() => props.count, (next, prev) => { const n: number = next + prev; void n })
    return null
})
const Again: typeof View = RC(RFC(View))
void [count, Again, ReactiveComponent, ReactiveFunctionComponent, ReactiveClassComponent]
// @ts-expect-error This hook returns an object, not a React tuple.
const [invalid] = useReactive({ count: 1 })
void invalid

@RCC
class ClassView extends Component<{ count: number }> {
    static marker = 42
    getCount(): number { return this.props.count }
    override render() { return null }
}
const Wrapped: typeof ClassView = RC(ClassView)
const instance: ClassView = new Wrapped({ count: 1 })
const marker: number = Wrapped.marker
void [instance.getCount(), marker]
// @ts-expect-error Required class props survive decoration.
new Wrapped({})

useWatch(() => 1, (next, previous) => { const n: number = next + previous; void n })
useWatch(() => 1, (_next, previous) => { const n: number = previous; void n }, { immediate: false })
useWatch(() => 1, (_next, previous) => {
    const n: number | undefined = previous
    // @ts-expect-error Immediate listeners have no first oldValue.
    const invalid: number = previous
    void [n, invalid]
}, { immediate: true })
const flag: boolean = Math.random() > 0.5
const config: WatchOptions = { immediate: flag }
const optionalConfig: WatchOptions | undefined = flag ? config : undefined
for (const options of [config, optionalConfig, { immediate: flag }]) {
    useWatch(() => ({ count: 1 }), (next, previous) => {
        const n: number | undefined = previous?.count
        // @ts-expect-error Optional settings may initialize immediately.
        const invalid: number = previous.count
        void [next.count, n, invalid]
    }, options)
}
useWatch(() => {}, (next, previous) => { const values: void[] = [next, previous]; void values })
// @ts-expect-error Invalid option type.
useWatch(() => 1, () => {}, { immediate: 1 })
// @ts-expect-error Callback must accept the source result.
useWatch(() => 1, (_next: string) => {})

// @ts-expect-error The local state hook is exported only as useReactive.
import { useState } from '@canlooks/reactive/react'
void useState
