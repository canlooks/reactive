import { type WatchOptions } from '../watch.js';
export declare function useReactive<T extends object>(initialState: T): T;
export declare function useWatch<T>(source: () => T, callback: (newValue: T, oldValue: T) => void, options?: WatchOptions & {
    immediate?: false;
}): void;
export declare function useWatch<T>(source: () => T, callback: (newValue: T, oldValue: T | undefined) => void, options?: WatchOptions): void;
