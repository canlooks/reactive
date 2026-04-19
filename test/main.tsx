import React, {Activity, StrictMode, useState} from 'react'
import {createRoot} from 'react-dom/client'
import {RC, useReactive} from '../src/react'
import {Autoload, reactive} from '../src'

@reactive()
class TestState {
    count = 123
}

const testState = new TestState()

const App = () => {
    const [visible, setVisible] = useState(true)

    return (
        <>
            <button onClick={() => setVisible(o => !o)}>Toggle visible</button>
            <button onClick={() => testState.count++}>Increase</button>

            <Activity mode={visible ? 'visible' : 'hidden'}>
                <Child/>
            </Activity>
            {/*{visible && <Child/>}*/}
        </>
    )
}

const Child = RC(() => {
    console.log(30, testState.count)
    return (
        <>
            <h1>{testState.count}</h1>
            {/*{Array(10000).fill(void 0).map((_, i) => (*/}
            {/*    <h1 key={i}>{testState.count}</h1>*/}
            {/*))}*/}
        </>
    )
})

createRoot(document.getElementById('app')!).render(
    <StrictMode>
        <App/>
    </StrictMode>
)