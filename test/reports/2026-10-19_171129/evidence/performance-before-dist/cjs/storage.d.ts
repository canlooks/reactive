export interface StorageAdapter {
    getItem(key: string): string | null | PromiseLike<string | null>;
    setItem(key: string, value: string): void | PromiseLike<void>;
}
export interface StorageOptions {
    name: string;
    /** Defaults to localStorage; a supplied adapter takes precedence. */
    type?: 'localStorage' | 'sessionStorage';
    adapter?: StorageAdapter;
}
/** Create a reactive data object with automatic, ordered JSON persistence. */
export declare function storage<T extends object>(initialState: T, options: StorageOptions): T;
/** Internal lifecycle cleanup; intentionally absent from the public entry. */
export declare function stopStorage(state: object): void;
