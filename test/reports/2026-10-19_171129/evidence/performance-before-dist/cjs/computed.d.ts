export interface Computed<T> {
    readonly value: T;
}
export declare function isComputed(value: object): boolean;
/** Return a readonly, lazy value whose synchronous dependencies invalidate its cache. */
export declare function computed<T>(getter: () => T): Computed<T>;
