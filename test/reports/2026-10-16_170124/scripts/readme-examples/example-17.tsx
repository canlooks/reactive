import { PureComponent } from 'react'
import { RC } from '@canlooks/reactive/react'

@RC // 也可以用 @RCC；组件包装不提供无参装饰器工厂
class Counter extends PureComponent {
    count = 0
    data = { clicks: 0 }

    render() {
        return <button onClick={() => { this.count++; this.data.clicks++ }}>
            {this.count} / {this.data.clicks}
        </button>
    }
}

export const qa = {Counter}
