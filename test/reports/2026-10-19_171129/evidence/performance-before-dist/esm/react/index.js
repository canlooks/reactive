export { ReactiveFunctionComponent, ReactiveFunctionComponent as RFC } from './functionComponent.js';
export { useReactive, useWatch } from './hooks.js';
export { Chip, AsyncChip, chip, strictChip, asyncChip, asyncStrictChip } from './chip.js';
export { useModel, Model, defineModel } from './model.js';
export { useLoading } from './loading.js';
export { loading } from './loadingDecorator.js';
import { ReactiveFunctionComponent } from './functionComponent.js';
import { ReactiveClassComponent } from './classComponent.js';
export function ReactiveComponent(component) {
    return typeof component === 'function' && component.prototype?.isReactComponent
        ? ReactiveClassComponent(component)
        : ReactiveFunctionComponent(component);
}
export { ReactiveComponent as RC };
export { ReactiveClassComponent, ReactiveClassComponent as RCC } from './classComponent.js';
