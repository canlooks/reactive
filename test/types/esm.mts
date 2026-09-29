import type { Computed } from '@canlooks/reactive'
import { reactive, effect, computed, batch } from '@canlooks/reactive'

const state = reactive({ count: 1 })
const double: Computed<number> = computed(() => state.count * 2)
const stop: () => void = effect(() => { double.value })
const value: number = batch(() => ++state.count)
stop()
void value

@reactive()
class Store {
    static count = 0
    constructor(public count: number) {}
    increase(by: number): number { return this.count += by }
}

const store: Store = new Store(1)
const result: number = store.increase(2)
const staticValue: number = Store.count
void [result, staticValue]

// @ts-expect-error Object property types must survive package declaration resolution.
state.count = 'wrong'
// @ts-expect-error The batch result must keep its inferred type.
const invalid: string = batch(() => state.count)
void invalid
