const assert = require('node:assert/strict')

module.exports = function verifyPackage(api) {
    assert.deepEqual(Object.keys(api).sort(), ['batch', 'computed', 'effect', 'reactive', 'watch'])
    const { batch, computed, effect, reactive, watch } = api
    const state = reactive({ count: 1 })
    const double = computed(() => state.count * 2)
    assert.ok(Object.isFrozen(double))
    assert.equal(reactive(double), double)
    assert.equal(Reflect.set(double, 'value', 100), false)
    const seen = []
    const stop = effect(() => { seen.push([state.count, double.value]) })
    const changes = []
    const stopWatch = watch(() => double.value, (next, prev) => changes.push([next, prev]), { immediate: true })
    batch(() => { state.count = 2; state.count = 3 })
    batch(() => { state.count = 4; state.count = 3 })
    assert.deepEqual(seen, [[1, 2], [3, 6]])
    assert.deepEqual(changes, [[2, undefined], [6, 2]])
    stop()
    stopWatch()

    for (const decorate of [reactive, reactive()]) {
        const Store = decorate(class Store {
            static count = 1
            count = 1
            get double() { return this.count * 2 }
            increase() { this.count++; this.count++ }
            static increase() { this.count++; this.count++ }
        })
        const store = new Store()
        const instances = []
        const statics = []
        const stopInstance = effect(() => { instances.push([store.count, store.double]) })
        const stopStatic = effect(() => { statics.push(Store.count) })
        store.increase()
        Store.increase()
        assert.deepEqual(instances, [[1, 2], [3, 6]])
        assert.deepEqual(statics, [1, 3])
        assert.ok(store instanceof Store)
        stopInstance()
        stopStatic()
    }
}
