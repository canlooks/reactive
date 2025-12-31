import {Autoload, ReactiveOptions} from '..'
import localforage from 'localforage'

declare namespace ReactiveForForage {
    class Forage<D = any, A = any> extends Autoload<D, A> {
        constructor(name: string, initialValue?: D, instance?: typeof localforage)
        loadData(...args: A[]): D | Promise<D>
        dispose(): void
    }

    function defineForage<D = any, A = any>(name: string, initialValue?: D, options?: ReactiveOptions): Forage<D, A>
}

export = ReactiveForForage