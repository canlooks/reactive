import React, {useDeferredValue} from 'react'
import {createRoot} from 'react-dom/client'
import {Autoload, loading, reactive} from '../src'
import {RC, useReactive, useReactor} from '../src/react'

@reactive
class TestStore extends Autoload {
    loadData() {
        return new Promise(resolve => setTimeout(() => resolve(123), 1000))
    }

    get double() {
        return this.data && this.data * 2
    }

    showChild = false
    multiple = 1
}

const testStore = new TestStore()

const App = RC(function App() {
    const state = useReactive({
        get many() {
            return testStore.double && testStore.double * 3
        }
    })

    console.log('app')
    const onClick = () => {
        testStore.showChild = true
        setTimeout(() => {
            testStore.multiple++
        }, 1)
    }

    const deferredShowChild = useDeferredValue(testStore.showChild)

    useReactor(() => state.many, () => {
        console.log(state.many)
    })

    return (
        <>
            <h1>Hello {testStore.data} {state.many}</h1>
            <button onClick={onClick}>button</button>
            {testStore.loading &&
                <h2>Loading...</h2>
            }
            {deferredShowChild &&
                <Child/>
            }
        </>
    )
})

const Child = RC(function Child() {
    console.log('Child')
    return Array(10_000).fill(void 0).map((_, i) =>
        <div key={i}>{i * testStore.multiple}</div>
    )
})

createRoot(document.getElementById('app')!).render(<App/>)