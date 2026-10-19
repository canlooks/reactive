import { type ChangeEvent, type ComponentProps, type ComponentType, type FunctionComponent, type ReactElement } from 'react';
export type ModelEvent<T> = T extends string ? ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> : T extends boolean ? ChangeEvent<HTMLInputElement> : T extends readonly string[] ? ChangeEvent<HTMLSelectElement> : never;
export interface UseModelReturn<T> {
    value: T;
    readonly onChange: (input: T | ModelEvent<T>) => void;
}
export declare function useModel<T>(initialValue: T): UseModelReturn<T>;
export interface ModelProps<T, A extends unknown[] = unknown[]> {
    source: () => T;
    children: ReactElement;
    postValue?: (...args: A) => T;
    valueProp?: 'value' | 'checked';
}
export declare const Model: <T, A extends unknown[] = unknown[]>(props: ModelProps<T, A>) => ReactElement;
export type ModelValue<P> = P[Extract<'value' | 'checked', keyof P>];
export type ModelChangeArgs<P> = 'onChange' extends keyof P ? NonNullable<P['onChange']> extends (...args: infer A) => unknown ? A : never : never;
export type DefinedModelProps<P> = Omit<P, 'refer' | 'ref' | 'valueProp' | 'value' | 'checked' | 'defaultValue' | 'defaultChecked' | 'onChange'> & {
    refer: () => ModelValue<P>;
    onChange?: P[Extract<'onChange', keyof P>];
    valueProp?: 'value' | 'checked';
};
export declare function defineModel<P extends object = ComponentProps<'input'>>(component: ComponentType<P> & (ModelValue<P> extends never ? never : ModelChangeArgs<P> extends never ? never : unknown), postValue?: (...args: ModelChangeArgs<P>) => ModelValue<P>): FunctionComponent<DefinedModelProps<P>>;
