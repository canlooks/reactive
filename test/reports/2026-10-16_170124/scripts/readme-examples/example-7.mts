import {reactive,effect,computed,batch,watch,storage} from '@canlooks/reactive'
const state = reactive({ count: 1 })
const double = computed(() => state.count * 2)
const label = computed(() => `double: ${double.value}`)

double.value // 2，首次计算
double.value // 2，复用缓存
state.count = 2 // 使缓存失效
label.value // 'double: 4'

watch(() => double.value, (next, previous) => console.log(previous, next))

export const qa = {state,double,label}
