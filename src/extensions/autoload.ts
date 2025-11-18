import {ReactiveOptions} from '../..'
import {targetIsClass} from '../core/allocateTargets'
import {defineLoading} from './loading'

// 不能将cached属性挂载实例上，否则cached变化触发effect，导致循环调用
const autoLoad_cached = new WeakMap<Autoload, boolean>()

export abstract class Autoload<D = any> {
    loading = false

    protected _data: D | undefined

    get data() {
        if (!autoLoad_cached.get(this)) {
            this.update().then()
        }
        return this._data
    }

    set data(v) {
        this._data = v
    }

    setData(data: D | undefined) {
        this._data = data
    }

    abstract loadData(...args: any[]): D | undefined | Promise<D | undefined>

    onLoad?(): void

    update = defineLoading(function (this: any) {
        return this.loading
    }, async function (this: any, ...args: any) {
        autoLoad_cached.set(this, true)
        try {
            this._data = await this.loadData(...args)
            this.onLoad?.()
            return this._data
        } catch (e) {
            autoLoad_cached.set(this, false)
            throw e
        }
    })
}

export function defineAutoload<D = any>(loadData: (...args: any[]) => D | Promise<D>, options?: ReactiveOptions) {
    const Allocated = targetIsClass(
        class extends Autoload<D> {
            loadData = loadData
        },
        options
    )
    return new Allocated()
}