import {useState} from 'react'
import {defineAutoload, Autoload} from '../extensions'
import {ReactiveOptions} from '../..'

export function useAutoload<D = any>(loadData: (...args: any[]) => D | Promise<D>, options?: ReactiveOptions): Autoload<D> {
    return useState(() => {
        return defineAutoload(loadData, options)
    })[0]
}