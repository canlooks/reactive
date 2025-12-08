import {ReactiveOptions} from '../..'
import {targetIsClass} from '../core/allocateTargets'
import {defineLoading} from './loading'
import {nextTick} from '../utils'

// 不能将cached属性挂载实例上，否则cached变化触发effect，导致循环调用
const cached_autoLoad = new WeakSet<Autoload>()

export abstract class Autoload<DATA = any, ARGUMENT = any> {
    loading = false

    protected _data: DATA | undefined

    get data() {
        if (!cached_autoLoad.has(this)) {
            // 使用nextTick避免loading与该getter绑定
            nextTick().then(() => {
                this.update().then()
            })
        }
        return this._data
    }

    set data(v) {
        this._data = v
    }

    setData(data: DATA | undefined) {
        this._data = data
    }

    abstract loadData(...args: ARGUMENT[]): DATA | undefined | Promise<DATA | undefined>

    onLoad?(): void

    update = defineLoading(function (this) {
        return this.loading
    }, async function (this, ...args) {
        cached_autoLoad.add(this)
        try {
            this._data = await this.loadData(...args)
            this.onLoad?.()
            return this._data
        } catch (e) {
            cached_autoLoad.delete(this)
            throw e
        }
    })
}

export function defineAutoload<D = any>(loadData: (...args: any[]) => D | Promise<D>, options?: ReactiveOptions): Autoload<D> {
    const Allocated = targetIsClass(
        class extends Autoload<D> {
            loadData = loadData
        },
        options
    )
    return new Allocated()
}