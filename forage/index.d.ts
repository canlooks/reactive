import {Autoload, ReactiveOptions} from '..'

declare namespace ReactiveForForage {
    class Forage<D = any, A = any> extends Autoload<D, A> {
        constructor(name: string, initialValue?: D)
        loadData(...args: A[]): D | Promise<D>
    }

    function defineForage<D = any, A = any>(name: string, initialValue?: D, options?: ReactiveOptions): Forage<D, A>
}

export = ReactiveForForage