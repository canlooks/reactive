import React, {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {RC, useReactive} from '../src/react'

const App = RC(() => {
    const state = useReactive({
        id: 0,
        get double() {
            return this.id * 2
        }
    })

    return (
        <h1 onClick={() => {
            state.id++
            console.log(state.id)
        }}>Test StrictMode: {state.double}</h1>
    )
})

createRoot(document.getElementById('app')!).render(
    <StrictMode>
        <App/>
    </StrictMode>
)