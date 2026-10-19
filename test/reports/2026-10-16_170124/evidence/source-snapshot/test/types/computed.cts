import { computed, reactive, watch, type Computed } from '@canlooks/reactive'

const scalar: Computed<number> = computed(() => 1)
const number: number = scalar.value
const chain: number = computed(() => scalar.value * 2).value
const object: Computed<{ name: string }> = computed(() => ({ name: 'A' }))
object.value.name = 'B' // Only the shell is readonly.
const missing: undefined = computed(() => undefined).value
const fn: () => string = computed(() => () => 'function data').value
const state = reactive({ count: 1, get double() { return this.count * 2 } })
const automatic: number = state.double
const nested: Computed<number> = reactive({ scalar }).scalar
watch(() => scalar.value, (next, prev) => { const number: number = next + prev; void number })
void [number, chain, missing, fn, automatic, nested]
// @ts-expect-error Computed values are not callable.
scalar()
// @ts-expect-error value is readonly.
scalar.value = 2
// @ts-expect-error watch still requires a reading function.
watch(scalar, () => {})
// @ts-expect-error Computed values retain their inferred result type.
const wrong: string = scalar.value
void wrong
