import { reactive } from '@canlooks/reactive'
import { AsyncChip, strictChip } from '@canlooks/reactive/react'

const data = reactive({ message: 'Hello' })

export function Delayed() {
    return <>
        {strictChip(() => data.message)}
        <AsyncChip fallback={<span>准备中…</span>}>{() => <div>{data.message}</div>}</AsyncChip>
        <AsyncChip.Strict fallback="准备中…">{() => data.message}</AsyncChip.Strict>
    </>
}

export const qa = {data,Delayed}
