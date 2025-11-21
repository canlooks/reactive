import {useState} from 'react'
import {defineAutoload} from '../extensions'
import {ReactiveOptions} from '../..'

export function useAutoload<D = any>(loadData: (...args: any[]) => D | Promise<D>, options?: ReactiveOptions) {
    return useState(() => {
        return defineAutoload(loadData, options)
    })[0]
}