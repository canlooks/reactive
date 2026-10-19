import { type ChangeReceipt, type ChangeSource, type ReadView } from '../effect.js';
export declare function shallowEqual(a: object, b: object): boolean;
/** React owns the original objects; this cell owns only a shallow reading view. */
export declare class PropsCell<P extends object> {
    readonly wholeObject: boolean;
    committed: P;
    readonly proxy: P;
    private initialized;
    constructor(initial: P, wholeObject?: boolean);
    current(): P;
    readSlot(): P;
    hasSlotConsumers(): boolean;
    view(incoming: P): ReadView;
    publish(incoming: P, source: ChangeSource): ChangeReceipt;
}
