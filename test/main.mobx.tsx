import React, {useDeferredValue} from 'react'
import {createRoot} from 'react-dom/client'
import {Autoload, loading, reactive} from '../src'
import {makeAutoObservable} from 'mobx'
import {observer} from './mobx-react-lite'

class TestStore {
    constructor() {
        makeAutoObservable(this)
    }

    async loadData() {
        console.log('loadData')
        await new Promise(resolve => setTimeout(resolve, 1000))
        return 'World'
    }

    showChild = false
    multiple = 1
}

const testStore = new TestStore()

const App = observer(function App() {
    console.log('app')
    const onClick = () => {
        testStore.showChild = true
        setTimeout(() => {
            testStore.multiple++
        }, 1)
    }

    const deferredShowChild = useDeferredValue(testStore.showChild)

    return (
        <>
            {/*<h1>Hello {testStore.data}</h1>*/}
            <button onClick={onClick}>button</button>
            {/*{testStore.loading &&*/}
            {/*    <h2>Loading...</h2>*/}
            {/*}*/}
            {deferredShowChild &&
                <Child/>
            }
        </>
    )
})

const Child = observer(function Child() {
    console.log('Child')
    return Array(10_000).fill(void 0).map((_, i) =>
        <div key={i}>{i * testStore.multiple}</div>
    )
})

createRoot(document.getElementById('app')!).render(<App/>)