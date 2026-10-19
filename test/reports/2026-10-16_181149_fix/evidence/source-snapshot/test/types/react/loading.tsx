import { Component } from 'react'
import { RC, loading } from '@canlooks/reactive/react'

@RC
class Index extends Component<{ id: number }> {
    busy = false
    stack = 0

    @loading(ctx => ctx.busy)
    async fetchData() { return { id: this.props.id } }

    @loading<Index>(ctx => ctx.stack)
    async concurrentTask(id: number, suffix?: string) { return `${id}${suffix ?? ''}` }

    override render() {
        return <button disabled={this.busy} onClick={() => {
            void this.fetchData().then(value => { const id: number = value.id; void id }).catch(() => {})
        }}>{this.stack}</button>
    }
}

const element = <Index id={42} />
// @ts-expect-error Required component props are retained.
const missing = <Index />
// @ts-expect-error JSX prop types are retained.
const wrong = <Index id="wrong" />
void [element, missing, wrong]
