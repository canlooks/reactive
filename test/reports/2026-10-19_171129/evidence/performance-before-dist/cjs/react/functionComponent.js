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
var functionComponent_exports = {};
__export(functionComponent_exports, {
  ReactiveFunctionComponent: () => ReactiveFunctionComponent,
  createObserverComponent: () => createObserverComponent
});
module.exports = __toCommonJS(functionComponent_exports);
var import_react = require("react");
var import_observer = require("./observer.js");
var import_commit = require("./commit.js");
const cache = /* @__PURE__ */ new WeakMap();
const serverSnapshot = () => 0;
function createObserverComponent(component) {
  const name = component.displayName || component.name || "Component";
  function ObserverComponent(props) {
    const [observer] = (0, import_react.useState)(() => new import_observer.Observer(props));
    const attempt = observer.attempt(props);
    (0, import_react.useSyncExternalStore)(observer.subscribe, () => observer.snapshot(attempt), serverSnapshot);
    (0, import_commit.useCommitEffect)(() => () => observer.disconnect(true), [observer]);
    (0, import_commit.useCommitEffect)(() => {
      observer.commit(attempt);
    });
    return observer.render(attempt, () => component(observer.props.proxy));
  }
  ObserverComponent.displayName = `Reactive(${name})`;
  return ObserverComponent;
}
function ReactiveFunctionComponent(component) {
  if ((typeof component === "function" || typeof component === "object" && component !== null) && cache.has(component)) {
    return cache.get(component);
  }
  if (typeof component !== "function" || component.prototype?.isReactComponent || component.constructor.name === "AsyncFunction") {
    throw new TypeError("ReactiveFunctionComponent expects a synchronous function component or its own wrapper");
  }
  const ObserverComponent = createObserverComponent(component);
  const wrapped = (0, import_react.memo)(ObserverComponent);
  wrapped.displayName = ObserverComponent.displayName;
  cache.set(component, wrapped);
  cache.set(wrapped, wrapped);
  return wrapped;
}
