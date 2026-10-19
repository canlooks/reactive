import { useLayoutEffect } from 'react';
export declare function useCommitEffect(...args: Parameters<typeof useLayoutEffect>): void;
export interface CommitRegistration {
    apply(): void;
    publish(): void;
    stop(): void;
}
export interface CommittedRef<T> {
    current?: T;
    active: boolean;
}
/** Register a candidate without exposing it to events until this render commits. */
export declare function useCommittedRef<T>(value: T, publish?: () => void): CommittedRef<T>;
