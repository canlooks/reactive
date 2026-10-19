import { Component, createElement } from 'react'
import { RC, RCC, loading, type LoadingMethodDecorator, type LoadingSourceContext } from '@canlooks/reactive/react'
// @ts-expect-error loading belongs exclusively to the React subentry.
import { loading as coreLoading } from '@canlooks/reactive'

const symbol = Symbol('busy')
const shorthand: LoadingMethodDecorator = loading(ctx => ctx.busy)
const contextSource = (ctx: LoadingSourceContext): boolean | number => ctx[symbol]
void [shorthand, contextSource, coreLoading]

@RC
class View extends Component<{ label: string }> {
    static marker = 42
    busy = false
    stack = 0
    union: boolean | number = false;
    [symbol] = false

    @loading(ctx => ctx.busy)
    async fetch(id: number, suffix?: string) { return { id, suffix } }

    @loading<View>(ctx => ctx.stack)
    async generic<T>(value: T): Promise<T> { return value }

    @loading((ctx: View) => ctx.union)
    async rest(prefix: string, ...values: number[]) { return prefix + values.join(',') }

    @loading<View>(ctx => ctx[symbol])
    async symbolic() { return true }

    overloaded(value: string): Promise<string>
    overloaded(value: number): Promise<number>
    @loading((ctx: View) => ctx.stack)
    async overloaded(value: string | number) { return value }

    // @ts-expect-error Methods must return Promise; runtime JS also accepts values.
    @loading(ctx => ctx.busy)
    synchronous(value: number) { return value }

    // @ts-expect-error Field decorators do not receive a method descriptor.
    @loading(ctx => ctx.busy)
    arrow = async () => 1

    // @ts-expect-error A getter is not a Promise-returning method.
    @loading(ctx => ctx.busy)
    get getter() { return this.busy }

    override render() { return createElement('span', null, this.props.label, String(this.busy)) }
}

@RCC
class Derived extends View {
    @loading<Derived>(ctx => ctx.stack)
    override async fetch(id: number, suffix?: string) { return super.fetch(id, suffix) }
}

const instance = new Derived({ label: 'A' })
const result: Promise<{ id: number; suffix: string | undefined }> = instance.fetch(1)
const generic: Promise<{ id: number }> = instance.generic({ id: 1 })
const scalar: Promise<number> = instance.generic(1)
const rest: Promise<string> = instance.rest('A', 1, 2)
const bound: Promise<{ id: number; suffix: string | undefined }> = instance.fetch.bind(instance)(1, '!')
const overloadString: Promise<string> = instance.overloaded('one')
const overloadNumber: Promise<number> = instance.overloaded(1)
const marker: number = Derived.marker
const explicit: LoadingMethodDecorator<View> = loading<View>(ctx => ctx.busy)
void [result, generic, scalar, rest, bound, overloadString, overloadNumber, marker, explicit]
createElement(Derived, { label: 'A' })
// @ts-expect-error Required React props remain required.
createElement(Derived, {})
// @ts-expect-error Explicit source type checks field spelling.
loading<View>(ctx => ctx.missing)
// @ts-expect-error A source must return boolean or number.
loading<View>(ctx => ctx.props.label)
// @ts-expect-error Shorthand source must return boolean or number.
loading(() => 'wrong')
// @ts-expect-error The factory requires a function.
loading('busy')
// @ts-expect-error The factory requires its source.
loading()
// @ts-expect-error Method argument types survive decoration.
instance.fetch('wrong')
// @ts-expect-error Required method arguments survive decoration.
instance.fetch()
// @ts-expect-error Rest parameters retain their element type.
instance.rest('A', 'wrong')
// @ts-expect-error Generic Promise result remains inferred.
const wrongGeneric: Promise<string> = instance.generic(1)
void wrongGeneric
