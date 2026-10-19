import { storage } from '@canlooks/reactive'
import { RC, Chip, Model } from '@canlooks/reactive/react'

// 在客户端 render 之外创建一次。
const settings = storage({ count: 1, name: 'Alice' }, { name: 'settings' })
const Settings = RC(() => <>
    <span>{settings.count}</span>
    <Chip>{() => settings.name}</Chip>
    <Model source={() => settings.name}><input /></Model>
</>)

export const qa = {settings,Settings}
