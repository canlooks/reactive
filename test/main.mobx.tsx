import React, {useDeferredValue, useTransition} from 'react'
import {createRoot} from 'react-dom/client'
import {RC} from '../src/react'
import {reactive} from '../src'
import {makeAutoObservable, action} from 'mobx'
import {observer} from 'mobx-react'

class AStore {
    a?: number
    b = 2

    constructor() {
        makeAutoObservable(this)
    }
}

const aStore = new AStore()

const App = observer(() => {
    const [loading, load] = useTransition()

    const setA = action(() => {
        aStore.a = 1
    })

    const setB = action(() => {
        aStore.b = 3
    })

    const onClick = async () => {
        load(() => {
            setA()
            // setTimeout(() => {
                setB()
            // }, 1)
        })
    }

    return (
        <>
            <h1>Hello World!</h1>
            <button onClick={onClick}>button</button>
            {!aStore.a
                ? <h1>Placeholder</h1>
                : loading
                    ? <h2>Loading...</h2>
                    : <Child/>
            }
        </>
    )
})

const Child = RC(() => {
    return (
        <>
            <h2>This is Child: {aStore.a} {aStore.b}</h2>
            {/*<Chip.Strict>{() =>*/}
            {/*    Array(10_000).fill(void 0).map((_, i) =>*/}
            {/*        <span key={i}>{i * AStore.n}</span>*/}
            {/*    )*/}
            {/*}</Chip.Strict>*/}
            {Array(10_000).fill(void 0).map((_, i) =>
                <span key={i}>{i * aStore.b}</span>
            )}
        </>
    )
})

createRoot(document.getElementById('app')!).render(<App/>)