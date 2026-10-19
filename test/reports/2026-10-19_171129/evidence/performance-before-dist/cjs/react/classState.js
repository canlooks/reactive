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
var classState_exports = {};
__export(classState_exports, {
  ClassState: () => ClassState,
  getClassState: () => getClassState,
  installClassState: () => installClassState,
  reactMethods: () => reactMethods
});
module.exports = __toCommonJS(classState_exports);
var import_effect = require("../effect.js");
var import_reactive = require("../reactive.js");
var import_reference = require("../reference.js");
const states = /* @__PURE__ */ new WeakMap();
const managedFields = /* @__PURE__ */ new Set(["props", "state", "context", "refs", "updater"]);
const reactMethods = /* @__PURE__ */ new Set([
  "constructor",
  "render",
  "setState",
  "forceUpdate",
  "shouldComponentUpdate",
  "componentDidMount",
  "componentDidUpdate",
  "componentWillUnmount",
  "getSnapshotBeforeUpdate",
  "componentDidCatch",
  "componentWillMount",
  "componentWillReceiveProps",
  "componentWillUpdate",
  "UNSAFE_componentWillMount",
  "UNSAFE_componentWillReceiveProps",
  "UNSAFE_componentWillUpdate",
  "getDerivedStateFromProps",
  "getDerivedStateFromError"
]);
class ClassState {
  fields = /* @__PURE__ */ new Map();
  reconnect = /* @__PURE__ */ new Set();
  connected = false;
  connect() {
    this.connected = true;
    for (const publish of this.reconnect)
      publish();
  }
  disconnect() {
    this.connected = false;
  }
}
function getClassState(instance) {
  return states.get(instance);
}
function installClassState(instance) {
  const fields = [];
  for (const key of Reflect.ownKeys(instance)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(instance, key);
    if (managedFields.has(key) || reactMethods.has(key) || !("value" in descriptor) || typeof descriptor.value === "function")
      continue;
    if (!descriptor.configurable) {
      if (descriptor.writable)
        throw new TypeError(`ReactiveClassComponent cannot observe field ${String(key)}`);
      continue;
    }
    fields.push([key, descriptor]);
  }
  const raw = /* @__PURE__ */ Object.create(null);
  for (const [key, descriptor] of fields) {
    Object.defineProperty(raw, key, { value: descriptor.value, writable: true, configurable: true, enumerable: true });
  }
  const storage = (0, import_reactive.reactive)(raw);
  const state = new ClassState();
  for (const [key, original] of fields) {
    const descriptor = {
      configurable: true,
      enumerable: original.enumerable,
      get: () => (0, import_reference.recordReferenceRead)(instance, instance, key, (0, import_reference.withoutReferenceCapture)(() => storage[key]), descriptor)
    };
    const field = {
      key,
      writable: !!original.writable,
      read: () => storage[key],
      assertValid() {
        const current = Reflect.getOwnPropertyDescriptor(instance, key);
        if (!current || current.get !== descriptor.get || current.set !== descriptor.set || current.enumerable !== descriptor.enumerable || current.configurable !== descriptor.configurable) {
          throw new TypeError(`Reactive field ${String(key)} has been redefined`);
        }
      },
      publish(value) {
        field.assertValid();
        storage[key] = value;
      }
    };
    if (original.writable)
      descriptor.set = (value) => {
        if (field.validateWrite)
          (0, import_effect.untracked)(() => (0, import_reference.withoutReferenceCapture)(() => field.validateWrite(value, storage[key])));
        storage[key] = value;
      };
    Object.defineProperty(instance, key, descriptor);
    state.fields.set(key, field);
  }
  states.set(instance, state);
  return state;
}
