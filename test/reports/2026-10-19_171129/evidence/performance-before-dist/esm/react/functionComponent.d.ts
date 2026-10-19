import { type FunctionComponent, type NamedExoticComponent } from 'react';
export declare function createObserverComponent<P extends object>(component: FunctionComponent<P>): {
    (props: P): Promise<import("react").ReactNode> | import("react").ReactNode;
    displayName: string;
};
export declare function ReactiveFunctionComponent<P extends object>(component: FunctionComponent<P>): NamedExoticComponent<P>;
