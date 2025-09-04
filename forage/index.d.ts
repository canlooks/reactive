import {Autoload, ReactiveOptions} from '..'
import localforage from 'localforage'

declare namespace ReactiveForForage {
    class Forage<D = any, A = any> extends Autoload<D, A> {
        constructor(name: string, initialValue?: D | null, instance?: typeof localforage)
        loadData(...args: A[]): D | null | Promise<D | null>
        dispose(): void
    }

    function defineForage<D = any, A = any>(name: string, initialValue?: D, options?: ReactiveOptions): Forage<D, A>
}

export = ReactiveForForage