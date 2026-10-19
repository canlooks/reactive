import { type FunctionComponent, type NamedExoticComponent, type ReactElement, type ReactNode } from 'react';
export interface ChipProps {
    children: () => ReactNode;
}
export interface AsyncChipProps extends ChipProps {
    fallback?: ReactNode;
}
export declare const Chip: FunctionComponent<ChipProps> & {
    readonly Strict: NamedExoticComponent<ChipProps>;
};
export declare const AsyncChip: FunctionComponent<AsyncChipProps> & {
    readonly Strict: NamedExoticComponent<AsyncChipProps>;
};
export declare function chip(render: () => ReactNode): ReactElement;
export declare function strictChip(render: () => ReactNode): ReactElement;
export declare function asyncChip(render: () => ReactNode): ReactElement;
export declare function asyncStrictChip(render: () => ReactNode): ReactElement;
