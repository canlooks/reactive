import { reactive } from '@canlooks/reactive'
import { RC, useReactive, useWatch } from '@canlooks/reactive/react'

const store = reactive({ message: 'Hello' })

const Counter = RC((props: { count: number }) => {
    const local = useReactive({ clicks: 0 })
    useWatch(() => props.count, (next, previous) => {
        console.log(previous, next, props.count)
    })
    return <button onClick={() => local.clicks++}>
        {store.message}: {props.count} / {local.clicks}
    </button>
})

export const qa = {store,Counter}
