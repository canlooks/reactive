"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var classComponent_exports = {};
__export(classComponent_exports, {
  ReactiveClassComponent: () => ReactiveClassComponent
});
module.exports = __toCommonJS(classComponent_exports);
var import_effect = require("../effect.js");
var import_observer = require("./observer.js");
var import_props = require("./props.js");
var import_batch = require("../batch.js");
var import_classState = require("./classState.js");
const cache = /* @__PURE__ */ new WeakMap();
function install(target, key, value) {
  const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
  if (descriptor && !descriptor.configurable && (!("value" in descriptor) || !descriptor.writable)) {
    throw new TypeError(`ReactiveClassComponent cannot replace ${String(key)}`);
  }
  Object.defineProperty(target, key, { value, writable: true, configurable: descriptor?.configurable ?? true });
}
function ReactiveClassComponent(Target) {
  if (typeof Target !== "function" || !Target.prototype?.isReactComponent) {
    throw new TypeError("ReactiveClassComponent expects a React class component");
  }
  if (cache.has(Target))
    return cache.get(Target);
  const Base = Target;
  const pure = !!Target.prototype.isPureReactComponent;
  class ReactiveClass extends Base {
    constructor(...args) {
      super(...args);
      const state = (0, import_classState.installClassState)(this);
      const observer = new import_observer.Observer(this.props, true);
      let delivered = this.props;
      let attempt;
      const propsDescriptor = Reflect.getOwnPropertyDescriptor(this, "props");
      if (propsDescriptor && !propsDescriptor.configurable) {
        throw new TypeError("ReactiveClassComponent cannot replace props");
      }
      Object.defineProperty(this, "props", {
        configurable: true,
        enumerable: propsDescriptor?.enumerable ?? true,
        get: () => (0, import_effect.getReadView)()?.values.has(observer.props) || (0, import_effect.isSubscriptionRead)() ? observer.props.readSlot() : delivered,
        set: (value) => {
          delivered = value;
        }
      });
      const render = this.render;
      const didMount = this.componentDidMount;
      const didUpdate = this.componentDidUpdate;
      const willUnmount = this.componentWillUnmount;
      const shouldUpdate = this.shouldComponentUpdate;
      install(this, "render", () => {
        const candidate = observer.attempt(delivered);
        const result = observer.render(candidate, () => render.call(this));
        attempt = candidate;
        return result;
      });
      install(this, "componentDidMount", (...params) => {
        try {
          (0, import_batch.batch)(() => {
            state.connect();
            observer.subscribe(() => (0, import_effect.outsideReadContext)(() => this.forceUpdate()));
            if (attempt)
              observer.commit(attempt);
          });
          didMount?.apply(this, params);
        } catch (error) {
          state.disconnect();
          observer.disconnect();
          throw error;
        }
      });
      install(this, "componentDidUpdate", (...params) => {
        try {
          if (attempt)
            observer.commit(attempt);
          didUpdate?.apply(this, params);
        } catch (error) {
          state.disconnect();
          observer.disconnect();
          throw error;
        }
      });
      install(this, "componentWillUnmount", (...params) => {
        state.disconnect();
        observer.disconnect();
        willUnmount?.apply(this, params);
      });
      install(this, "shouldComponentUpdate", (nextProps, nextState, nextContext) => {
        const original = shouldUpdate ? shouldUpdate.call(this, nextProps, nextState, nextContext) : !pure || !(0, import_props.shallowEqual)(delivered, nextProps) || !(0, import_props.shallowEqual)(this.state ?? {}, nextState ?? {});
        return original || observer.props.hasSlotConsumers() && !(0, import_props.shallowEqual)(observer.props.committed, nextProps);
      });
    }
  }
  if (pure)
    Object.defineProperty(ReactiveClass.prototype, "isPureReactComponent", { value: false });
  Object.defineProperty(ReactiveClass, "displayName", { value: `Reactive(${Target.displayName || Target.name || "Component"})` });
  cache.set(Target, ReactiveClass);
  cache.set(ReactiveClass, ReactiveClass);
  return ReactiveClass;
}
