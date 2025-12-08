declare namespace Reactive {
    type Fn<R = any, A = any, T = any> = (this: T, ...args: A[]) => R
    type Obj<T = any> = {[P in PropertyKey]: T}
    type ClassType<T = any, A = any> = new (...args: A[]) => T

    type ReactiveOverload = {
        <T extends object>(target: T, options?: ReactiveOptions): T
        (): <T extends Function>(target: T) => T
        deep: ReactiveOverload
    }

    const reactive: ReactiveOverload
    const reactiveClass: ReactiveOverload
    const reactiveObject: ReactiveOverload

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

    abstract class Autoload<DATA = any, ARGUMENT = any> {
        loading: boolean
        data: DATA | undefined
        setData(v: DATA | undefined): void
        abstract loadData(...args: ARGUMENT[]): DATA | undefined | Promise<DATA | undefined>
        onLoad?(): void
        update(...args: ARGUMENT[]): Promise<DATA | undefined>
    }

    function defineAutoload<DATA = any, ARGUMENT = any>(loadData: (...args: ARGUMENT[]) => DATA | undefined | Promise<DATA | undefined>, options?: ReactiveOptions): Autoload<DATA, ARGUMENT>

    /**
     * ----------------------------------------------------------------------
     * extensions - storage
     */

    type StorageEngine<T> = {
        setItem(key: string, value: T): void
        getItem(key: string): T | undefined | null
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

    /**
     * ----------------------------------------------------------------------
     * extensions - async storage
     */

    type AsyncStorageEngine<T> = {
        setItem(key: string, value: T): | Promise<void>
        getItem(key: string): Promise<T | undefined | null>
        removeItem(key: string): Promise<void>
    }

    function registerAsyncStorageEngine<T = any>(engine: AsyncStorageEngine<T> | undefined): void

    interface AsyncStorageOptions extends ReactiveOptions {
        debounce?: number
    }

    function defineAsyncStorage<T extends object>(name: string, initialValues?: T, options?: AsyncStorageOptions): Promise<T>
}

export = Reactive