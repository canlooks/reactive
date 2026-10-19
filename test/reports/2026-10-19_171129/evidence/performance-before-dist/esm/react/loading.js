import { useState } from 'react';
import { batch } from '../batch.js';
import { untracked } from '../effect.js';
import { reactive } from '../reactive.js';
import { useCommittedRef } from './commit.js';
export function useLoading(fn, initialLoading = false) {
    if (typeof fn !== 'function')
        throw new TypeError('useLoading expects a function');
    const [controller] = useState(() => {
        if (typeof initialLoading !== 'boolean' && (typeof initialLoading !== 'number'
            || !Number.isSafeInteger(initialLoading) || initialLoading < 0)) {
            throw new TypeError('initialLoading must be a boolean or a nonnegative safe integer');
        }
        const state = reactive({ loading: initialLoading, stacksCount: 0 });
        const tokens = new Set();
        return {
            state, tokens, started: false,
            publish() {
                untracked(() => batch(() => {
                    state.stacksCount = tokens.size;
                    state.loading = typeof initialLoading === 'number' ? initialLoading + tokens.size
                        : this.started ? tokens.size > 0 : initialLoading;
                }));
            },
        };
    });
    const committed = useCommittedRef(fn, () => controller.publish());
    return useState(() => {
        const load = async (...args) => {
            if (!committed.active)
                throw new Error('Cannot call load before commit or after unmount');
            const call = committed.current;
            const token = {};
            controller.tokens.add(token);
            controller.started = true;
            const errors = [];
            let result;
            try {
                controller.publish();
            }
            catch (error) {
                errors.push(error);
            }
            try {
                result = await untracked(() => call(...args));
            }
            catch (error) {
                errors.push(error);
            }
            finally {
                controller.tokens.delete(token);
                if (committed.active) {
                    try {
                        controller.publish();
                    }
                    catch (error) {
                        errors.push(error);
                    }
                }
            }
            if (errors.length === 1)
                throw errors[0];
            if (errors.length > 1)
                throw new AggregateError(errors, 'Multiple errors in reactive load');
            return result;
        };
        return Object.freeze({
            load,
            get loading() { return controller.state.loading; },
            get stacksCount() { return controller.state.stacksCount; },
        });
    })[0];
}
