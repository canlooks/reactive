import {reactive,effect,computed,batch,watch,storage} from '@canlooks/reactive'
const list = reactive([1, 2, 3])
effect(() => console.log(list.length, list[2]))

batch(() => {
    list.push(4)
    list.pop()
}) // 完全恢复，不通知

batch(() => {
    list.length = 1
    list.length = 3
}) // 尾部元素已丢失，读取 list[2] 的消费者仍会收到通知

export const qa = {list}
