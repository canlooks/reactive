import {Fn} from '../..'
import {useReactive} from './api'
import {useSync, useUnmounted} from './hooks'
import {DEBUG_NAME} from '../utils'

export function useLoading<F extends Fn, L extends boolean | number>(fn: F, initialLoading?: L): {
    load: F
    loading: L
    stacksCount: number
} {
    const isUnmounted = useUnmounted()

    const syncFn = useSync(fn)

    return useReactive({
        [DEBUG_NAME]: fn.name,
        stacksCount: 0,
        loading: initialLoading ?? false,
        async load(...args: any[]) {
            const setLoading = (dir: -1 | 1) => {
                if (isUnmounted.current) {
                    return
                }
                if (typeof this.loading === 'number') {
                    this.loading += dir
                    return
                }
                if (dir > 0) {
                    this.stacksCount++
                    this.loading = true
                } else if (!--this.stacksCount) {
                    this.loading = false
                }
            }
            try {
                setLoading(1)
                return await syncFn.current.apply(this, args)
            } finally {
                setLoading(-1)
            }
        }
    } as any as {
        load: F
        loading: L
        stacksCount: number
    })
}