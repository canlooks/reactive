import { untracked } from '../effect.js'
import { reactive } from '../reactive.js'
import { recordReferenceRead, withoutReferenceCapture } from '../reference.js'

const states = new WeakMap<object, ClassState>()
const managedFields = new Set<PropertyKey>(['props', 'state', 'context', 'refs', 'updater'])

export const reactMethods = new Set<PropertyKey>([
    'constructor', 'render', 'setState', 'forceUpdate', 'shouldComponentUpdate',
    'componentDidMount', 'componentDidUpdate', 'componentWillUnmount', 'getSnapshotBeforeUpdate',
    'componentDidCatch', 'componentWillMount', 'componentWillReceiveProps', 'componentWillUpdate',
    'UNSAFE_componentWillMount', 'UNSAFE_componentWillReceiveProps', 'UNSAFE_componentWillUpdate',
    'getDerivedStateFromProps', 'getDerivedStateFromError',
])

export interface ClassField {
    readonly key: PropertyKey
    readonly writable: boolean
    read(): unknown
    publish(value: unknown): void
    assertValid(): void
    validateWrite?: (value: unknown, current: unknown) => void
}

export class ClassState {
    readonly fields = new Map<PropertyKey, ClassField>()
    readonly reconnect = new Set<() => void>()
    connected = false

    connect(): void {
        this.connected = true
        for (const publish of this.reconnect) publish()
    }

    disconnect(): void { this.connected = false }
}

export function getClassState(instance: object): ClassState | undefined { return states.get(instance) }

/** Keep React's instance (and private-field brand); bridge only user data. */
export function installClassState(instance: object): ClassState {
    const fields: Array<[PropertyKey, PropertyDescriptor]> = []
    for (const key of Reflect.ownKeys(instance)) {
        const descriptor = Reflect.getOwnPropertyDescriptor(instance, key)!
        if (managedFields.has(key) || reactMethods.has(key) || !('value' in descriptor)
            || typeof descriptor.value === 'function') continue
        if (!descriptor.configurable) {
            if (descriptor.writable) throw new TypeError(`ReactiveClassComponent cannot observe field ${String(key)}`)
            continue
        }
        fields.push([key, descriptor])
    }
    // Validate every descriptor before changing any of the user's properties.
    const raw: Record<PropertyKey, unknown> = Object.create(null)
    for (const [key, descriptor] of fields) {
        Object.defineProperty(raw, key, { value: descriptor.value, writable: true, configurable: true, enumerable: true })
    }
    const storage = reactive(raw)
    const state = new ClassState()
    for (const [key, original] of fields) {
        const descriptor: PropertyDescriptor = {
            configurable: true, enumerable: original.enumerable,
            get: () => recordReferenceRead(instance, instance, key,
                withoutReferenceCapture(() => storage[key]), descriptor),
        }
        const field: ClassField = {
            key, writable: !!original.writable,
            read: () => storage[key],
            assertValid() {
                const current = Reflect.getOwnPropertyDescriptor(instance, key)
                if (!current || current.get !== descriptor.get || current.set !== descriptor.set
                    || current.enumerable !== descriptor.enumerable || current.configurable !== descriptor.configurable) {
                    throw new TypeError(`Reactive field ${String(key)} has been redefined`)
                }
            },
            publish(value) {
                field.assertValid()
                storage[key] = value
            },
        }
        if (original.writable) descriptor.set = (value: unknown) => {
            if (field.validateWrite) untracked(() => withoutReferenceCapture(() => field.validateWrite!(value, storage[key])))
            storage[key] = value
        }
        Object.defineProperty(instance, key, descriptor)
        state.fields.set(key, field)
    }
    states.set(instance, state)
    return state
}
