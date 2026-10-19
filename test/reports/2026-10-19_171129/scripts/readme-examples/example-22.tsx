import { RC, Model, defineModel, useModel, useReactive } from '@canlooks/reactive/react'

const TextInput = defineModel(props => <input {...props} />)

export const Form = RC(() => {
    const name = useModel('Alice')
    const enabled = useModel(false)
    const data = useReactive({ nickname: 'Bob' })
    return <div>
        <input value={name.value} onChange={name.onChange} />
        <input type="checkbox" checked={enabled.value} onChange={enabled.onChange} />
        <p>{name.value}: {String(enabled.value)}</p>
        <Model source={() => data.nickname}><input /></Model>
        <TextInput refer={() => data.nickname} placeholder="昵称" />
    </div>
})

export const qa = {TextInput,Form}
