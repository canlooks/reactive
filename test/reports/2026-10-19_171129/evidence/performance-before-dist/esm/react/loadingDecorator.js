import { batch } from '../batch.js';
import { untracked } from '../effect.js';
import { withoutReferenceCapture } from '../reference.js';
import { getClassState, reactMethods } from './classState.js';
import { currentRender } from './observer.js';
const decorated = new WeakSet();
const controllers = new WeakMap();
function isolated(fn) { return untracked(() => withoutReferenceCapture(fn)); }
function validate(value) {
    if (typeof value !== 'boolean' && (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)) {
        throw new TypeError('loading field must be a boolean or a nonnegative safe integer');
    }
}
function select(state, source) {
    let selected;
    let value;
    const reject = () => { throw new TypeError('loading source must read one writable direct instance field'); };
    const context = new Proxy(Object.create(null), {
        get(_target, key) {
            if (selected)
                return reject();
            const field = state.fields.get(key);
            if (!field?.writable)
                return reject();
            field.assertValid();
            selected = field;
            return value = field.read();
        },
        set: reject, deleteProperty: reject, defineProperty: reject, setPrototypeOf: reject,
        preventExtensions: reject, getPrototypeOf: reject, ownKeys: reject, has: reject, getOwnPropertyDescriptor: reject,
    });
    const result = source(context);
    if (!selected || !Object.is(result, value))
        return reject();
    validate(value);
    return { field: selected, value };
}
class LoadingController {
    field;
    tokens = new Set();
    numeric;
    baseline;
    idleValue;
    constructor(field, initial) {
        this.field = field;
        this.numeric = typeof initial === 'number';
        this.baseline = this.numeric ? initial : 0;
        this.idleValue = initial;
        field.validateWrite = (next, current) => {
            validate(next);
            if (typeof next !== typeof initial)
                throw new TypeError('Cannot change loading field mode');
            if (this.tokens.size) {
                if (!Object.is(next, current))
                    throw new TypeError('Cannot change an active loading field');
            }
            else {
                this.idleValue = next;
                if (typeof next === 'number')
                    this.baseline = next;
            }
        };
    }
    checkCapacity() {
        if (this.numeric && this.baseline >= Number.MAX_SAFE_INTEGER - this.tokens.size) {
            throw new RangeError('loading counter exceeds Number.MAX_SAFE_INTEGER');
        }
    }
    publish() {
        this.field.publish(this.tokens.size ? this.numeric ? this.baseline + this.tokens.size : true : this.idleValue);
    }
    finish(token) {
        this.tokens.delete(token);
        if (!this.tokens.size)
            this.idleValue = this.numeric ? this.baseline : false;
    }
}
export function loading(source) {
    if (typeof source !== 'function')
        throw new TypeError('loading expects a field selector');
    return (target, key, descriptor) => {
        if (!target || typeof target !== 'object' || !('isReactComponent' in target)
            || (typeof key !== 'string' && typeof key !== 'symbol') || reactMethods.has(key)
            || !descriptor || typeof descriptor.value !== 'function'
            || (!descriptor.configurable && !descriptor.writable)) {
            throw new TypeError('loading decorates React class business instance methods only (legacy decorators)');
        }
        const original = descriptor.value;
        if (decorated.has(original))
            throw new TypeError('Cannot apply loading twice to the same method');
        const wrapped = async function (...args) {
            const state = getClassState(this);
            if (!state?.connected)
                throw new Error('Cannot call a loading method before mount or after unmount; use RC or RCC');
            if (currentRender())
                throw new Error('Cannot call a loading method during render');
            const controller = isolated(() => {
                const { field, value } = select(state, source);
                let entry = controllers.get(field);
                if (!entry) {
                    // Invalid first calls must not install a mode/write restriction.
                    if (value === Number.MAX_SAFE_INTEGER)
                        throw new RangeError('loading counter exceeds Number.MAX_SAFE_INTEGER');
                    entry = new LoadingController(field, value);
                    controllers.set(field, entry);
                    const current = entry;
                    state.reconnect.add(() => isolated(() => current.publish()));
                }
                entry.checkCapacity();
                return entry;
            });
            const token = {};
            const errors = [];
            let result;
            try {
                isolated(() => batch(() => { controller.tokens.add(token); controller.publish(); }));
            }
            catch (error) {
                errors.push(error);
            }
            try {
                result = await isolated(() => Reflect.apply(original, this, args));
            }
            catch (error) {
                errors.push(error);
            }
            finally {
                try {
                    isolated(() => batch(() => {
                        controller.finish(token);
                        if (state.connected)
                            controller.publish();
                    }));
                }
                catch (error) {
                    errors.push(error);
                }
            }
            if (errors.length === 1)
                throw errors[0];
            if (errors.length > 1)
                throw new AggregateError(errors, 'Multiple errors in reactive loading method');
            return result;
        };
        decorated.add(wrapped);
        // Keep M intact, including generic and overloaded call signatures. The
        // wrapper forwards every argument and awaits the original Promise result.
        descriptor.value = wrapped;
    };
}
