import { memo, useState, useSyncExternalStore, type FunctionComponent, type NamedExoticComponent } from 'react'
import { Observer } from './observer.js'
import { useCommitEffect } from './commit.js'

const cache = new WeakMap<object, NamedExoticComponent<any>>()
const serverSnapshot = () => 0

export function createObserverComponent<P extends object>(component: FunctionComponent<P>) {
    const name = component.displayName || component.name || 'Component'
    function ObserverComponent(props: P) {
        const [observer] = useState(() => new Observer(props))
        const attempt = observer.attempt(props)
        useSyncExternalStore(observer.subscribe, () => observer.snapshot(attempt), serverSnapshot)
        // Suspense can replay layout effects while retaining passive effects,
        // including useSyncExternalStore's subscription. Preserve its listener
        // until React actually unsubscribes, but stop all reactive work now.
        useCommitEffect(() => () => observer.disconnect(true), [observer])
        useCommitEffect(() => { observer.commit(attempt) })
        return observer.render(attempt, () => component(observer.props.proxy))
    }
    ObserverComponent.displayName = `Reactive(${name})`
    return ObserverComponent
}

export function ReactiveFunctionComponent<P extends object>(component: FunctionComponent<P>): NamedExoticComponent<P> {
    if ((typeof component === 'function' || (typeof component === 'object' && component !== null)) && cache.has(component)) {
        return cache.get(component)!
    }
    if (typeof component !== 'function' || component.prototype?.isReactComponent || component.constructor.name === 'AsyncFunction') {
        throw new TypeError('ReactiveFunctionComponent expects a synchronous function component or its own wrapper')
    }
    const ObserverComponent = createObserverComponent(component)
    const wrapped = memo(ObserverComponent)
    wrapped.displayName = ObserverComponent.displayName
    cache.set(component, wrapped)
    cache.set(wrapped, wrapped)
    return wrapped
}
