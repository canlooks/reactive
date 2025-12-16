import React, {StrictMode, useDeferredValue, useEffect, useRef, useState} from 'react'
import {createRoot} from 'react-dom/client'
import {Autoload, loading, reactive} from '../src'
import {RC, useReactive, useReactor} from '../src/react'
import {useExternalClass} from '../src/react/hooks'

const App = RC(() => {
    const state = useReactive({
        id: 0
    })

    return (
        <h1 onClick={() => state.id++}>Test StrictMode: {state.id}</h1>
    )
})

createRoot(document.getElementById('app')!).render(
    <StrictMode>
        <App/>
    </StrictMode>
)