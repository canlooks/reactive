import React from 'react'
import {createRoot} from 'react-dom/client'
import {RC} from '../src/react'
import {Autoload, nextTick, reactive} from '../src'
import {Forage} from '../src/forage'

@reactive()
class TestState extends Forage {
    constructor() {
        super('test-forage', {
            count: 123
        })
    }

    // loadData() {
    //     return {
    //         count: 234
    //     }
    // }

    increase() {
        this.data = {
            count: this.data.count + 1
        }
    }
}

const testState = new TestState()

const App = RC(() => {
    return (
        <>
            <h1>{testState.data?.count}</h1>
            <h2>{testState.loading && 'loading...'}</h2>
            <button onClick={testState.increase}>button</button>
        </>
    )
})

createRoot(document.getElementById('app')!).render(
    <>
        <App/>
    </>
)