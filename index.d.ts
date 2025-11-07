declare namespace Reactive {
    type Fn<R = any, A = any, T = any> = (this: T, ...args: A[]) => R
    type Obj<T = any> = {[P in PropertyKey]: T}
    type ClassType<T = any, A = any> = new (...args: A[]) => T

    type ClassDecorator = <T extends Function>(target: T) => T
    type ReactiveOverload = {
        <T extends object>(target: T): T
        (): ClassDecorator
    }

    const reactive: ReactiveOverload & {
        deep: ReactiveOverload
    }

    type ReactiveOptions = {
        deep?: boolean
    }

    type ReactorOptions = {
        once?: boolean
        immediate?: boolean
    }

    function autorun(fn: () => void): void

    function reactor<T>(refer: () => T, effect: (newValue: T, oldValue?: T) => void, options?: ReactorOptions): () => void

    function action<F extends Fn>(fn: F): F

    function act<R>(fn: () => R): R

    function getOriginalObject<T extends object>(proxy: T): T

    type PropertyDecorator = (target: Object, propertyKey: PropertyKey) => void

    const ignore: PropertyDecorator & (() => PropertyDecorator)

    /**
     * ----------------------------------------------------------------------
     * extensions - watch & loading
     */

    type MethodDecorator<T> = (target: Object, propertyKey: PropertyKey, descriptor: TypedPropertyDescriptor<T>) => TypedPropertyDescriptor<T> | void

    function watch<T = any, V = any>(refer: (context: T) => any, options?: ReactorOptions): MethodDecorator<(newValue?: V, oldValue?: V) => any>

    function loading<T extends Object = any>(refer: (this: T, context: T, ...args: any[]) => any): MethodDecorator<Fn<Promise<any>>>

    /**
     * ----------------------------------------------------------------------
     * extensions - autoload
     */

    abstract class Autoload<D = any, A = any> {
        loading: boolean
        data: D | undefined
        setData(v: D | undefined): void
        abstract loadData(...args: A[]): D | undefined | Promise<D | undefined>
        onLoad?(): void
        update(...args: A[]): Promise<D | undefined>
    }

    function defineAutoload<D = any, A = any>(loadData: (...args: A[]) => D | Promise<D>, options?: ReactiveOptions): Autoload<D, A>

    /**
     * ----------------------------------------------------------------------
     * extensions - storage
     */

    type StorageEngine<T> = {
        setItem(key: string, value: T): void
        getItem(key: string): T | undefined
        removeItem(key: string): void
    }

    function registerStorageEngine<T = any>(engine: StorageEngine<T> | undefined): void

    interface StorageOptions extends ReactiveOptions {
        /** @default 'localStorage' */
        mode?: 'localStorage' | 'sessionStorage'
        /** Perform synchronization after nexttick. @default true */
        async?: boolean
        debounce?: number
    }

    function defineStorage<T extends object>(name: string, initialValues?: T, options?: StorageOptions): T
}

export = Reactive