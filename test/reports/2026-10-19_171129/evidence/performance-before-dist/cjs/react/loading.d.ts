export interface UseLoadingReturn<A extends unknown[], R, L extends boolean | number> {
    readonly load: (...args: A) => Promise<Awaited<R>>;
    readonly loading: L;
    readonly stacksCount: number;
}
export declare function useLoading<A extends unknown[], R>(fn: (...args: A) => R, initialLoading?: boolean): UseLoadingReturn<A, R, boolean>;
export declare function useLoading<A extends unknown[], R>(fn: (...args: A) => R, initialLoading: number): UseLoadingReturn<A, R, number>;
export declare function useLoading<A extends unknown[], R>(fn: (...args: A) => R, initialLoading: boolean | number | undefined): UseLoadingReturn<A, R, boolean | number>;
