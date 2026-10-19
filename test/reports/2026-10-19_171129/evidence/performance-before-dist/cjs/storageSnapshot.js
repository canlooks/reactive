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
var storageSnapshot_exports = {};
__export(storageSnapshot_exports, {
  decodeStorage: () => decodeStorage,
  encodeStorage: () => encodeStorage,
  isStorageRoot: () => isStorageRoot,
  prepareStorageRestore: () => prepareStorageRestore,
  scanStorage: () => scanStorage
});
module.exports = __toCommonJS(storageSnapshot_exports);
var import_computed = require("./computed.js");
var import_effect = require("./effect.js");
var import_reactive = require("./reactive.js");
function isStorageRoot(value) {
  if (value === null || typeof value !== "object")
    return false;
  const raw = (0, import_reactive.toRaw)(value);
  if ((0, import_computed.isComputed)(raw))
    return false;
  const prototype = Reflect.getPrototypeOf(raw);
  return Array.isArray(raw) || prototype === null || prototype === Object.prototype;
}
function isIndex(key) {
  const index = Number(key);
  return Number.isInteger(index) && index >= 0 && index < 4294967295 && String(index) === key;
}
function dataEntries(target) {
  return Object.keys(target).filter((key) => !Array.isArray(target) || isIndex(key)).map((key) => [key, Reflect.getOwnPropertyDescriptor(target, key)]).filter(([, descriptor]) => "value" in descriptor);
}
function scanStorage(root) {
  const seen = /* @__PURE__ */ new Set();
  const pending = [root];
  while (pending.length) {
    const raw = (0, import_reactive.toRaw)(pending.pop());
    if (seen.has(raw) || !isStorageRoot(raw))
      continue;
    seen.add(raw);
    (0, import_effect.trackObjectChanges)(raw);
    for (const [, descriptor] of dataEntries(raw)) {
      if (descriptor.value !== null && typeof descriptor.value === "object")
        pending.push(descriptor.value);
    }
  }
}
function assertKey(key) {
  if (key === "__proto__" || key === "constructor" || key === "prototype") {
    throw new TypeError(`storage cannot persist the reserved key ${key}`);
  }
}
function container(target) {
  if (!Array.isArray(target))
    return /* @__PURE__ */ Object.create(null);
  const result = [];
  Object.setPrototypeOf(result, null);
  result.length = target.length;
  return result;
}
function define(target, key, value) {
  Object.defineProperty(target, key, { value, enumerable: true, configurable: true, writable: true });
}
function encodeStorage(root) {
  const ancestors = /* @__PURE__ */ new Set();
  const copies = /* @__PURE__ */ new Map();
  function project(input) {
    const value = (0, import_reactive.toRaw)(input);
    if (typeof value === "bigint")
      throw new TypeError("storage cannot persist BigInt");
    if (typeof value === "function" || typeof value === "symbol" || value === void 0)
      return void 0;
    if (value === null || typeof value !== "object")
      return value;
    if (!isStorageRoot(value))
      throw new TypeError("storage expects plain data objects and arrays");
    if (ancestors.has(value))
      throw new TypeError("storage cannot persist circular references");
    const cached = copies.get(value);
    if (cached)
      return cached;
    const result = container(value);
    copies.set(value, result);
    ancestors.add(value);
    for (const [key, descriptor] of dataEntries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
      const next = project(descriptor.value);
      if (next === void 0)
        continue;
      assertKey(key);
      define(result, key, next);
    }
    ancestors.delete(value);
    return result;
  }
  return JSON.stringify(project(root));
}
function decodeStorage(value, root) {
  if (typeof value !== "string")
    throw new TypeError("storage getItem must return a string or null");
  const data = JSON.parse(value);
  if (!isStorageRoot(data) || Array.isArray(data) !== Array.isArray(root)) {
    throw new TypeError("storage record must have the same object/array root shape as its initial state");
  }
  return { data, snapshot: encodeStorage(data) };
}
function protectedField(descriptor) {
  return !descriptor.enumerable || !("value" in descriptor) || typeof descriptor.value === "function";
}
function checkWrite(root, key, value) {
  const own = Reflect.getOwnPropertyDescriptor(root, key);
  if (own) {
    if (protectedField(own) && !(Array.isArray(root) && key === "length"))
      return false;
    if (Object.is((0, import_reactive.toRaw)(own.value), (0, import_reactive.toRaw)(value)))
      return false;
    if (!own.writable)
      throw new TypeError(`storage cannot restore readonly property ${key}`);
  } else {
    if (!Object.isExtensible(root))
      throw new TypeError("storage cannot restore a non-extensible object");
    let prototype = root;
    while (prototype = Reflect.getPrototypeOf(prototype)) {
      const inherited = Reflect.getOwnPropertyDescriptor(prototype, key);
      if (!inherited)
        continue;
      if (!("value" in inherited) || !inherited.writable) {
        throw new TypeError(`storage cannot restore inherited readonly/accessor property ${key}`);
      }
      break;
    }
  }
  return true;
}
function prepareStorageRestore(root, data) {
  const expected = container(root);
  for (const [key, descriptor] of dataEntries(root))
    define(expected, key, descriptor.value);
  const writes = [];
  for (const [key, descriptor] of dataEntries(data)) {
    if (!checkWrite(root, key, descriptor.value))
      continue;
    writes.push([key, descriptor.value]);
    define(expected, key, descriptor.value);
  }
  if (Array.isArray(root) && Array.isArray(data)) {
    if (data.length < root.length) {
      for (const key of Object.getOwnPropertyNames(root)) {
        if (!isIndex(key) || Number(key) < data.length)
          continue;
        const descriptor = Reflect.getOwnPropertyDescriptor(root, key);
        if (!descriptor.configurable || protectedField(descriptor)) {
          throw new TypeError(`storage cannot truncate protected array index ${key}`);
        }
      }
    }
    if (checkWrite(root, "length", data.length))
      writes.push(["length", data.length]);
    Reflect.set(expected, "length", data.length);
    if (!Reflect.getOwnPropertyDescriptor(root, "length").writable && data.length > root.length) {
      throw new TypeError("storage cannot extend a readonly array length");
    }
  }
  const snapshot = encodeStorage(expected);
  return {
    snapshot,
    apply(state) {
      for (const [key, value] of writes) {
        if (!Reflect.set(state, key, value))
          throw new TypeError(`storage could not restore ${key}`);
      }
    }
  };
}
