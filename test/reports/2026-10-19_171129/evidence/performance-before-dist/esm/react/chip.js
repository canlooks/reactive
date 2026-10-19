import { createElement, memo, useEffect, useState } from 'react';
import { createObserverComponent } from './functionComponent.js';
function validateRender(render) {
    if (typeof render !== 'function' || render.constructor.name === 'AsyncFunction') {
        throw new TypeError('Chip children must be a synchronous render function');
    }
}
const FragmentObserver = createObserverComponent(function Chip({ children }) {
    validateRender(children);
    const result = children();
    if (result !== null && (typeof result === 'object' || typeof result === 'function')
        && 'then' in result && typeof result.then === 'function') {
        throw new TypeError('Chip children must return synchronously, not a Promise');
    }
    return result;
});
const Strict = memo(FragmentObserver, () => true);
Strict.displayName = 'Chip.Strict';
export const Chip = Object.defineProperty(FragmentObserver, 'Strict', { value: Strict });
function createGate(fragment) {
    return function AsyncGate({ children, fallback }) {
        const [ready, setReady] = useState(false);
        validateRender(children);
        useEffect(() => { setReady(true); }, []);
        return ready ? createElement(fragment, { children }) : fallback ?? null;
    };
}
const Gate = createGate(Chip);
Gate.displayName = 'AsyncChip';
const StrictGate = memo(createGate(Strict), () => true);
StrictGate.displayName = 'AsyncChip.Strict';
export const AsyncChip = Object.defineProperty(Gate, 'Strict', { value: StrictGate });
export function chip(render) { return createElement(Chip, { children: render }); }
export function strictChip(render) { return createElement(Chip.Strict, { children: render }); }
export function asyncChip(render) { return createElement(AsyncChip, { children: render }); }
export function asyncStrictChip(render) { return createElement(AsyncChip.Strict, { children: render }); }
