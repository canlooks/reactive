import {Fn} from '../..'
import {Effect} from './effect'
import {Proxyable} from './proxy'

type State = {
    computedValue?: any
    effect?: Effect
    shouldRecompute: boolean
}

/**
 * 获得一个自动缓存的计算属性
 * @param get 
 * @param proxyable 
 * @param p
 */
export function defineGetter<G extends Fn>(get: G, proxyable: Proxyable<any>, p: PropertyKey): G {
    const state: State = {shouldRecompute: true}

    return (() => {
        if (!state.effect) {
            state.effect = new Effect(() => {
                state.shouldRecompute = true
                proxyable.trigger(p)
            }, {sync: true})
        }
        if (state.shouldRecompute) {
            state.computedValue = state.effect.refer(() => get.call(proxyable.proxy))
            state.shouldRecompute = false
        }
        return state.computedValue
    }) as G
}