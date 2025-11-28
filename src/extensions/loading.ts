import {Fn} from '../..'
import {TwoWay} from '../core'

/**
 * 方法修饰器，会在该方法执行前后处理loading状态
 * @param refer
 */
export function loading<T extends object = any, A = any>(refer: (this: T, context: T, ...args: A[]) => any) {
    return (target: Object, p: PropertyKey, descriptor: TypedPropertyDescriptor<Fn<Promise<any>>>) => {
        if (descriptor.value) {
            descriptor.value = defineLoading<Fn<Promise<any>>, A>(function (this: T, ...args) {
                return refer.call(this, this, ...args)
            }, descriptor.value)
        }
    }
}

export function defineLoading<F extends Fn<Promise<any>>, A>(refer: (this: any, ...args: A[]) => any, fn: F): F {
    const twoWay = new TwoWay()
    return {
        [fn.name]: async function (this: any, ...args: A[]) {
            twoWay.refer(() => refer.apply(this, args))
            const setState = (dir: 1 | -1) => {
                const prevState = twoWay.getValue()
                if (typeof prevState === 'number') {
                    // loading状态为number，作为栈数量
                    twoWay.setValue(prevState + dir)
                } else {
                    // 其余情况都作为布尔值，栈由twoWay内部控制
                    dir > 0 ? twoWay.putIn(true) : twoWay.tackOut(false)
                }
            }
            try {
                setState(1)
                return await fn?.apply(this, args)
            } finally {
                setState(-1)
            }
        } as F
    }[fn.name]
}