import { useState } from 'react'
import { batch } from '../batch.js'
import { untracked } from '../effect.js'
import { reactive } from '../reactive.js'
import { useCommittedRef } from './commit.js'

export interface UseLoadingReturn<A extends unknown[], R, L extends boolean | number> {
    readonly load: (...args: A) => Promise<Awaited<R>>
    readonly loading: L
    readonly stacksCount: number
}

export function useLoading<A extends unknown[], R>(fn: (...args: A) => R, initialLoading?: boolean): UseLoadingReturn<A, R, boolean>
export function useLoading<A extends unknown[], R>(fn: (...args: A) => R, initialLoading: number): UseLoadingReturn<A, R, number>
export function useLoading<A extends unknown[], R>(fn: (...args: A) => R, initialLoading: boolean | number | undefined): UseLoadingReturn<A, R, boolean | number>
export function useLoading<A extends unknown[], R>(
    fn: (...args: A) => R, initialLoading: boolean | number = false,
): UseLoadingReturn<A, R, boolean | number> {
    if (typeof fn !== 'function') throw new TypeError('useLoading expects a function')
    const [controller] = useState(() => {
        if (typeof initialLoading !== 'boolean' && (typeof initialLoading !== 'number'
            || !Number.isSafeInteger(initialLoading) || initialLoading < 0)) {
            throw new TypeError('initialLoading must be a boolean or a nonnegative safe integer')
        }
        const state = reactive({ loading: initialLoading, stacksCount: 0 })
        const tokens = new Set<object>()
        return {
            state, tokens, started: false,
            publish() {
                untracked(() => batch(() => {
                    state.stacksCount = tokens.size
                    state.loading = typeof initialLoading === 'number' ? initialLoading + tokens.size
                        : this.started ? tokens.size > 0 : initialLoading
                }))
            },
        }
    })
    const committed = useCommittedRef(fn, () => controller.publish())
    return useState(() => {
        const load = async (...args: A): Promise<Awaited<R>> => {
            if (!committed.active) throw new Error('Cannot call load before commit or after unmount')
            const call = committed.current!
            const token = {}
            controller.tokens.add(token)
            controller.started = true
            const errors: unknown[] = []
            let result!: Awaited<R>
            try { controller.publish() } catch (error) { errors.push(error) }
            try { result = await untracked(() => call(...args)) } catch (error) { errors.push(error) } finally {
                controller.tokens.delete(token)
                if (committed.active) {
                    try { controller.publish() } catch (error) { errors.push(error) }
                }
            }
            if (errors.length === 1) throw errors[0]
            if (errors.length > 1) throw new AggregateError(errors, 'Multiple errors in reactive load')
            return result
        }
        return Object.freeze({
            load,
            get loading() { return controller.state.loading },
            get stacksCount() { return controller.state.stacksCount },
        })
    })[0]
}
