import {RefObject, useEffect, useMemo, useRef} from 'react'

/**
 * 得到一个RefObject，用于判断组件是否卸载
 * @param onUnmount 回调函数，卸载时触发
 */
export function useUnmounted(onUnmount?: () => void) {
    const isUnmounted = useRef(false)
    const mountTimes = useRef(0)

    useMemo(() => {
        mountTimes.current++
    }, [])

    useEffect(() => {
        // 在<Activity/>组件中，组件可以重新激活
        isUnmounted.current = false

        return () => {
            if (!--mountTimes.current) {
                isUnmounted.current = true
                onUnmount?.()
            }
        }
    }, [])

    return isUnmounted
}

/**
 * 将某个值同步进ref
 */
export function useSync<T>(value: T): RefObject<T> {
    const sync = useRef<T>(value)
    sync.current = value
    return sync
}

/**
 * 使用某个固定的值
 */
export function useSettledValue<T>(value: T | (() => T)): T {
    const isSettled = useRef(false)
    const settledValue = useRef<T>(void 0)

    if (!isSettled.current) {
        isSettled.current = true
        settledValue.current = typeof value === 'function' ? (value as Function)() : value
    }

    return settledValue.current!
}

/**
 * 使用外部类，该方法可避免`StrictMode`下，React渲染行为与外部类实例生命周期不同步的问题
 */
export function useExternalClass<T>(setup: () => T, cleanup?: (instance: T) => void): RefObject<T> {
    const instance = useRef<T>(void 0)
    instance.current ||= setup()

    useUnmounted(() => {
        cleanup?.(instance.current!)
        instance.current = void 0
    })

    return instance as RefObject<T>
}