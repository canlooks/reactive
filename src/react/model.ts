import {
    Children, Fragment, cloneElement, createElement, isValidElement, useState,
    type ChangeEvent, type ComponentProps, type ComponentType, type FunctionComponent, type ReactElement,
} from 'react'
import { batch } from '../batch.js'
import { untracked } from '../effect.js'
import { reactive } from '../reactive.js'
import { captureReference } from '../reference.js'
import { useCommittedRef } from './commit.js'
import { createObserverComponent } from './functionComponent.js'

export type ModelEvent<T> = T extends string
    ? ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    : T extends boolean ? ChangeEvent<HTMLInputElement>
    : T extends readonly string[] ? ChangeEvent<HTMLSelectElement> : never

export interface UseModelReturn<T> {
    value: T
    readonly onChange: (input: T | ModelEvent<T>) => void
}

function isControl(value: unknown): value is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
    if (value === null || typeof value !== 'object') return false
    const view = (value as Element).ownerDocument?.defaultView
    return !!view && (value instanceof view.HTMLInputElement || value instanceof view.HTMLTextAreaElement
        || value instanceof view.HTMLSelectElement)
}

function normalizeInput(input: unknown): unknown {
    if (input !== null && typeof input === 'object'
        && 'preventDefault' in input && typeof input.preventDefault === 'function'
        && 'stopPropagation' in input && typeof input.stopPropagation === 'function') {
        const current = 'currentTarget' in input ? input.currentTarget : undefined
        const target = isControl(current) ? current : 'target' in input ? input.target : undefined
        if (isControl(target)) {
            if (target.tagName === 'INPUT' && (target.type === 'checkbox' || target.type === 'radio')) {
                return (target as HTMLInputElement).checked
            }
            if (target.tagName === 'SELECT' && (target as HTMLSelectElement).multiple) {
                return Array.from((target as HTMLSelectElement).selectedOptions, option => option.value)
            }
            return target.value
        }
    }
    return input
}

export function useModel<T>(initialValue: T): UseModelReturn<T> {
    const [state] = useState(() => reactive({ value: initialValue }))
    const committed = useCommittedRef(state)
    return useState(() => Object.defineProperty(state, 'onChange', {
        enumerable: true,
        value: (input: T | ModelEvent<T>) => {
            if (committed.active) untracked(() => { state.value = normalizeInput(input) as T })
        },
    }) as UseModelReturn<T>)[0]
}

export interface ModelProps<T, A extends unknown[] = unknown[]> {
    source: () => T
    children: ReactElement
    postValue?: (...args: A) => T
    valueProp?: 'value' | 'checked'
}

interface ControlProps {
    onChange?: (...args: unknown[]) => unknown
    type?: string
    multiple?: boolean
    value?: unknown
    checked?: unknown
    defaultValue?: unknown
    defaultChecked?: unknown
}

function ModelView<T, A extends unknown[]>(props: ModelProps<T, A>): ReactElement {
    const { source, postValue, valueProp, children } = props
    if (!isValidElement(children) || children.type === Fragment) {
        throw new TypeError('Model requires exactly one control element, excluding Fragment')
    }
    const child = Children.only(children) as ReactElement<ControlProps>
    if (child.type === 'input' && child.props.type === 'file') throw new TypeError('Model does not support file inputs')
    const reference = captureReference(source)
    const field = valueProp ?? (typeof reference.value === 'boolean' ? 'checked' : 'value')
    if (field !== 'value' && field !== 'checked') throw new TypeError('Model valueProp must be value or checked')
    const committed = useCommittedRef({ source, postValue, onChange: child.props.onChange })
    const [onChange] = useState(() => (...args: A) => {
        if (!committed.active) return
        const config = committed.current!
        untracked(() => {
            const current = captureReference(config.source)
            const next = config.postValue ? config.postValue(...args) : normalizeInput(args[0]) as T
            batch(() => {
                current.write(next)
                config.onChange?.(...args)
            })
        })
    })
    let value: unknown = reference.value
    if (typeof child.type === 'string' && ['input', 'textarea', 'select'].includes(child.type) && value == null) {
        value = field === 'checked' ? false : child.type === 'select' && child.props.multiple ? [] : ''
    }
    return cloneElement(child, {
        [field]: value,
        [field === 'checked' ? 'defaultChecked' : 'defaultValue']: undefined,
        onChange: onChange as (...args: unknown[]) => void,
    })
}

// The observer preserves the view's generic relationship between source and postValue.
export const Model = createObserverComponent(ModelView) as <T, A extends unknown[] = unknown[]>(props: ModelProps<T, A>) => ReactElement

export type ModelValue<P> = P[Extract<'value' | 'checked', keyof P>]
export type ModelChangeArgs<P> = 'onChange' extends keyof P
    ? NonNullable<P['onChange']> extends (...args: infer A) => unknown ? A : never
    : never
export type DefinedModelProps<P> = Omit<P, 'refer' | 'ref' | 'valueProp' | 'value' | 'checked' |
    'defaultValue' | 'defaultChecked' | 'onChange'> & {
    refer: () => ModelValue<P>
    onChange?: P[Extract<'onChange', keyof P>]
    valueProp?: 'value' | 'checked'
}

export function defineModel<P extends object = ComponentProps<'input'>>(
    component: ComponentType<P> & (ModelValue<P> extends never ? never
        : ModelChangeArgs<P> extends never ? never : unknown),
    postValue?: (...args: ModelChangeArgs<P>) => ModelValue<P>,
): FunctionComponent<DefinedModelProps<P>> {
    function DefinedModel({ refer, valueProp, ...props }: DefinedModelProps<P>) {
        return createElement(Model<ModelValue<P>, ModelChangeArgs<P>>, {
            source: refer, valueProp, postValue,
            // Model supplies the omitted control props before React renders this child.
            children: createElement(component, props as P),
        })
    }
    DefinedModel.displayName = `Model(${component.displayName || component.name || 'Component'})`
    return DefinedModel
}
