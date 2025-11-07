import React, {ComponentProps, useCallback} from 'react'
import {createRoot} from 'react-dom/client'
import {defineModel, RC, useReactive} from '../src/react'
import {Model} from '../react'
import {Autoload, reactive} from '../src'

const WrapInput = (props: ComponentProps<'input'>) => <input {...props}/>

const InputModel = defineModel(WrapInput)

@reactive
class TestStore extends Autoload {
    async loadData() {
        await new Promise(resolve => setTimeout(resolve, 1000))
        return 'ok'
    }

    onLoad() {
        console.log('onLoad', this.data)
    }
}

const t = new TestStore()

const App = RC(() => {
    const state = useReactive({
        data: 'hello'
    })

    return (
        <>
            <h1>{state.data}</h1>
            <h2>{t.data}</h2>
            <Model refer={() => state.data}>
                <WrapInput type="number"/>
            </Model>
            <InputModel refer={useCallback(() => state.data, [])} placeholder="test"/>
        </>
    )
})

createRoot(document.getElementById('app')!).render(<App/>)