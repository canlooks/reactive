import {RC,useWatch} from '@canlooks/reactive/react'
const View = RC((props: { count: number }) => {
    useWatch(() => props.count, (next, previous) => console.log(previous, next))
    return <div /> // 即使 JSX 没读 count，父级 1 → 2 提交后也会回调 (2, 1)
})

export const qa = {View}
