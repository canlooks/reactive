import {defineAutoload} from '../extensions'
import {ReactiveOptions} from '../..'
import {useSettledValue} from './hooks'

export function useAutoload<D = any>(loadData: (...args: any[]) => D | Promise<D>, options?: ReactiveOptions) {
    return useSettledValue(() => {
        return defineAutoload(loadData, options)
    })
}