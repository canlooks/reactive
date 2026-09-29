import { createElement, memo, useEffect, useState, type FunctionComponent, type NamedExoticComponent, type ReactElement, type ReactNode } from 'react'
import { createObserverComponent } from './functionComponent.js'

export interface ChipProps { children: () => ReactNode }
export interface AsyncChipProps extends ChipProps { fallback?: ReactNode }

function validateRender(render: () => ReactNode): void {
    if (typeof render !== 'function' || render.constructor.name === 'AsyncFunction') {
        throw new TypeError('Chip children must be a synchronous render function')
    }
}

const FragmentObserver = createObserverComponent<ChipProps>(function Chip({ children }) {
    validateRender(children)
    const result = children()
    if (result !== null && (typeof result === 'object' || typeof result === 'function')
        && 'then' in result && typeof result.then === 'function') {
        throw new TypeError('Chip children must return synchronously, not a Promise')
    }
    return result
})
const Strict = memo(FragmentObserver, () => true)
Strict.displayName = 'Chip.Strict'
export const Chip = Object.defineProperty(FragmentObserver, 'Strict', { value: Strict }) as
    FunctionComponent<ChipProps> & { readonly Strict: NamedExoticComponent<ChipProps> }

function createGate(fragment: FunctionComponent<ChipProps>): FunctionComponent<AsyncChipProps> {
    return function AsyncGate({ children, fallback }: AsyncChipProps) {
        const [ready, setReady] = useState(false)
        validateRender(children)
        useEffect(() => { setReady(true) }, [])
        return ready ? createElement(fragment, { children }) : fallback ?? null
    }
}

const Gate = createGate(Chip)
Gate.displayName = 'AsyncChip'
const StrictGate = memo(createGate(Strict), () => true)
StrictGate.displayName = 'AsyncChip.Strict'
export const AsyncChip = Object.defineProperty(Gate, 'Strict', { value: StrictGate }) as
    FunctionComponent<AsyncChipProps> & { readonly Strict: NamedExoticComponent<AsyncChipProps> }

export function chip(render: () => ReactNode): ReactElement { return createElement(Chip, { children: render }) }
export function strictChip(render: () => ReactNode): ReactElement { return createElement(Chip.Strict, { children: render }) }
export function asyncChip(render: () => ReactNode): ReactElement { return createElement(AsyncChip, { children: render }) }
export function asyncStrictChip(render: () => ReactNode): ReactElement { return createElement(AsyncChip.Strict, { children: render }) }
