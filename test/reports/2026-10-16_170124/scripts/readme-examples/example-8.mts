import {reactive,effect,computed,batch,watch,storage} from '@canlooks/reactive'
const state = reactive({
    count: 1,
    get double() {
        return this.count * 2
    },
    set double(value: number) {
        this.count = value / 2
    },
})

effect(() => console.log(state.double)) // 2
state.double = 8 // count 变为 4，输出 8

export const qa = {state}
