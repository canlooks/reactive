import { RC, RFC, useWatch } from '@canlooks/reactive/react'

const Counter = RC((props: { count: number; label?: string }) => {
    useWatch(() => props.count, (next, previous) => {
        const value: number = next + previous
        void value
    })
    return <div>{props.label}:{props.count}</div>
})
const Again = RFC(Counter)
const valid = <><Counter count={1} /><Again count={2} label="count" /></>
// @ts-expect-error Required props must remain required through memo.
const missing = <Counter />
// @ts-expect-error Props must not become any after wrapping again.
const wrong = <Again count="wrong" />
void [valid, missing, wrong]
