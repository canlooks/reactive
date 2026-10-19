import { RC, Chip, useReactive } from '@canlooks/reactive/react'

export const Index = RC(() => {
    const data = useReactive({ a: 1, b: 2 })
    return <div>
        <Chip>{() => <button onClick={() => data.a++}>A: {data.a}</button>}</Chip>
        <Chip>{() => <button onClick={() => data.b++}>B: {data.b}</button>}</Chip>
    </div>
})

export const qa = {Index}
