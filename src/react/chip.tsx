import {createElement, memo, ReactNode, useEffect, useState} from 'react'
import {useRenderEffect} from './functionComponent'

/**
 * ----------------------------------------------------------------------------------------
 * component for chip
 */

export const Chip = (props: {
    children(): ReactNode
}) => {
    return useRenderEffect(props.children)
}

export const StrictChip = memo((props: {
    children(): ReactNode
}) => {
    return useRenderEffect(props.children, true)
}, () => true)

Chip.Strict = StrictChip

/**
 * 在`useEffect`后渲染，避免组件首次渲染结束前触发更新，导致React报错
 */
export const AsyncChip = (props: {
    fallback?: ReactNode
    children(): ReactNode
}) => {
    return useAsyncChip()
        ? <Chip>{props.children}</Chip>
        : props.fallback
}

export const AsyncStrictChip = memo((props: {
    fallback?: ReactNode
    children(): ReactNode
}) => {
    return useAsyncChip()
        ? <Chip.Strict>{props.children}</Chip.Strict>
        : props.fallback
})

AsyncChip.Strict = AsyncStrictChip

function useAsyncChip() {
    const [effected, setEffected] = useState(false)

    useEffect(() => {
        requestAnimationFrame(() => {
            setEffected(true)
        })
    }, [])

    return effected
}

/**
 * ----------------------------------------------------------------------------------------
 * function for chip
 */

export function chip(render: () => ReactNode) {
    return createElement(Chip, {children: render})
}

export function strictChip(render: () => ReactNode) {
    return createElement(StrictChip, {children: render})
}

export function asyncChip(render: () => ReactNode) {
    return createElement(AsyncChip, {children: render})
}

export function asyncStrictChip(render: () => ReactNode) {
    return createElement(AsyncStrictChip, {children: render})
}