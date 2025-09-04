import {Batch} from './batch'
import {Disposable} from './disposable'
import {Proxyable} from './proxy'

export type Payload = {
    skipRender?: boolean
    proxyable?: Proxyable<any>
    p?: PropertyKey
}

type EffectOptions = {
    sync?: boolean
}

export class Effect extends Disposable {
    static stacks: Effect[] = []

    constructor(public callback: (payload: Payload) => void, private options?: EffectOptions) {
        super()
    }

    /**
     * 执行参考函数
     * @param refer 
     */
    refer<T>(refer: () => T): T {
        try {
            Effect.stacks.push(this)
            return refer()
        } finally {
            Effect.stacks.pop()
        }
    }

    /**
     * 触发副作用
     * @param payload 
     */
    trigger(payload: Payload) {
        Batch.batchingStackCount && !this.options?.sync
            // 处于批处理栈中，且未指定强制同步，加入队列
            ? Batch.addEffect(this, payload)
            // 否则直接执行
            : this.callback(payload)
    }
}