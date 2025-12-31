import React, {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {RC, useReactive} from '../src/react'
import {Autoload, reactive} from '../src'

@reactive
class TestAutoload extends Autoload {
    loadData(arg: number) {
        return 'hello world'
    }

    testing() {
        throw 'This is a test'
    }
}

const test = new TestAutoload()

const App = RC(() => {
    return (
        <>
            <button onClick={() => test.update('123')}>button</button>
        </>
    )
})

createRoot(document.getElementById('app')!).render(
    <StrictMode>
        <App/>
    </StrictMode>
)