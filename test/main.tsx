import React, {Activity, StrictMode, useEffect, useState} from 'react'
import {createRoot} from 'react-dom/client'
import {RC, useReactive} from '../src/react'
import {Autoload, reactive} from '../src'

@reactive()
class TestState extends Autoload {
    async loadData() {
        await new Promise(resolve => setTimeout(resolve, 1000))
        return 'CC'
    }
}

const testState = new TestState()

const App = RC(() => {
    useEffect(() => {
        (async () => {
            // const res = await testState.load()
            // console.log(20, res)
        })()
    }, [])

    return (
        <>
            <h1>{testState.data}</h1>
            <h2>{testState.loading && 'loading...'}</h2>
        </>
    )
})

createRoot(document.getElementById('app')!).render(
    <>
        <App/>
    </>
)