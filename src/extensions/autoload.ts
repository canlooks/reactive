import {ReactiveOptions} from '../..'
import {targetIsClass} from '../core/allocateTargets'
import {defineLoading} from './loading'
import {nextTick} from '../utils'

// 不能将cached属性挂载实例上，否则cached变化触发effect，导致循环调用
const cachedAutoLoad_pending = new WeakMap<Autoload, Promise<any>>()

export abstract class Autoload<DATA = any, ARGUMENT = any> {
    loading = false

    protected _data: DATA | undefined

    get data() {
        this.load().then()
        return this._data
    }

    set data(v) {
        this._data = v
    }

    setData(data: DATA | undefined) {
        this._data = data
    }

    abstract loadData(...args: ARGUMENT[]): DATA | undefined | Promise<DATA | undefined>
    
    async load() {
        const pending = cachedAutoLoad_pending.get(this)
        if (pending) {
            return await pending as DATA
        }
        await nextTick()
        return await this.update()
    }

    onLoad?(): void

    update = defineLoading(function (this: Autoload) {
        return this.loading
    }, function (this: Autoload, ...args: ARGUMENT[]) {
        const pending = new Promise<DATA>(async (resolve, reject) => {
            try {
                this._data = await this.loadData(...args)
                this.onLoad?.()
                resolve(this._data)
            } catch (e) {
                cachedAutoLoad_pending.delete(this)
                reject(e)
            }
        })
        cachedAutoLoad_pending.set(this, pending)
        return pending
    })
}

export function defineAutoload<D = any, A = any>(loadData: (...args: A[]) => D | Promise<D>, {name, ...options}: ReactiveOptions & { name?: string } = {}): Autoload<D, A> {
    let _class = class extends Autoload<D> {
        loadData = loadData
    }
    if (name) {
        _class = {
            [name]: _class
        }[name]
    }
    const Allocated = targetIsClass(_class, options)
    return new Allocated()
}