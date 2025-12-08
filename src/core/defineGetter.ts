import {Effect} from './effect'
import {Fn} from '../../index'
import {Proxyable} from './proxy'

export class Getter extends Effect {
    private isMemorized = false
    private computedValue: any

    constructor(private proxyable: Proxyable<any>, p: PropertyKey) {
        super(() => {
            this.isMemorized = false
            proxyable.trigger(p)
        }, {forceSync: true})
    }

    /**
     * 定义一个计算属性
     * @param get
     */
    defineGetter<G extends Fn>(get: G): G {
        return {
            [get.name]: (() => {
                if (!this.isMemorized) {
                    this.computedValue = this.refer(() => get.call(this.proxyable.proxy))
                    this.isMemorized = true
                }

                return this.computedValue
            }) as G
        }[get.name]
    }
}