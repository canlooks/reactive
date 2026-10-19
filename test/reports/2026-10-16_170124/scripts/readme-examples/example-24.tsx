import { RC, useLoading, useReactive } from '@canlooks/reactive/react'

export const UserLoader = RC(() => {
    const state = useReactive({ name: '', error: '' })
    const { load, loading, stacksCount } = useLoading(async (id: number) => {
        const response = await fetch(`/api/user/${id}`)
        if (!response.ok) throw new Error(`请求失败: ${response.status}`)
        const user: { name: string } = await response.json()
        return user.name
    })
    return <div>
        <button disabled={loading} onClick={() => {
            state.error = ''
            void load(42).then(name => { state.name = name }).catch(error => {
                state.error = String(error)
            })
        }}>加载用户</button>
        <p>{loading ? `加载中 (${stacksCount})` : state.name}</p>
        <p>{state.error}</p>
    </div>
})

export const qa = {UserLoader}
