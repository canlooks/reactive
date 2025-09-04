import {useMemo} from 'react'
import {defineAutoload, Autoload} from '../extensions'
import {ReactiveOptions} from '../..'

export function useAutoload<D = any>(loadData: (...args: any[]) => D | Promise<D>, options?: ReactiveOptions): Autoload<D> {
    return useMemo(() => {
        return defineAutoload(loadData, options)
    }, [])
}