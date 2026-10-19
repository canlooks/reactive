import {useWatch,useReactive,RC} from '@canlooks/reactive/react'
export const Example=RC(()=>{const local=useReactive({clicks:0});
useWatch(() => local.clicks, (next, previous) => {
    // previous 在 immediate 模式下可能为 undefined
    console.log(previous, next)
}, { immediate: true })

return <button onClick={()=>local.clicks++}>{local.clicks}</button>})
export const qa = {Example}
