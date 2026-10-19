/** Delay notifications until this synchronous callback's outermost batch finishes. */
export declare function batch<T>(fn: () => T): T;
