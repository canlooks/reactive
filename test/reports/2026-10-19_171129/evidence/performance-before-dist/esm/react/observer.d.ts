import { type ReadVersions, type ReadView } from '../effect.js';
import { PropsCell } from './props.js';
import type { CommitRegistration } from './commit.js';
export interface CommitWatch {
    prepare(): void;
    initialize(): void;
    finish(): void;
    stop(): void;
}
export interface RenderAttempt<P extends object = object> {
    props: P;
    view: ReadView;
    reads?: ReadVersions;
    watches: CommitWatch[];
    commits: CommitRegistration[];
    version: number;
    staleToken: symbol;
    sealed: boolean;
}
export declare function currentRender(): RenderAttempt | undefined;
/** All permanent subscriptions originate in commit/subscribe, never render. */
export declare class Observer<P extends object> {
    readonly props: PropsCell<P>;
    private node?;
    private listener?;
    private committed?;
    private version;
    private commitId;
    private mounted;
    constructor(props: P, wholeObject?: boolean);
    attempt(props: P): RenderAttempt<P>;
    render<T>(attempt: RenderAttempt<P>, fn: () => T): T;
    snapshot(attempt: RenderAttempt<P>): number | symbol;
    private connect;
    readonly subscribe: (listener: () => void) => (() => void);
    disconnect(retainListener?: boolean): void;
    commit(attempt: RenderAttempt<P>): void;
    private commitAttempt;
}
