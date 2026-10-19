import { Children, Fragment, cloneElement, createElement, isValidElement, useState, } from 'react';
import { batch } from '../batch.js';
import { untracked } from '../effect.js';
import { reactive } from '../reactive.js';
import { captureReference } from '../reference.js';
import { useCommittedRef } from './commit.js';
import { createObserverComponent } from './functionComponent.js';
function isControl(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const view = value.ownerDocument?.defaultView;
    return !!view && (value instanceof view.HTMLInputElement || value instanceof view.HTMLTextAreaElement
        || value instanceof view.HTMLSelectElement);
}
function normalizeInput(input) {
    if (input !== null && typeof input === 'object'
        && 'preventDefault' in input && typeof input.preventDefault === 'function'
        && 'stopPropagation' in input && typeof input.stopPropagation === 'function') {
        const current = 'currentTarget' in input ? input.currentTarget : undefined;
        const target = isControl(current) ? current : 'target' in input ? input.target : undefined;
        if (isControl(target)) {
            if (target.tagName === 'INPUT' && (target.type === 'checkbox' || target.type === 'radio')) {
                return target.checked;
            }
            if (target.tagName === 'SELECT' && target.multiple) {
                return Array.from(target.selectedOptions, option => option.value);
            }
            return target.value;
        }
    }
    return input;
}
export function useModel(initialValue) {
    const [state] = useState(() => reactive({ value: initialValue }));
    const committed = useCommittedRef(state);
    return useState(() => Object.defineProperty(state, 'onChange', {
        enumerable: true,
        value: (input) => {
            if (committed.active)
                untracked(() => { state.value = normalizeInput(input); });
        },
    }))[0];
}
function ModelView(props) {
    const { source, postValue, valueProp, children } = props;
    if (!isValidElement(children) || children.type === Fragment) {
        throw new TypeError('Model requires exactly one control element, excluding Fragment');
    }
    const child = Children.only(children);
    if (child.type === 'input' && child.props.type === 'file')
        throw new TypeError('Model does not support file inputs');
    const reference = captureReference(source);
    const field = valueProp ?? (typeof reference.value === 'boolean' ? 'checked' : 'value');
    if (field !== 'value' && field !== 'checked')
        throw new TypeError('Model valueProp must be value or checked');
    const committed = useCommittedRef({ source, postValue, onChange: child.props.onChange });
    const [onChange] = useState(() => (...args) => {
        if (!committed.active)
            return;
        const config = committed.current;
        untracked(() => {
            const current = captureReference(config.source);
            const next = config.postValue ? config.postValue(...args) : normalizeInput(args[0]);
            batch(() => {
                current.write(next);
                config.onChange?.(...args);
            });
        });
    });
    let value = reference.value;
    if (typeof child.type === 'string' && ['input', 'textarea', 'select'].includes(child.type) && value == null) {
        value = field === 'checked' ? false : child.type === 'select' && child.props.multiple ? [] : '';
    }
    return cloneElement(child, {
        [field]: value,
        [field === 'checked' ? 'defaultChecked' : 'defaultValue']: undefined,
        onChange: onChange,
    });
}
// The observer preserves the view's generic relationship between source and postValue.
export const Model = createObserverComponent(ModelView);
export function defineModel(component, postValue) {
    function DefinedModel({ refer, valueProp, ...props }) {
        return createElement(Model, {
            source: refer, valueProp, postValue,
            // Model supplies the omitted control props before React renders this child.
            children: createElement(component, props),
        });
    }
    DefinedModel.displayName = `Model(${component.displayName || component.name || 'Component'})`;
    return DefinedModel;
}
