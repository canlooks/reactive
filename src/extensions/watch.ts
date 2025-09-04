import {ReactorOptions} from '../..'
import {reactor} from '../api'
import {registerDecorator} from '../core/decoratorHelper'

export function watch<T = any, V = any>(refer: (context: T) => any, options?: ReactorOptions) {
    return (prototype: Object, p: PropertyKey, descriptor: TypedPropertyDescriptor<(newValue?: V, oldValue?: V) => any>) => {
        registerDecorator(prototype, ({proxy}) => {
            return reactor(
                () => refer(proxy),
                (newValue, oldValue) => {
                    descriptor.value!.call(proxy, newValue, oldValue)
                },
                options
            )
        })
    }
}