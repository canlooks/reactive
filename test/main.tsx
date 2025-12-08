import React, {useDeferredValue} from 'react'
import {createRoot} from 'react-dom/client'
import {Autoload, loading, reactive} from '../src'
import {RC, useReactive, useReactor} from '../src/react'

const App = RC(() => {
    const state = useReactive({
        formValues: {
            mappings: [] as {
                id: number
                name: string
            }[]
        }
    }, {deep: true})

    return (
        <>
            <h1>Hello</h1>
            <button
                onClick={() => state.formValues.mappings.push({
                    id: 1,
                    name: ''
                })}
            >
                button
            </button>
            {state.formValues.mappings.map(v =>
                <input key={v.id} value={v.name}/>
            )}
        </>
    )
})

createRoot(document.getElementById('app')!).render(<App/>)