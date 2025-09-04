import {Fn} from '../..'
import {isPromise} from '../utils'
import {printError} from '../utils/logHandler'
import {Batch} from './batch'

/**
 * 获得一个action，该方法会加入批处理，并尝试捕获错误信息
 * @param fn 
 * @param target 
 * @param p
 */
export function defineAction<F extends Fn>(fn: F, target?: object, p?: PropertyKey): F {
    return {
        [fn.name]: (...args: any[]) => {
            try {
                Batch.startBatch()
                const ret = fn.apply(target, args)
                if (isPromise(ret)) {
                    return Promise.resolve(ret).catch(e => {
                        printError(fn, target, p)
                        throw e
                    })
                }
                return ret
            } catch (e) {
                printError(fn, target, p)
                throw e
            } finally {
                Batch.endBatch()
            }
        }
    }[fn.name] as F
}