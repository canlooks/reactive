import { computed } from '@canlooks/reactive'
import { Chip, AsyncChip, Model, defineModel, useLoading, useModel, useReactive, RC } from '@canlooks/reactive/react'

const TextInput = defineModel(props => <input {...props} />)
const Amount = defineModel((props: { value: number; onChange: (n: number, unit: string) => void; label: string }) =>
    <input aria-label={props.label} value={props.value} onChange={event => props.onChange(event.currentTarget.valueAsNumber, 'kg')} />,
    (value, unit) => value + unit.length)
const View = RC(() => {
    const data = useReactive({ name: 'Alice', count: 1 })
    const model = useModel('A')
    const { load, loading } = useLoading(async (id: number) => id)
    const double = computed(() => data.count * 2)
    return <>
        <Chip>{() => double.value}</Chip>
        <Chip.Strict>{() => data.name}</Chip.Strict>
        <AsyncChip fallback="waiting">{() => data.name}</AsyncChip>
        <AsyncChip.Strict>{() => data.count}</AsyncChip.Strict>
        <input value={model.value} onChange={model.onChange} />
        <Model source={() => data.name}><input /></Model>
        <Model source={() => data.count} postValue={(value: number) => value}><input /></Model>
        <TextInput refer={() => data.name} />
        <Amount refer={() => data.count} label="Amount" onChange={(value, unit) => { void [value, unit] }} />
        <button disabled={loading} onClick={() => { void load(42) }}>load</button>
    </>
})
void View
// @ts-expect-error Chip takes a render function.
const invalidChildren = <Chip>plain text</Chip>
// @ts-expect-error Missing Model source.
const missingSource = <Model><input /></Model>
// @ts-expect-error Wrong conversion result.
const wrongConversion = <Model source={() => 1} postValue={() => 'wrong'}><input /></Model>
// @ts-expect-error Missing refer.
const missingRefer = <TextInput />
// @ts-expect-error Missing business prop.
const missingLabel = <Amount refer={() => 1} />
// @ts-expect-error Controlled props are provided by refer.
const duplicateValue = <TextInput refer={() => 'A'} value="B" />
void [invalidChildren, missingSource, wrongConversion, missingRefer, missingLabel, duplicateValue]
