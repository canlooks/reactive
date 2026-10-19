import { watch, type WatchOptions } from '@canlooks/reactive'

watch(() => 1, (next, previous) => { const n: number = next + previous; void n })
watch(() => 1, (_next, previous) => { const n: number = previous; void n }, undefined)
watch(() => 1, (_next, previous) => { const n: number = previous; void n }, { immediate: false })
watch(() => 1, (_next, previous) => {
    const n: number | undefined = previous
    // @ts-expect-error Immediate listeners must handle missing oldValue.
    const invalid: number = previous
    void [n, invalid]
}, { immediate: true })
const flag: boolean = Math.random() > 0.5
const config: WatchOptions = { immediate: flag }
const optionalConfig: WatchOptions | undefined = flag ? config : undefined
for (const options of [config, optionalConfig, { immediate: flag }]) {
    watch(() => ({ count: 1 }), (next, previous) => {
        const n: number | undefined = previous?.count
        // @ts-expect-error General options may request an immediate callback.
        const invalid: number = previous.count
        void [next.count, n, invalid]
    }, options)
}
watch(() => {}, (next, previous) => { const values: void[] = [next, previous]; void values })
// @ts-expect-error Options require a boolean.
watch(() => 1, () => {}, { immediate: 'true' })
// @ts-expect-error Callback values must match the source.
watch(() => 1, (_next: string) => {})
