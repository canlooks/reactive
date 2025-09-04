import {createElement, memo, ReactNode} from 'react'
import {useRenderEffect} from './functionComponent'

/**
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
 * function for chip
 */

export function chip(render: () => ReactNode) {
    return createElement(Chip, {children: render})
}

export function strictChip(render: () => ReactNode) {
    return createElement(StrictChip, {children: render})
}