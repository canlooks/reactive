import {reactive,effect,computed,batch,watch,storage} from '@canlooks/reactive'
@reactive() // 也可写成 @reactive，效果相同
class Store {
    static count = 1

    static increase() {
        this.count++
        this.count++
    }

    constructor(public count = 1) {}

    get double() {
        return this.count * 2
    }

    increase(by = 1) {
        this.count += by
        this.count += by
        return this.count
    }

    roundTrip() {
        this.count++
        this.count--
    }
}

const store = new Store(1)
effect(() => console.log(store.count, store.double)) // 1 2
store.increase() // 一次通知：3 6；返回 3
store.roundTrip() // 不通知

effect(() => console.log(Store.count)) // 1
Store.increase() // 一次通知：3

export const qa = {Store,store}
