import { Component } from 'react'
import { RC, loading } from '@canlooks/reactive/react'

@RC
export class DataLoader extends Component {
    busy = false
    stack = 0
    name = ''
    error = ''

    @loading(ctx => ctx.busy)
    async fetchData(id: number) {
        const response = await fetch(`/api/user/${id}`)
        if (!response.ok) throw new Error(`请求失败: ${response.status}`)
        const user: { name: string } = await response.json()
        this.name = user.name
        return user
    }

    @loading<DataLoader>(ctx => ctx.stack)
    async concurrentTask() {
        const response = await fetch('/api/data')
        if (!response.ok) throw new Error(`请求失败: ${response.status}`)
        return response.text()
    }

    render() {
        return <div>
            <button disabled={this.busy} onClick={() => {
                this.error = ''
                void this.fetchData(42).catch(error => { this.error = String(error) })
            }}>加载用户</button>
            <button onClick={() => {
                void this.concurrentTask().catch(error => { this.error = String(error) })
            }}>启动并发任务</button>
            <p>{this.busy ? '加载中' : this.name} / 进行中：{this.stack}</p>
            <p>{this.error}</p>
        </div>
    }
}

export const qa = {DataLoader}
