/** Internal property locations, independent of both dependency collection and React. */
interface PropertyRead {
    receiver: object
    rawTarget: object
    key: PropertyKey
    value: unknown
    descriptor?: PropertyDescriptor
}

interface Capture { reads: PropertyRead[]; derived: boolean }
let capturing: Capture | undefined

export function recordReferenceRead<T>(receiver: object, rawTarget: object, key: PropertyKey, value: T, descriptor?: PropertyDescriptor): T {
    if (capturing) capturing.reads.push({ receiver, rawTarget, key, value, descriptor })
    return value
}
export function markDerivedRead(): void { if (capturing) capturing.derived = true }

export function withoutReferenceCapture<T>(fn: () => T): T {
    const previous = capturing
    capturing = undefined
    try { return fn() } finally { capturing = previous }
}

export interface WritableReference<T> {
    readonly value: T
    write(value: T): void
}

export function captureReference<T>(selector: () => T): WritableReference<T> {
    if (typeof selector !== 'function') throw new TypeError('Model source must be a writable property selector')
    const previous = capturing
    const capture: Capture = { reads: [], derived: false }
    capturing = capture
    let value: T
    try { value = selector() } finally { capturing = previous }
    const { reads } = capture
    const terminal = reads.at(-1)
    if (capture.derived || !terminal || !Object.is(value, terminal.value)
        || reads.some((read, index) => index > 0 && read.receiver !== reads[index - 1].value)) {
        throw new TypeError('Model source must select one writable reactive property without derived or ambiguous reads')
    }
    const { receiver, rawTarget, key, descriptor } = terminal
    const writable = descriptor && !('value' in descriptor)
        ? typeof descriptor.set === 'function'
        : descriptor?.writable !== false && (Object.hasOwn(rawTarget, key) || Object.isExtensible(rawTarget))
    if (!writable) throw new TypeError('Model source selects a readonly property')
    return {
        value,
        write(next) {
            if (!Reflect.set(receiver, key, next, receiver)) throw new TypeError('Model could not write the selected property')
        },
    }
}
