const assert = require('node:assert/strict')

module.exports = function verifyPackage(api) {
    assert.deepEqual(Object.keys(api).sort(), ['batch', 'computed', 'effect', 'reactive', 'storage', 'watch'])
    const { batch, computed, effect, reactive, storage, watch } = api
    let record = '{"count":2}'
    let reads = 0
    let writes = 0
    const adapter = {
        getItem() { assert.equal(this, adapter); reads++; return record },
        setItem(_key, value) { assert.equal(this, adapter); writes++; record = value },
    }
    const raw = { count: 0, nested: {} }
    const saved = storage(raw, { name: 'smoke', adapter })
    assert.equal(saved, reactive(raw))
    assert.equal(saved.count, 2)
    assert.equal(writes, 0)
    assert.equal(storage(saved, { name: 'smoke', adapter }), saved)
    assert.equal(reads, 1)
    batch(() => { saved.count++; saved.nested.added = true })
    assert.equal(record, '{"count":3,"nested":{"added":true}}')
    assert.equal(writes, 1)
    batch(() => { saved.count++; saved.count-- })
    assert.equal(writes, 1)
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
