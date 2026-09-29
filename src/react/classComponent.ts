import type { Component, ComponentClass } from 'react'
import { getReadView, isSubscriptionRead, outsideReadContext } from '../effect.js'
import { Observer, type RenderAttempt } from './observer.js'
import { shallowEqual } from './props.js'

const cache = new WeakMap<object, ComponentClass<any>>()

function install(target: object, key: PropertyKey, value: unknown): void {
    const descriptor = Reflect.getOwnPropertyDescriptor(target, key)
    if (descriptor && !descriptor.configurable && (!('value' in descriptor) || !descriptor.writable)) {
        throw new TypeError(`ReactiveClassComponent cannot replace ${String(key)}`)
    }
    Object.defineProperty(target, key, { value, writable: true, configurable: descriptor?.configurable ?? true })
}

export function ReactiveClassComponent<C extends ComponentClass<any>>(Target: C): C {
    if (typeof Target !== 'function' || !Target.prototype?.isReactComponent) {
        throw new TypeError('ReactiveClassComponent expects a React class component')
    }
    if (cache.has(Target)) return cache.get(Target) as C
    const Base = Target as new (...args: any[]) => Component<any, any>
    const pure = !!(Target.prototype as { isPureReactComponent?: boolean }).isPureReactComponent
    class ReactiveClass extends Base {
        constructor(...args: any[]) {
            super(...args)
            const observer = new Observer(this.props, true)
            let delivered = this.props
            let attempt: RenderAttempt<any> | undefined
            const propsDescriptor = Reflect.getOwnPropertyDescriptor(this, 'props')
            if (propsDescriptor && !propsDescriptor.configurable) {
                throw new TypeError('ReactiveClassComponent cannot replace props')
            }
            Object.defineProperty(this, 'props', {
                configurable: true,
                enumerable: propsDescriptor?.enumerable ?? true,
                get: () => getReadView()?.values.has(observer.props) || isSubscriptionRead()
                    ? observer.props.readSlot() : delivered,
                set: value => { delivered = value },
            })
            const render = this.render
            const didMount = this.componentDidMount
            const didUpdate = this.componentDidUpdate
            const willUnmount = this.componentWillUnmount
            const shouldUpdate = this.shouldComponentUpdate
            install(this, 'render', () => {
                const candidate = observer.attempt(delivered)
                const result = observer.render(candidate, () => render.call(this))
                attempt = candidate
                return result
            })
            install(this, 'componentDidMount', (...params: unknown[]) => {
                observer.subscribe(() => outsideReadContext(() => this.forceUpdate()))
                if (attempt) observer.commit(attempt)
                didMount?.apply(this, params as [])
            })
            install(this, 'componentDidUpdate', (...params: unknown[]) => {
                if (attempt) observer.commit(attempt)
                didUpdate?.apply(this, params as [any, any, any])
            })
            install(this, 'componentWillUnmount', (...params: unknown[]) => {
                observer.disconnect()
                willUnmount?.apply(this, params as [])
            })
            install(this, 'shouldComponentUpdate', (nextProps: object, nextState: object, nextContext: unknown) => {
                const original = shouldUpdate
                    ? shouldUpdate.call(this, nextProps, nextState, nextContext)
                    : !pure || !shallowEqual(delivered, nextProps) || !shallowEqual(this.state ?? {}, nextState ?? {})
                return original || (observer.props.hasSlotConsumers() && !shallowEqual(observer.props.committed, nextProps))
            })
        }
    }
    // The wrapper implements PureComponent's comparison, including the props
    // consumer exception. Only our own prototype changes; Target stays intact.
    if (pure) Object.defineProperty(ReactiveClass.prototype, 'isPureReactComponent', { value: false })
    Object.defineProperty(ReactiveClass, 'displayName', { value: `Reactive(${Target.displayName || Target.name || 'Component'})` })
    cache.set(Target, ReactiveClass)
    cache.set(ReactiveClass, ReactiveClass)
    return ReactiveClass as C
}
