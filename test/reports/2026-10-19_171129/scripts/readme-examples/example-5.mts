import {reactive,effect,computed,batch,watch,storage} from '@canlooks/reactive'
const raw = { profile: { name: 'Alice' } }
const state = reactive(raw)

reactive(raw) === state // true
reactive(state) === state // true
state.profile === state.profile // true

effect(() => console.log(state.profile.name))
state.profile.name = 'Bob' // 通知
state.profile = { name: 'Carol' } // 通知，并切换到新对象的依赖

export const qa = {raw,state}
