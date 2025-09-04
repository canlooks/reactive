import {ComponentClass} from 'react'
import {ReactiveOptions} from '../..'
import {distributeProperties, Effect, Proxyable} from '../core'
import {implementDecorator} from '../core/decoratorHelper'

export function createReactClassComponent<P>(target: ComponentClass<P>, options?: ReactiveOptions) {
    const context_proxyable = new WeakMap<object, Proxyable<any>>()

    return {
        [target.name]: class extends target {
            constructor(props: P) {
                super(props)
                // 代理整个this
                const proxyable = new Proxyable(this, {
                    ...options,
                    skipRenderPropNames: {
                        props: true,
                        context: true,
                        state: true
                    }
                })
                distributeProperties(proxyable)
                // 创建强制更新副作用
                const effect = new Effect(({skipRender}) => {
                    !skipRender && this.forceUpdate()
                })

                proxyable.addDisposer(() => effect.dispose())

                // 添加修饰器返回的清除器
                const disposers = implementDecorator(target.prototype, proxyable)
                if (disposers) {
                    for (let i = 0, {length} = disposers; i < length; i++) {
                        const disposer = disposers[i]
                        typeof disposer === 'function' && proxyable.addDisposer(disposer)
                    }
                }

                const {proxy} = proxyable
                // 修改渲染方法
                this.render = () => effect.refer(() => super.render.call(proxy))
                // 创建this与proxyable映射，用于componentWillUnmount()
                context_proxyable.set(proxy, proxyable)

                return proxy
            }

            override componentWillUnmount() {
                super.componentWillUnmount?.()
                context_proxyable.get(this)?.dispose()
            }
        }
    }[target.name]
}