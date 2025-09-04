import React, {ComponentProps, useCallback} from 'react'
import {createRoot} from 'react-dom/client'
import {defineModel, RC, useReactive} from '../src/react'
import {Model} from '../react'

const WrapInput = (props: ComponentProps<'input'>) => <input {...props}/>

const InputModel = defineModel(WrapInput)

const App = RC(() => {
    const state = useReactive({
        data: 'hello'
    })

    return (
        <>
            <h1>{state.data}</h1>
            <Model refer={() => state.data}>
                <WrapInput type="number"/>
            </Model>
            <InputModel refer={useCallback(() => state.data, [])} placeholder="test"/>
        </>
    )
})

createRoot(document.getElementById('app')!).render(<App/>)