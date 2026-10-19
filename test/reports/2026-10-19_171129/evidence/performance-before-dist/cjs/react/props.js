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
var props_exports = {};
__export(props_exports, {
  PropsCell: () => PropsCell,
  shallowEqual: () => shallowEqual
});
module.exports = __toCommonJS(props_exports);
var import_effect = require("../effect.js");
var import_reference = require("../reference.js");
const slot = /* @__PURE__ */ Symbol("props");
function propKeys(props) {
  return Reflect.ownKeys(props).filter((key) => {
    if (key !== "key" && key !== "ref")
      return true;
    const descriptor = Reflect.getOwnPropertyDescriptor(props, key);
    return descriptor.enumerable !== false || typeof descriptor.get !== "function";
  });
}
function shallowEqual(a, b) {
  if (a === b)
    return true;
  const keys = propKeys(a);
  return keys.length === propKeys(b).length && keys.every((key) => Object.hasOwn(b, key) && Object.is(Reflect.get(a, key), Reflect.get(b, key)));
}
function fieldState(props, key) {
  return Object.hasOwn(props, key) ? { kind: "data", value: Reflect.get(props, key) } : { kind: "absent" };
}
class PropsCell {
  wholeObject;
  committed;
  proxy;
  initialized = false;
  constructor(initial, wholeObject = false) {
    this.wholeObject = wholeObject;
    this.committed = initial;
    const read = () => this.current();
    this.proxy = new Proxy(/* @__PURE__ */ Object.create(null), {
      get: (target, key, receiver) => {
        (0, import_effect.track)(this, key);
        const value = Reflect.get(read(), key);
        return (0, import_reference.recordReferenceRead)(receiver, target, key, value, { value, writable: false });
      },
      has: (_target, key) => Reflect.has(read(), key),
      ownKeys: () => propKeys(read()),
      getOwnPropertyDescriptor: (_target, key) => Object.hasOwn(read(), key) ? {
        configurable: true,
        enumerable: Reflect.getOwnPropertyDescriptor(read(), key).enumerable,
        writable: false,
        value: Reflect.get(read(), key)
      } : void 0,
      getPrototypeOf: () => Reflect.getPrototypeOf(read()),
      set: () => false,
      deleteProperty: () => false,
      defineProperty: () => false,
      setPrototypeOf: () => false,
      preventExtensions: () => false
    });
  }
  current() {
    return (0, import_effect.getReadView)()?.values.get(this) ?? this.committed;
  }
  readSlot() {
    (0, import_effect.track)(this, slot);
    return this.current();
  }
  hasSlotConsumers() {
    return (0, import_effect.getDep)(this, slot).size > 0;
  }
  view(incoming) {
    const changed = /* @__PURE__ */ new Set();
    if (this.wholeObject) {
      if (!shallowEqual(this.committed, incoming))
        changed.add((0, import_effect.getDep)(this, slot));
    } else {
      for (const key of /* @__PURE__ */ new Set([...propKeys(this.committed), ...propKeys(incoming)])) {
        if (Object.hasOwn(this.committed, key) !== Object.hasOwn(incoming, key) || !Object.is(Reflect.get(this.committed, key), Reflect.get(incoming, key))) {
          changed.add((0, import_effect.getDep)(this, key));
        }
      }
    }
    return { values: /* @__PURE__ */ new Map([[this, incoming]]), changed, computations: /* @__PURE__ */ new Map(), evaluating: /* @__PURE__ */ new Set() };
  }
  publish(incoming, source) {
    const previous = this.committed;
    this.committed = incoming;
    const receipt = /* @__PURE__ */ new Map();
    if (!this.initialized) {
      this.initialized = true;
      return receipt;
    }
    if (this.wholeObject) {
      if (!shallowEqual(previous, incoming)) {
        (0, import_effect.recordChange)(this, slot, { kind: "data", value: previous }, () => ({
          kind: "data",
          value: shallowEqual(previous, this.committed) ? previous : this.committed
        }), source, receipt);
      }
    } else {
      for (const key of /* @__PURE__ */ new Set([...propKeys(previous), ...propKeys(incoming)])) {
        (0, import_effect.recordChange)(this, key, fieldState(previous, key), () => fieldState(this.committed, key), source, receipt);
      }
    }
    return receipt;
  }
}
