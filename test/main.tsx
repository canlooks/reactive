import React, {Activity, StrictMode, useEffect, useState} from 'react'
import {createRoot} from 'react-dom/client'
import {RC, useReactive} from '../src/react'
import {Autoload, reactive} from '../src'
import {Forage} from '../src/forage'

@reactive()
class TestState extends Forage {
    constructor() {
        super('test-forage', {
            msg: 'CC'
        })
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
    console.log(24)
    console.log(24, testState.loading)
    return (
        <>
            <h1>{testState.data?.msg}</h1>
            <h2>{testState.loading && 'loading...'}</h2>
            <button onClick={() => testState.data = {
                msg: 'OK'
            }}>button</button>
        </>
    )
})

createRoot(document.getElementById('app')!).render(
    <>
        <App/>
    </>
)