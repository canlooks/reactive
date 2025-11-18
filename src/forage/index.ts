import {reactor} from '../api'
import {targetIsClass} from '../core/allocateTargets'
import {Autoload} from '../extensions'
import localforage from 'localforage'
import {ReactiveOptions} from '../..'

export class Forage<D = any> extends Autoload<D> {
    constructor(public name: string, private initialValue?: D) {
        super()
    }

    dispose() {
    }

    async loadData(...args: any[]) {
        const cached = await localforage.getItem<D>(this.name)
        this.dispose = reactor(() => this.data, data => {
            localforage.setItem(this.name, data)
        })
        return cached ?? this.initialValue
    }
}

export function defineForage<D = any>(name: string, initialValue?: D, options?: ReactiveOptions) {
    const Allocated = targetIsClass(
        class extends Forage<D> {
            constructor() {
                super(name, initialValue)
            }
        },
        options
    )
    return new Allocated()
}