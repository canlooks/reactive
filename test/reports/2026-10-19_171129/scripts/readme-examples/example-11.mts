import { storage, batch, effect } from '@canlooks/reactive'

const state = storage({
    count: 1,
    profile: { name: 'Alice' },
    get double() { return this.count * 2 },
}, { name: 'settings' }) // 默认使用 window.localStorage

effect(() => console.log(state.count, state.double))
batch(() => {
    state.count++
    state.profile.name = 'Bob'
}) // 业务观察者完成后保存最终数据；double 不参与存储

const draft = storage(['first'], {
    name: 'draft',
    type: 'sessionStorage',
})
draft.push('second')

export const qa = {state,draft}
