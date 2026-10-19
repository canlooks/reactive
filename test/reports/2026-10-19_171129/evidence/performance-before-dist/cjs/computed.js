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
var computed_exports = {};
__export(computed_exports, {
  computed: () => computed,
  isComputed: () => isComputed
});
module.exports = __toCommonJS(computed_exports);
var import_effect = require("./effect.js");
var import_reference = require("./reference.js");
const computedValues = /* @__PURE__ */ new WeakSet();
function isComputed(value) {
  return computedValues.has(value);
}
function computed(getter) {
  if (typeof getter !== "function")
    throw new TypeError("computed expects a function");
  let dirty = true;
  let value;
  const consumers = /* @__PURE__ */ new Set();
  const node = (0, import_effect.createEffectNode)(getter);
  node.computed = { consumers, invalidate: () => {
    dirty = true;
  } };
  (0, import_effect.registerComputed)(consumers, node);
  const read = () => {
    if (node.running)
      throw new Error("Circular computed evaluation");
    (0, import_effect.trackDep)(consumers);
    const view = (0, import_effect.getReadView)();
    if (view) {
      if (view.evaluating.has(node))
        throw new Error("Circular computed evaluation");
      const cached = view.computations.get(node);
      if (cached)
        return cached.value;
      if (dirty || (0, import_effect.hasViewChanges)(node, view)) {
        view.evaluating.add(node);
        try {
          const candidate = (0, import_effect.captureDependencies)(getter);
          view.computations.set(node, {
            ...candidate,
            consumers,
            adopt() {
              (0, import_effect.replaceDeps)(node, candidate.reads.keys());
              node.hasRun = true;
              value = candidate.value;
              dirty = false;
            }
          });
          return candidate.value;
        } finally {
          view.evaluating.delete(node);
        }
      }
    }
    if (dirty) {
      value = (0, import_effect.runEffect)(node);
      dirty = false;
    }
    return value;
  };
  const result = Object.freeze({ get value() {
    (0, import_reference.markDerivedRead)();
    return (0, import_reference.withoutReferenceCapture)(read);
  } });
  computedValues.add(result);
  return result;
}
