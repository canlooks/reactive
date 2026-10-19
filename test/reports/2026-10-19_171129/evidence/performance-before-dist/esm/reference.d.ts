export declare function recordReferenceRead<T>(receiver: object, rawTarget: object, key: PropertyKey, value: T, descriptor?: PropertyDescriptor): T;
export declare function markDerivedRead(): void;
export declare function withoutReferenceCapture<T>(fn: () => T): T;
export interface WritableReference<T> {
    readonly value: T;
    write(value: T): void;
}
export declare function captureReference<T>(selector: () => T): WritableReference<T>;
