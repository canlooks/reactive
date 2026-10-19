import { Component, createElement, type ChangeEvent, type NamedExoticComponent, type ReactElement } from 'react'
import { computed, type Computed } from '@canlooks/reactive'
import {
    RC, Chip, AsyncChip, chip, strictChip, asyncChip, asyncStrictChip, useReactive, useWatch,
    useModel, Model, defineModel, useLoading, type ChipProps, type AsyncChipProps,
    type ModelValue, type ModelChangeArgs, type DefinedModelProps, type UseModelReturn,
} from '@canlooks/reactive/react'

const state = useReactive({ count: 1, name: 'A' })
const list: number[] = useReactive([1, 2])
const strict: NamedExoticComponent<ChipProps> = Chip.Strict
const asyncStrict: NamedExoticComponent<AsyncChipProps> = AsyncChip.Strict
const derived: Computed<number> = computed(() => state.count * 2)
const View = RC(() => {
    useWatch(() => derived.value, (next, previous) => { const n: number = next + previous; void n })
    return chip(() => derived.value)
})
const elements: ReactElement[] = [chip(() => state.name), strictChip(() => null), asyncChip(() => 1), asyncStrictChip(() => [1, 2])]
void [list, strict, asyncStrict, View, elements]
// @ts-expect-error A computed value is not itself a watch source.
useWatch(derived, () => {})
// @ts-expect-error Factory children must be a function.
chip('text')
// @ts-expect-error Reactive local state requires an object.
useReactive(1)

declare const inputEvent: ChangeEvent<HTMLInputElement>
declare const textEvent: ChangeEvent<HTMLTextAreaElement>
declare const selectEvent: ChangeEvent<HTMLSelectElement>
const text: UseModelReturn<string> = useModel('A')
text.onChange(inputEvent)
text.onChange(textEvent)
text.onChange(selectEvent)
text.onChange('B')
const boolean = useModel(true)
boolean.onChange(false)
boolean.onChange(inputEvent)
const multiple = useModel<string[]>([])
multiple.onChange(['a'])
multiple.onChange(selectEvent)
const number = useModel(1)
number.onChange(2)
const fn = useModel(() => 1)
const keptFunction: () => number = fn.value
void keptFunction
// @ts-expect-error Numeric models require explicit conversion.
number.onChange(inputEvent)
// @ts-expect-error Text values retain their type.
text.onChange(2)
// @ts-expect-error Boolean model events come from an input.
boolean.onChange(selectEvent)
// @ts-expect-error onChange is readonly.
text.onChange = () => {}

const TextInput = defineModel(props => createElement('input', props))
createElement(TextInput, { refer: () => state.name, placeholder: 'Name' })
type ControlProps = { value: number; onChange: (value: number, unit: string) => void; label: string; optional?: boolean }
const Control = (props: ControlProps) => createElement('span', null, props.label, props.value)
const NumberInput = defineModel(Control, (value, unit) => { const suffix: string = unit; void suffix; return value * 2 })
class ClassControl extends Component<ControlProps> { override render() { return this.props.value } }
const ClassInput = defineModel(ClassControl, (value, unit) => value + unit.length)
createElement(ClassInput, { label: 'Class amount', refer: () => state.count })
const props: DefinedModelProps<ControlProps> = { label: 'Amount', refer: () => state.count, onChange: (value, unit) => { void [value, unit] } }
const value: ModelValue<ControlProps> = 2
const args: ModelChangeArgs<ControlProps> = [2, 'kg']
void [props, value, args]
createElement(NumberInput, props)
createElement(Model<number, [number, string]>, { source: () => state.count, postValue: (value, unit) => value + unit.length, children: createElement('input') })
// @ts-expect-error refer must match the declared control value.
createElement(NumberInput, { label: 'Amount', refer: () => 'wrong' })
// @ts-expect-error Business props remain required.
createElement(NumberInput, { refer: () => 1 })
// @ts-expect-error Missing refer.
createElement(NumberInput, { label: 'Amount' })
// @ts-expect-error postValue must produce a compatible model value.
defineModel(Control, () => 'wrong')
// @ts-expect-error Complete event tuples retain parameter types.
defineModel(Control, (value: string) => value.length)
// @ts-expect-error Components must declare a controlled field and onChange.
defineModel((props: { label: string }) => createElement('span', null, props.label))
// @ts-expect-error Having value without onChange is not a control protocol.
defineModel((props: { value: string }) => createElement('span', null, props.value))

const loading = useLoading(async (id: number, label: string) => ({ id, label }))
const result: Promise<{ id: number; label: string }> = loading.load(1, 'A')
const flag: boolean = loading.loading
const numeric = useLoading((value: number) => value, 2)
const count: number = numeric.loading
const scalar: Promise<number> = numeric.load(1)
const stacks: number = numeric.stacksCount
const initiallyTrue: boolean = useLoading(() => 1, true).loading
const initiallyFalse: boolean = useLoading(() => 1, false).loading
const zero: number = useLoading(() => 1, 0).loading
declare const initial: boolean | number | undefined
const union: boolean | number = useLoading(() => Promise.resolve(1), initial).loading
void [result, flag, count, scalar, stacks, initiallyTrue, initiallyFalse, zero, union]
// @ts-expect-error load retains its argument tuple.
loading.load('wrong', 1)
// @ts-expect-error load requires all function arguments.
loading.load(1)
// @ts-expect-error The default mode is boolean.
const wrongNumber: number = loading.loading
// @ts-expect-error The number mode is number.
const wrongBoolean: boolean = numeric.loading
// @ts-expect-error Number literals widen because counts change.
const wrongLiteral: 2 = numeric.loading
// @ts-expect-error Boolean literals widen because loading changes.
const wrongTrue: true = useLoading(() => 1, true).loading
// @ts-expect-error Published state is readonly.
loading.stacksCount = 1
void [wrongNumber, wrongBoolean, wrongLiteral, wrongTrue]
