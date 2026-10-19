export interface WatchOptions {
    immediate?: boolean;
}
/** Internal lifecycle handle; creation does not execute user code. */
export declare function createWatch<T>(source: () => T, callback: (newValue: T, oldValue: T | undefined) => void, options?: WatchOptions): {
    node: import("./effect.js").EffectNode<void>;
    readonly revision: number;
    initialize(): void;
    update(nextSource: () => T, nextCallback: (next: T, previous: T | undefined) => void): void;
    refresh(): void;
    stop(): void;
};
export type WatchHandle<T> = ReturnType<typeof createWatch<T>>;
export declare function watch<T>(source: () => T, callback: (newValue: T, oldValue: T) => void, options?: WatchOptions & {
    immediate?: false;
}): () => void;
export declare function watch<T>(source: () => T, callback: (newValue: T, oldValue: T | undefined) => void, options?: WatchOptions): () => void;
