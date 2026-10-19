import type { Computed } from '@canlooks/reactive'
import api = require('@canlooks/reactive')

const { reactive, effect, computed, batch } = api
const state = reactive({ count: 1 })
const double: Computed<number> = computed(() => state.count * 2)
const stop: () => void = effect(() => { double.value })
const value: number = batch(() => ++state.count)
stop()
void value

@reactive
class Store {
    static count = 0
    constructor(public count: number) {}
    increase(by: number): number { return this.count += by }
}

const FactoryStore: typeof Store = reactive()(Store)
const store: Store = new FactoryStore(1)
const result: number = store.increase(2)
const staticValue: number = FactoryStore.count
void [result, staticValue]

// @ts-expect-error CommonJS consumers must receive checked types rather than any.
state.count = 'wrong'
// @ts-expect-error Constructor arguments must remain intact through the factory.
new FactoryStore('wrong')
