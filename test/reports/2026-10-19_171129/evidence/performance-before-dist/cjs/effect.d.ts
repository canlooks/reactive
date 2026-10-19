export type Dep = Set<EffectNode>;
export interface ChangeSource {
    owner: object;
    commit: number;
}
export type ReadVersions = Map<Dep, number>;
export type ChangeReceipt = Map<Dep, {
    before: number;
    after: number;
}>;
export interface CandidateComputation {
    value: unknown;
    reads: ReadVersions;
    consumers: Dep;
    adopt: () => void;
}
export interface ReadView {
    values: Map<object, object>;
    changed: Set<Dep>;
    computations: Map<EffectNode, CandidateComputation>;
    evaluating: Set<EffectNode>;
}
export interface EffectNode<T = unknown> {
    fn: () => T;
    deps: Dep[];
    active: boolean;
    running: boolean;
    hasRun: boolean;
    afterRun?: () => void;
    notify?: () => void;
    computed?: {
        consumers: Dep;
        invalidate: () => void;
    };
}
export type PropertyState = {
    kind: 'absent';
} | {
    kind: 'data';
    value: unknown;
} | {
    kind: 'accessor';
    get: PropertyDescriptor['get'];
    set: PropertyDescriptor['set'];
};
export declare function createEffectNode<T>(fn: () => T): EffectNode<T>;
export declare function getDep(target: object, key: PropertyKey): Dep;
export declare function depVersion(dep: Dep): number;
export declare function readsAreCurrent(reads: ReadVersions): boolean;
export declare function acknowledgeReads(reads: ReadVersions, receipt: ChangeReceipt): void;
export declare function captureDependencies<T>(fn: () => T): {
    value: T;
    reads: ReadVersions;
};
export declare function withReadView<T>(view: ReadView, fn: () => T): T;
export declare function getReadView(): ReadView | undefined;
export declare function isSubscriptionRead(): boolean;
/** React must see its own raw props when a notification reenters the renderer. */
export declare function outsideReadContext<T>(fn: () => T): T;
export declare function registerComputed(dep: Dep, node: EffectNode): void;
export declare function hasViewChanges(node: EffectNode, view: ReadView, seen?: Set<EffectNode<unknown>>): boolean;
export declare function replaceDeps(node: EffectNode, deps: Iterable<Dep>): void;
export declare function runEffect<T>(node: EffectNode<T>): T;
export declare function trackDep(dep: Dep): void;
export declare function track(target: object, key: PropertyKey): void;
/** Internal deep observers subscribe without changing public enumeration semantics. */
export declare function trackObjectChanges(target: object): void;
export declare function stopEffect(node: EffectNode): void;
export declare function isEffectPending(node: EffectNode): boolean;
export declare function enqueueEffect(node: EffectNode, source?: ChangeSource): void;
/** Isolate callback reads, including reads from an enclosing effect. */
export declare function untracked<T>(fn: () => T): T;
/** Commit-only integration phases, shared with an enclosing public batch. */
export declare function onBatchSettled(owner: object, before: () => void, after: () => void): void;
/** Deduplicate passive work after ordinary notifications, including an enclosing batch. */
export declare function afterEffectsSettled(owner: object, callback: () => void): void;
export declare function acknowledgeNotification(node: EffectNode, owner: object, commit: number): void;
/** Run immediately, collect synchronous reads, and return an idempotent disposer. */
export declare function effect(fn: () => void): () => void;
export declare function samePropertyState(a: PropertyState, b: PropertyState): boolean;
export declare function recordChange(target: object, key: PropertyKey, before: PropertyState, readCurrent: () => PropertyState, source?: ChangeSource, receipt?: ChangeReceipt): void;
export declare function runInBatch<T>(fn: () => T): T;
