import {reactive,effect,computed,batch,watch,storage} from '@canlooks/reactive'
const state = reactive({ count: 1 })
const stop = watch(() => state.count, (next, previous) => {
    console.log(previous, next)
}, { immediate: true }) // undefined, 1

batch(() => { state.count = 2; state.count = 3 }) // 1, 3
batch(() => { state.count = 4; state.count = 3 }) // 不通知
stop()

export const qa = {state,stop}
