import { useEffect, useLayoutEffect, useState } from 'react'
import { runInBatch, untracked } from '../effect.js'
import { currentRender } from './observer.js'

export function useCommitEffect(...args: Parameters<typeof useLayoutEffect>): void {
    const hook = typeof window === 'undefined' ? useEffect : useLayoutEffect
    hook(...args)
}

export interface CommitRegistration {
    apply(): void
    publish(): void
    stop(): void
}

export interface CommittedRef<T> {
    current?: T
    active: boolean
}

/** Register a candidate without exposing it to events until this render commits. */
export function useCommittedRef<T>(value: T, publish?: () => void): CommittedRef<T> {
    const [slot] = useState<CommittedRef<T>>(() => ({ active: false }))
    const render = currentRender()
    const registration: CommitRegistration = {
        apply() { slot.current = value; slot.active = true },
        publish() { if (publish) untracked(publish) },
        stop() { slot.active = false },
    }
    render?.commits.push(registration)
    useCommitEffect(() => registration.stop, [slot])
    useCommitEffect(() => {
        if (!render) {
            registration.apply()
            try { runInBatch(registration.publish) } catch (error) {
                registration.stop()
                throw error
            }
        }
    })
    return slot
}
