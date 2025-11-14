import React, {useTransition, useDeferredValue} from 'react'
import {createRoot} from 'react-dom/client'
import {makeAutoObservable, observable} from 'mobx'
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
    const onClick1 = () => {
        aStore.a = 1
        setTimeout(() => {
            aStore.b++
        }, 1)
    }

    const deferredA = useDeferredValue(aStore.a)

    return (
        <>
            <h1>Hello World!</h1>
            <button onClick={onClick1}>button</button>
            {!aStore.a
                ? <h1>Placeholder</h1>
                : aStore.a && !deferredA
                    ? <h1>Loading...</h1>
                    : <Child/>
            }
        </>
    )
})

const Child = observer(() => {
    return (
        <>
            <h2>This is Child: {aStore.a} {aStore.b}</h2>
            {/*<AsyncChip.Strict fallback="falling">{() =>*/}
            {/*    Array(10_000).fill(void 0).map((_, i) =>*/}
            {/*        <span key={i}>{i * aStore.b}</span>*/}
            {/*    )*/}
            {/*}</AsyncChip.Strict>*/}
            {Array(10_000).fill(void 0).map((_, i) =>
                <span key={i}>{i * aStore.b}</span>
            )}
        </>
    )
})

createRoot(document.getElementById('app')!).render(<App/>)