import {reactive,effect,computed,batch,watch,storage} from '@canlooks/reactive'
const state = reactive({ count: 1, message: 'hello' })
const double = computed(() => state.count * 2)

const result = batch(() => {
    state.count = 2
    console.log(double.value) // 立即得到 4
    batch(() => {
        state.count = 3
        state.message = 'hi'
    }) // 内层结束不通知
    return state.count
}) // 最外层结束，统一通知后返回 3

export const qa = {state,double,result}
