import type { ChangeEvent } from 'react'
import { Model, useReactive } from '@canlooks/reactive/react'

export function Quantity() {
    const data = useReactive({ quantity: 1, checked: undefined as boolean | undefined })
    return <>
        <Model source={() => data.quantity}
            postValue={(event: ChangeEvent<HTMLInputElement>) => Number(event.currentTarget.value)}>
            <input type="number" />
        </Model>
        <Model source={() => data.checked} valueProp="checked"><input type="checkbox" /></Model>
    </>
}

export const qa = {Quantity}
