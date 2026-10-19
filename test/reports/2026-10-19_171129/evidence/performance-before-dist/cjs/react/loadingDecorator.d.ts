export type LoadingSourceContext = Readonly<Record<PropertyKey, boolean | number>>;
export type LoadingMethodDecorator<C extends object = object> = <T extends C, M extends (this: T, ...args: never[]) => Promise<unknown>>(target: T, key: string | symbol, descriptor: TypedPropertyDescriptor<M>) => void;
export declare function loading(source: (ctx: LoadingSourceContext) => boolean | number): LoadingMethodDecorator;
export declare function loading<C extends object>(source: (ctx: C) => boolean | number): LoadingMethodDecorator<C>;
