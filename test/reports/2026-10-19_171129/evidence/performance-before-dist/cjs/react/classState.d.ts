export declare const reactMethods: Set<PropertyKey>;
export interface ClassField {
    readonly key: PropertyKey;
    readonly writable: boolean;
    read(): unknown;
    publish(value: unknown): void;
    assertValid(): void;
    validateWrite?: (value: unknown, current: unknown) => void;
}
export declare class ClassState {
    readonly fields: Map<PropertyKey, ClassField>;
    readonly reconnect: Set<() => void>;
    connected: boolean;
    connect(): void;
    disconnect(): void;
}
export declare function getClassState(instance: object): ClassState | undefined;
/** Keep React's instance (and private-field brand); bridge only user data. */
export declare function installClassState(instance: object): ClassState;
