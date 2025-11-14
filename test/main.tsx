import React, {useTransition, startTransition, useState, useMemo, useEffect, FC, memo, useRef, useLayoutEffect, useDeferredValue} from 'react'
import {createRoot} from 'react-dom/client'
import {AsyncChip, Chip, RC} from '../src/react'
import {Effect, reactive} from '../src'
import {logPrefix} from '../src/utils/logHandler'

@reactive
class AStore {
    static a?: number
    static b = 2
    static c = 123
}

const App = RC(() => {
    const onClick1 = async () => {
        AStore.a = 1
        // setTimeout(() => {
        //     AStore.b++
        // }, 1)
    }

    const deferredA = useDeferredValue(AStore.a)

    const onClick2 = () => {
        AStore.c++
    }

    return (
        <>
            <h1>Hello World!</h1>
            <button onClick={onClick1}>button1</button>
            <button onClick={onClick2}>button2</button>
            {!AStore.a
                ? <h1>Placeholder</h1>
                    : AStore.a && !deferredA
                        ? <h1>Loading...</h1>
                        : <Child c={AStore.c}/>
            }
        </>
    )
})

const Child = RC((props: {
    c: number
}) => {
    return (
        <>
            <h2>This is Child: {AStore.a} {AStore.b}</h2>
            {/*<AsyncChip.Strict fallback="falling">{() =>*/}
            {/*    Array(10_000).fill(void 0).map((_, i) =>*/}
            {/*        <span key={i}>{i * AStore.b}</span>*/}
            {/*    )*/}
            {/*}</AsyncChip.Strict>*/}
            {Array(10_000).fill(void 0).map((_, i) =>
                <span key={i}>{i * AStore.b}</span>
            )}
            <Chip>{() =>
                <h3>{props.c}</h3>
            }</Chip>
        </>
    )
})

createRoot(document.getElementById('app')!).render(<App/>)