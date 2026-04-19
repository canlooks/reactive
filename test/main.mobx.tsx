import {createRoot} from 'react-dom/client'
import {observer, useLocalObservable} from 'mobx-react'
import React, {Activity, StrictMode} from 'react'

const App = observer(() => {
    const state = useLocalObservable(() => ({
        visible: true
    }))

    return (
        <>
            <button onClick={() => state.visible = !state.visible}>Toggle visible</button>
            <Activity mode={state.visible ? 'visible' : 'hidden'}>
                <Child/>
            </Activity>
        </>
    )
})

const Child = observer(() => {
    const state = useLocalObservable(() => ({
        count: 123
    }))

    return (
        <>
            <h1>{state.count}</h1>
            <button onClick={() => state.count++}>button</button>
        </>
    )
})

createRoot(document.getElementById('app')!).render(
    <StrictMode>
        <App/>
    </StrictMode>
)