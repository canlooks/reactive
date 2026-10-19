import { useState as useReactState } from 'react'
import { reactive } from '../reactive.js'
import { createWatch, type WatchHandle, type WatchOptions } from '../watch.js'
import { useCommitEffect } from './commit.js'
import { currentRender, type CommitWatch } from './observer.js'

export function useReactive<T extends object>(initialState: T): T {
    return useReactState(() => reactive(initialState))[0]
}

export function useWatch<T>(source: () => T, callback: (newValue: T, oldValue: T) => void, options?: WatchOptions & { immediate?: false }): void
export function useWatch<T>(source: () => T, callback: (newValue: T, oldValue: T | undefined) => void, options?: WatchOptions): void
export function useWatch<T>(source: () => T, callback: (newValue: T, oldValue: T) => void, options?: WatchOptions): void {
    const [slot] = useReactState(() => ({ handle: undefined as WatchHandle<T> | undefined }))
    const render = currentRender()
    const nextCallback = callback as (next: T, previous: T | undefined) => void
    let prepared: WatchHandle<T> | undefined
    let revision: number | undefined
    const registration: CommitWatch = {
        prepare() {
            prepared = slot.handle
            revision = prepared?.revision
            prepared?.update(source, nextCallback)
        },
        initialize() {
            if (slot.handle) return
            const handle = createWatch(source, nextCallback, options)
            slot.handle = handle
            try { handle.initialize() } catch (error) {
                handle.stop()
                if (slot.handle === handle) slot.handle = undefined
                throw error
            }
        },
        finish() {
            if (prepared && slot.handle === prepared && prepared.revision === revision) prepared.refresh()
        },
        stop() {
            slot.handle?.stop()
            slot.handle = undefined
        },
    }
    render?.watches.push(registration)
    useCommitEffect(() => registration.stop, [slot])
    useCommitEffect(() => {
        if (!render) {
            registration.prepare()
            registration.initialize()
            registration.finish()
        }
    })
}
