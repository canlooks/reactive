import { batch } from '../batch.js'
import { untracked } from '../effect.js'
import { withoutReferenceCapture } from '../reference.js'
import { getClassState, reactMethods, type ClassField, type ClassState } from './classState.js'
import { currentRender } from './observer.js'

export type LoadingSourceContext = Readonly<Record<PropertyKey, boolean | number>>
export type LoadingMethodDecorator<C extends object = object> =
    <T extends C, M extends (this: T, ...args: never[]) => Promise<unknown>>(
        target: T, key: string | symbol, descriptor: TypedPropertyDescriptor<M>,
    ) => void

const decorated = new WeakSet<Function>()
const controllers = new WeakMap<ClassField, LoadingController>()

function isolated<T>(fn: () => T): T { return untracked(() => withoutReferenceCapture(fn)) }

function validate(value: unknown): asserts value is boolean | number {
    if (typeof value !== 'boolean' && (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)) {
        throw new TypeError('loading field must be a boolean or a nonnegative safe integer')
    }
}

function select(state: ClassState, source: Function): { field: ClassField; value: boolean | number } {
    let selected: ClassField | undefined
    let value: unknown
    const reject = (): never => { throw new TypeError('loading source must read one writable direct instance field') }
    const context = new Proxy(Object.create(null) as object, {
        get(_target, key) {
            if (selected) return reject()
            const field = state.fields.get(key)
            if (!field?.writable) return reject()
            field.assertValid()
            selected = field
            return value = field.read()
        },
        set: reject, deleteProperty: reject, defineProperty: reject, setPrototypeOf: reject,
        preventExtensions: reject, getPrototypeOf: reject, ownKeys: reject, has: reject, getOwnPropertyDescriptor: reject,
    })
    const result: unknown = source(context)
    if (!selected || !Object.is(result, value)) return reject()
    validate(value)
    return { field: selected, value }
}

class LoadingController {
    readonly tokens = new Set<object>()
    private readonly numeric: boolean
    private baseline: number
    private idleValue: boolean | number

    constructor(private readonly field: ClassField, initial: boolean | number) {
        this.numeric = typeof initial === 'number'
        this.baseline = this.numeric ? initial as number : 0
        this.idleValue = initial
        field.validateWrite = (next, current) => {
            validate(next)
            if (typeof next !== typeof initial) throw new TypeError('Cannot change loading field mode')
            if (this.tokens.size) {
                if (!Object.is(next, current)) throw new TypeError('Cannot change an active loading field')
            } else {
                this.idleValue = next
                if (typeof next === 'number') this.baseline = next
            }
        }
    }

    checkCapacity(): void {
        if (this.numeric && this.baseline >= Number.MAX_SAFE_INTEGER - this.tokens.size) {
            throw new RangeError('loading counter exceeds Number.MAX_SAFE_INTEGER')
        }
    }

    publish(): void {
        this.field.publish(this.tokens.size ? this.numeric ? this.baseline + this.tokens.size : true : this.idleValue)
    }

    finish(token: object): void {
        this.tokens.delete(token)
        if (!this.tokens.size) this.idleValue = this.numeric ? this.baseline : false
    }
}

export function loading(source: (ctx: LoadingSourceContext) => boolean | number): LoadingMethodDecorator
export function loading<C extends object>(source: (ctx: C) => boolean | number): LoadingMethodDecorator<C>
export function loading(source: Function): LoadingMethodDecorator {
    if (typeof source !== 'function') throw new TypeError('loading expects a field selector')
    return (target, key, descriptor) => {
        if (!target || typeof target !== 'object' || !('isReactComponent' in target)
            || (typeof key !== 'string' && typeof key !== 'symbol') || reactMethods.has(key)
            || !descriptor || typeof descriptor.value !== 'function'
            || (!descriptor.configurable && !descriptor.writable)) {
            throw new TypeError('loading decorates React class business instance methods only (legacy decorators)')
        }
        const original = descriptor.value
        if (decorated.has(original)) throw new TypeError('Cannot apply loading twice to the same method')
        const wrapped = async function (this: object, ...args: unknown[]): Promise<unknown> {
            const state = getClassState(this)
            if (!state?.connected) throw new Error('Cannot call a loading method before mount or after unmount; use RC or RCC')
            if (currentRender()) throw new Error('Cannot call a loading method during render')
            const controller = isolated(() => {
                const { field, value } = select(state, source)
                let entry = controllers.get(field)
                if (!entry) {
                    // Invalid first calls must not install a mode/write restriction.
                    if (value === Number.MAX_SAFE_INTEGER) throw new RangeError('loading counter exceeds Number.MAX_SAFE_INTEGER')
                    entry = new LoadingController(field, value)
                    controllers.set(field, entry)
                    const current = entry
                    state.reconnect.add(() => isolated(() => current.publish()))
                }
                entry.checkCapacity()
                return entry
            })
            const token = {}
            const errors: unknown[] = []
            let result: unknown
            try {
                isolated(() => batch(() => { controller.tokens.add(token); controller.publish() }))
            } catch (error) { errors.push(error) }
            try { result = await isolated(() => Reflect.apply(original, this, args)) } catch (error) {
                errors.push(error)
            } finally {
                try {
                    isolated(() => batch(() => {
                        controller.finish(token)
                        if (state.connected) controller.publish()
                    }))
                } catch (error) { errors.push(error) }
            }
            if (errors.length === 1) throw errors[0]
            if (errors.length > 1) throw new AggregateError(errors, 'Multiple errors in reactive loading method')
            return result
        }
        decorated.add(wrapped)
        // Keep M intact, including generic and overloaded call signatures. The
        // wrapper forwards every argument and awaits the original Promise result.
        descriptor.value = wrapped as unknown as typeof original
    }
}
