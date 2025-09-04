import {Component, PureComponent} from 'react'
import {ReactiveOptions} from '../..'
import {allocateTargets} from '../core/allocateTargets'
import {createReactClassComponent} from './classComponent'
import {createReactFunctionComponent} from './functionComponent'
import {isClass} from '../utils'

export function allocateReact(target: any, options?: ReactiveOptions) {
    if (typeof target === 'function') {
        if (isClass(target)) {
            if (target.prototype instanceof Component || target.prototype instanceof PureComponent) {
                // React class component
                return createReactClassComponent(target, options)
            }
        }
        // React function component
        return createReactFunctionComponent(target)
    }
    if (typeof target === 'object' && target !== null) {
        if (target.$$typeof === Symbol.for('react.forward_ref')) {
            // React function component wrapped by forwardRef
            return createReactFunctionComponent(target.render, true)
        }
    }
    return allocateTargets(target, options)
}