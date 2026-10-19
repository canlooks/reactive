import {reactive,effect,computed,batch,watch,storage} from '@canlooks/reactive'
const state = reactive({ enabled: true, a: 1, b: 10 })
const stop = effect(() => {
    console.log(state.enabled ? state.a : state.b)
})

state.enabled = false // 输出 10
state.a = 2 // 不输出
state.b = 20 // 输出 20
stop()

export const qa = {state,stop}
