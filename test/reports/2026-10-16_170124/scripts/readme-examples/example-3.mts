import {reactive,effect,computed,batch,watch,storage} from '@canlooks/reactive'
const state = reactive({ count: 1, message: 'hello' })
const double = computed(() => state.count * 2)

const stop = effect(() => {
    console.log(state.count, double.value)
}) // 立即输出：1 2

state.count = 2 // 同步输出：2 4

batch(() => {
    state.count = 3
    state.count = 4
}) // 结束前只输出一次：4 8

batch(() => {
    state.count = 5
    state.count = 4
}) // 回到批次初值，不输出

stop() // 停止订阅；重复调用也安全
state.count = 6 // 不再输出

export const qa = {state,double,stop}
