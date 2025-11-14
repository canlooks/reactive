import React, {useTransition} from 'react'
import {createRoot} from 'react-dom/client'
import {AsyncChip, Chip, RC} from '../src/react'
import {reactive} from '../src'

@reactive
class AStore {
    static a?: number
    static b = 2
}

const App = RC(() => {
    const [loading, load] = useTransition()

    const onClick = async () => {
        load(() => {
            AStore.a = 1
            setTimeout(() => {
                AStore.b = 3
            }, 1)
        })
    }

    return (
        <>
            <h1>Hello World!</h1>
            <button onClick={onClick}>button</button>
            {!AStore.a
                ? <h1>Placeholder</h1>
                : <>
                    {loading
                        ? <h2>Loading...</h2>
                        : <Child/>
                    }
                </>
            }
        </>
    )
})

const Child = RC(() => {
    return (
        <>
            <h2>This is Child: {AStore.a} {AStore.b}</h2>
            <AsyncChip.Strict fallback="falling">{() =>
                Array(10_000).fill(void 0).map((_, i) =>
                    <span key={i}>{i * AStore.b}</span>
                )
            }</AsyncChip.Strict>
            {/*{Array(10_000).fill(void 0).map((_, i) =>*/}
            {/*    <span key={i}>{i * AStore.b}</span>*/}
            {/*)}*/}
        </>
    )
})

createRoot(document.getElementById('app')!).render(<App/>)