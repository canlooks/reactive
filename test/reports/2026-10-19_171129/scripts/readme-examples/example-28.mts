import {reactive,effect,computed,batch,watch,storage} from '@canlooks/reactive'
const state = reactive({ count: 0 })

const pending = batch(async () => {
    state.count++
    state.count++ // 前两次写入统一通知

    await Promise.resolve()

    batch(() => {
        state.count++
        state.count++ // 新批次，再通知一次
    })
})

await pending

export const qa = {state,pending}
