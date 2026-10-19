/** Storage deliberately supports data objects, not class instances or branded built-ins. */
export declare function isStorageRoot(value: unknown): value is object;
/** Finish collecting the whole graph before encoding can fail on any one branch. */
export declare function scanStorage(root: object): void;
/** Canonical JSON of data descriptors only; never evaluate getters or toJSON. */
export declare function encodeStorage(root: object): string;
export declare function decodeStorage(value: unknown, root: object): {
    data: object;
    snapshot: string;
};
/** Prepare the complete patch before touching state; the caller applies it in one batch. */
export declare function prepareStorageRestore(root: object, data: object): {
    snapshot: string;
    apply(state: object): void;
};
