import { getDep, getReadView, recordChange, track, } from '../effect.js';
import { recordReferenceRead } from '../reference.js';
const slot = Symbol('props');
function propKeys(props) {
    // React development props can include warning getters for reserved key/ref.
    // React 19's enumerable ref remains a normal prop; never evaluate warning
    // accessors just to compare or enumerate snapshots.
    return Reflect.ownKeys(props).filter(key => {
        if (key !== 'key' && key !== 'ref')
            return true;
        const descriptor = Reflect.getOwnPropertyDescriptor(props, key);
        return descriptor.enumerable !== false || typeof descriptor.get !== 'function';
    });
}
export function shallowEqual(a, b) {
    if (a === b)
        return true;
    const keys = propKeys(a);
    return keys.length === propKeys(b).length && keys.every(key => Object.hasOwn(b, key) && Object.is(Reflect.get(a, key), Reflect.get(b, key)));
}
function fieldState(props, key) {
    return Object.hasOwn(props, key) ? { kind: 'data', value: Reflect.get(props, key) } : { kind: 'absent' };
}
/** React owns the original objects; this cell owns only a shallow reading view. */
export class PropsCell {
    wholeObject;
    committed;
    proxy;
    initialized = false;
    constructor(initial, wholeObject = false) {
        this.wholeObject = wholeObject;
        this.committed = initial;
        const read = () => this.current();
        this.proxy = new Proxy(Object.create(null), {
            get: (target, key, receiver) => {
                track(this, key);
                const value = Reflect.get(read(), key);
                return recordReferenceRead(receiver, target, key, value, { value, writable: false });
            },
            has: (_target, key) => Reflect.has(read(), key),
            ownKeys: () => propKeys(read()),
            getOwnPropertyDescriptor: (_target, key) => Object.hasOwn(read(), key)
                ? { configurable: true, enumerable: Reflect.getOwnPropertyDescriptor(read(), key).enumerable,
                    writable: false, value: Reflect.get(read(), key) }
                : undefined,
            getPrototypeOf: () => Reflect.getPrototypeOf(read()),
            set: () => false,
            deleteProperty: () => false,
            defineProperty: () => false,
            setPrototypeOf: () => false,
            preventExtensions: () => false,
        });
    }
    current() { return getReadView()?.values.get(this) ?? this.committed; }
    readSlot() { track(this, slot); return this.current(); }
    hasSlotConsumers() { return getDep(this, slot).size > 0; }
    view(incoming) {
        const changed = new Set();
        if (this.wholeObject) {
            if (!shallowEqual(this.committed, incoming))
                changed.add(getDep(this, slot));
        }
        else {
            for (const key of new Set([...propKeys(this.committed), ...propKeys(incoming)])) {
                if (Object.hasOwn(this.committed, key) !== Object.hasOwn(incoming, key)
                    || !Object.is(Reflect.get(this.committed, key), Reflect.get(incoming, key))) {
                    changed.add(getDep(this, key));
                }
            }
        }
        return { values: new Map([[this, incoming]]), changed, computations: new Map(), evaluating: new Set() };
    }
    publish(incoming, source) {
        const previous = this.committed;
        this.committed = incoming;
        const receipt = new Map();
        if (!this.initialized) {
            this.initialized = true;
            return receipt;
        }
        if (this.wholeObject) {
            if (!shallowEqual(previous, incoming)) {
                recordChange(this, slot, { kind: 'data', value: previous }, () => ({
                    kind: 'data', value: shallowEqual(previous, this.committed) ? previous : this.committed,
                }), source, receipt);
            }
        }
        else {
            for (const key of new Set([...propKeys(previous), ...propKeys(incoming)])) {
                recordChange(this, key, fieldState(previous, key), () => fieldState(this.committed, key), source, receipt);
            }
        }
        return receipt;
    }
}
