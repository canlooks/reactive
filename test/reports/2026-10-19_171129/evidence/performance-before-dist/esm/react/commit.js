import { useEffect, useLayoutEffect, useState } from 'react';
import { runInBatch, untracked } from '../effect.js';
import { currentRender } from './observer.js';
export function useCommitEffect(...args) {
    const hook = typeof window === 'undefined' ? useEffect : useLayoutEffect;
    hook(...args);
}
/** Register a candidate without exposing it to events until this render commits. */
export function useCommittedRef(value, publish) {
    const [slot] = useState(() => ({ active: false }));
    const render = currentRender();
    const registration = {
        apply() { slot.current = value; slot.active = true; },
        publish() { if (publish)
            untracked(publish); },
        stop() { slot.active = false; },
    };
    render?.commits.push(registration);
    useCommitEffect(() => registration.stop, [slot]);
    useCommitEffect(() => {
        if (!render) {
            registration.apply();
            try {
                runInBatch(registration.publish);
            }
            catch (error) {
                registration.stop();
                throw error;
            }
        }
    });
    return slot;
}
