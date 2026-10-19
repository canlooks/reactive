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
var reactive_exports = {};
__export(reactive_exports, {
  reactive: () => reactive,
  toRaw: () => toRaw
});
module.exports = __toCommonJS(reactive_exports);
var import_effect = require("./effect.js");
var import_computed = require("./computed.js");
var import_batch = require("./batch.js");
var import_reference = require("./reference.js");
const rawToProxy = /* @__PURE__ */ new WeakMap();
const proxyToRaw = /* @__PURE__ */ new WeakMap();
const getterCache = /* @__PURE__ */ new WeakMap();
const batchedInstances = /* @__PURE__ */ new WeakSet();
const methodCache = /* @__PURE__ */ new WeakMap();
function isObject(value) {
  return value !== null && (typeof value === "object" || typeof value === "function");
}
function toRaw(value) {
  return isObject(value) ? proxyToRaw.get(value) ?? value : value;
}
function isNative(fn) {
  return /\{\s*\[native code\]\s*\}/.test(Function.prototype.toString.call(fn));
}
function isBuiltinConstructor(ctor) {
  if (isNative(ctor))
    return true;
  const prototype = Reflect.getOwnPropertyDescriptor(ctor, "prototype")?.value;
  const tag = isObject(prototype) ? Reflect.getOwnPropertyDescriptor(prototype, Symbol.toStringTag)?.value : void 0;
  return typeof tag === "string" && tag === Reflect.getOwnPropertyDescriptor(ctor, "name")?.value;
}
function canProxy(target) {
  if (typeof target === "function")
    return !isBuiltinConstructor(target) && Object.hasOwn(target, "prototype");
  if (Array.isArray(target))
    return true;
  let current = target;
  while (current = Reflect.getPrototypeOf(current)) {
    current = toRaw(current);
    const ctor = Reflect.getOwnPropertyDescriptor(current, "constructor")?.value;
    if (typeof ctor === "function" && ctor !== Object && isBuiltinConstructor(ctor))
      return false;
  }
  return true;
}
function propertyState(target, key) {
  const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
  if (!descriptor)
    return { kind: "absent" };
  if ("value" in descriptor)
    return { kind: "data", value: toRaw(descriptor.value) };
  return { kind: "accessor", get: descriptor.get, set: descriptor.set };
}
function findProperty(target, key) {
  let current = target;
  while (current) {
    current = toRaw(current);
    const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
    if (descriptor)
      return { owner: current, descriptor };
    current = Reflect.getPrototypeOf(current);
  }
  return void 0;
}
function readGetter(receiver, key, getter) {
  if (!isObject(receiver))
    return Reflect.apply(getter, receiver, []);
  let cache = getterCache.get(receiver);
  if (!cache)
    getterCache.set(receiver, cache = /* @__PURE__ */ new Map());
  let entry = cache.get(key);
  if (!entry || entry.getter !== getter) {
    entry = { getter, read: (0, import_computed.computed)(() => Reflect.apply(getter, receiver, [])) };
    cache.set(key, entry);
  }
  return entry.read.value;
}
function isClassMethod(target, key, owner, descriptor) {
  if (typeof descriptor.value !== "function")
    return false;
  if (typeof target === "function") {
    return typeof owner === "function" && !isBuiltinConstructor(owner) && !descriptor.enumerable;
  }
  if (!batchedInstances.has(target) || owner === target || key === "constructor")
    return false;
  const ctor = Reflect.getOwnPropertyDescriptor(owner, "constructor")?.value;
  return typeof ctor === "function" && !isBuiltinConstructor(ctor);
}
function wrapMethod(receiver, key, method) {
  const wrap = () => function(...args) {
    return (0, import_batch.batch)(() => Reflect.apply(method, this, args));
  };
  if (!isObject(receiver))
    return wrap();
  let cache = methodCache.get(receiver);
  if (!cache)
    methodCache.set(receiver, cache = /* @__PURE__ */ new Map());
  let entry = cache.get(key);
  if (!entry || entry.method !== method) {
    entry = { method, wrapped: wrap() };
    cache.set(key, entry);
  }
  return entry.wrapped;
}
function isArrayIndex(key) {
  if (typeof key !== "string")
    return false;
  const index = Number(key);
  return Number.isInteger(index) && index >= 0 && index < 4294967295 && String(index) === key;
}
const handlers = {
  get(target, key, receiver) {
    const own = Reflect.getOwnPropertyDescriptor(target, key);
    if (own && !own.configurable) {
      if ("value" in own && !own.writable)
        return (0, import_reference.recordReferenceRead)(receiver, target, key, own.value, own);
      if (!("value" in own) && !own.get)
        return (0, import_reference.recordReferenceRead)(receiver, target, key, void 0, own);
    }
    (0, import_effect.track)(target, key);
    const property = findProperty(target, key);
    const getter = property?.descriptor.get;
    if (property && isClassMethod(target, key, property.owner, property.descriptor)) {
      return (0, import_reference.recordReferenceRead)(receiver, target, key, wrapMethod(receiver, key, property.descriptor.value), property.descriptor);
    }
    const value = (0, import_reference.withoutReferenceCapture)(() => getter ? readGetter(receiver, key, getter) : Reflect.get(target, key, receiver));
    return (0, import_reference.recordReferenceRead)(receiver, target, key, value !== null && typeof value === "object" ? reactive(value) : value, property?.descriptor);
  },
  set(target, key, value, receiver) {
    return (0, import_effect.runInBatch)(() => {
      const before = propertyState(target, key);
      const normalized = toRaw(value);
      const implicit = /* @__PURE__ */ new Map();
      if (Array.isArray(target) && target === toRaw(receiver)) {
        if (isArrayIndex(key) && Number(key) >= target.length) {
          implicit.set("length", propertyState(target, "length"));
        } else if (key === "length" && (typeof normalized !== "number" || normalized < target.length)) {
          for (const index of Reflect.ownKeys(target)) {
            if (isArrayIndex(index) && (typeof normalized !== "number" || Number(index) >= normalized)) {
              implicit.set(index, propertyState(target, index));
            }
          }
        }
      }
      const success = Reflect.set(target, key, normalized, receiver);
      if (success && target === toRaw(receiver)) {
        (0, import_effect.recordChange)(target, key, before, () => propertyState(target, key));
        for (const [implicitKey, state] of implicit) {
          (0, import_effect.recordChange)(target, implicitKey, state, () => propertyState(target, implicitKey));
        }
      }
      return success;
    });
  },
  deleteProperty(target, key) {
    return (0, import_effect.runInBatch)(() => {
      const before = propertyState(target, key);
      const success = Reflect.deleteProperty(target, key);
      if (success)
        (0, import_effect.recordChange)(target, key, before, () => propertyState(target, key));
      return success;
    });
  },
  construct(target, args, newTarget) {
    const instance = Reflect.construct(target, args, newTarget);
    batchedInstances.add(toRaw(instance));
    return reactive(instance);
  }
};
function reactive(target) {
  if (arguments.length === 0)
    return reactive;
  if (!isObject(target))
    throw new TypeError("reactive expects an object or a class");
  if (proxyToRaw.has(target) || (0, import_computed.isComputed)(target))
    return target;
  const cached = rawToProxy.get(target);
  if (cached)
    return cached;
  if (!canProxy(target))
    return target;
  const proxy = new Proxy(target, handlers);
  rawToProxy.set(target, proxy);
  proxyToRaw.set(proxy, target);
  return proxy;
}
