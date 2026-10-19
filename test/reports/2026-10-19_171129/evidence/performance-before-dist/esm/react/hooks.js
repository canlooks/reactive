import { useState as useReactState } from 'react';
import { reactive } from '../reactive.js';
import { createWatch } from '../watch.js';
import { useCommitEffect } from './commit.js';
import { currentRender } from './observer.js';
export function useReactive(initialState) {
    return useReactState(() => reactive(initialState))[0];
}
export function useWatch(source, callback, options) {
    const [slot] = useReactState(() => ({ handle: undefined }));
    const render = currentRender();
    const nextCallback = callback;
    let prepared;
    let revision;
    const registration = {
        prepare() {
            prepared = slot.handle;
            revision = prepared?.revision;
            prepared?.update(source, nextCallback);
        },
        initialize() {
            if (slot.handle)
                return;
            const handle = createWatch(source, nextCallback, options);
            slot.handle = handle;
            try {
                handle.initialize();
            }
            catch (error) {
                handle.stop();
                if (slot.handle === handle)
                    slot.handle = undefined;
                throw error;
            }
        },
        finish() {
            if (prepared && slot.handle === prepared && prepared.revision === revision)
                prepared.refresh();
        },
        stop() {
            slot.handle?.stop();
            slot.handle = undefined;
        },
    };
    render?.watches.push(registration);
    useCommitEffect(() => registration.stop, [slot]);
    useCommitEffect(() => {
        if (!render) {
            registration.prepare();
            registration.initialize();
            registration.finish();
        }
    });
}
