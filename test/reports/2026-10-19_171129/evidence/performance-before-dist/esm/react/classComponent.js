import { getReadView, isSubscriptionRead, outsideReadContext } from '../effect.js';
import { Observer } from './observer.js';
import { shallowEqual } from './props.js';
import { batch } from '../batch.js';
import { installClassState } from './classState.js';
const cache = new WeakMap();
function install(target, key, value) {
    const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
    if (descriptor && !descriptor.configurable && (!('value' in descriptor) || !descriptor.writable)) {
        throw new TypeError(`ReactiveClassComponent cannot replace ${String(key)}`);
    }
    Object.defineProperty(target, key, { value, writable: true, configurable: descriptor?.configurable ?? true });
}
export function ReactiveClassComponent(Target) {
    if (typeof Target !== 'function' || !Target.prototype?.isReactComponent) {
        throw new TypeError('ReactiveClassComponent expects a React class component');
    }
    if (cache.has(Target))
        return cache.get(Target);
    const Base = Target;
    const pure = !!Target.prototype.isPureReactComponent;
    class ReactiveClass extends Base {
        constructor(...args) {
            super(...args);
            const state = installClassState(this);
            const observer = new Observer(this.props, true);
            let delivered = this.props;
            let attempt;
            const propsDescriptor = Reflect.getOwnPropertyDescriptor(this, 'props');
            if (propsDescriptor && !propsDescriptor.configurable) {
                throw new TypeError('ReactiveClassComponent cannot replace props');
            }
            Object.defineProperty(this, 'props', {
                configurable: true,
                enumerable: propsDescriptor?.enumerable ?? true,
                get: () => getReadView()?.values.has(observer.props) || isSubscriptionRead()
                    ? observer.props.readSlot() : delivered,
                set: value => { delivered = value; },
            });
            const render = this.render;
            const didMount = this.componentDidMount;
            const didUpdate = this.componentDidUpdate;
            const willUnmount = this.componentWillUnmount;
            const shouldUpdate = this.shouldComponentUpdate;
            install(this, 'render', () => {
                const candidate = observer.attempt(delivered);
                const result = observer.render(candidate, () => render.call(this));
                attempt = candidate;
                return result;
            });
            install(this, 'componentDidMount', (...params) => {
                try {
                    batch(() => {
                        state.connect();
                        observer.subscribe(() => outsideReadContext(() => this.forceUpdate()));
                        if (attempt)
                            observer.commit(attempt);
                    });
                    didMount?.apply(this, params);
                }
                catch (error) {
                    state.disconnect();
                    observer.disconnect();
                    throw error;
                }
            });
            install(this, 'componentDidUpdate', (...params) => {
                try {
                    if (attempt)
                        observer.commit(attempt);
                    didUpdate?.apply(this, params);
                }
                catch (error) {
                    state.disconnect();
                    observer.disconnect();
                    throw error;
                }
            });
            install(this, 'componentWillUnmount', (...params) => {
                state.disconnect();
                observer.disconnect();
                willUnmount?.apply(this, params);
            });
            install(this, 'shouldComponentUpdate', (nextProps, nextState, nextContext) => {
                const original = shouldUpdate
                    ? shouldUpdate.call(this, nextProps, nextState, nextContext)
                    : !pure || !shallowEqual(delivered, nextProps) || !shallowEqual(this.state ?? {}, nextState ?? {});
                return original || (observer.props.hasSlotConsumers() && !shallowEqual(observer.props.committed, nextProps));
            });
        }
    }
    // The wrapper implements PureComponent's comparison, including the props
    // consumer exception. Only our own prototype changes; Target stays intact.
    if (pure)
        Object.defineProperty(ReactiveClass.prototype, 'isPureReactComponent', { value: false });
    Object.defineProperty(ReactiveClass, 'displayName', { value: `Reactive(${Target.displayName || Target.name || 'Component'})` });
    cache.set(Target, ReactiveClass);
    cache.set(ReactiveClass, ReactiveClass);
    return ReactiveClass;
}
