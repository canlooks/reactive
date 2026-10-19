/** Internal identity normalization; not part of the package API. */
export declare function toRaw<T>(value: T): T;
/** Lazily proxy an object, array, or user class while preserving its public type. */
export declare function reactive<T extends object>(target: T): T;
/** Create a decorator for the equivalent @reactive() syntax. */
export declare function reactive(): <T extends object>(target: T) => T;
