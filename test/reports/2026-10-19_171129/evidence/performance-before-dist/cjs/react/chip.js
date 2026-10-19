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
var chip_exports = {};
__export(chip_exports, {
  AsyncChip: () => AsyncChip,
  Chip: () => Chip2,
  asyncChip: () => asyncChip,
  asyncStrictChip: () => asyncStrictChip,
  chip: () => chip,
  strictChip: () => strictChip
});
module.exports = __toCommonJS(chip_exports);
var import_react = require("react");
var import_functionComponent = require("./functionComponent.js");
function validateRender(render) {
  if (typeof render !== "function" || render.constructor.name === "AsyncFunction") {
    throw new TypeError("Chip children must be a synchronous render function");
  }
}
const FragmentObserver = (0, import_functionComponent.createObserverComponent)(function Chip({ children }) {
  validateRender(children);
  const result = children();
  if (result !== null && (typeof result === "object" || typeof result === "function") && "then" in result && typeof result.then === "function") {
    throw new TypeError("Chip children must return synchronously, not a Promise");
  }
  return result;
});
const Strict = (0, import_react.memo)(FragmentObserver, () => true);
Strict.displayName = "Chip.Strict";
const Chip2 = Object.defineProperty(FragmentObserver, "Strict", { value: Strict });
function createGate(fragment) {
  return function AsyncGate({ children, fallback }) {
    const [ready, setReady] = (0, import_react.useState)(false);
    validateRender(children);
    (0, import_react.useEffect)(() => {
      setReady(true);
    }, []);
    return ready ? (0, import_react.createElement)(fragment, { children }) : fallback ?? null;
  };
}
const Gate = createGate(Chip2);
Gate.displayName = "AsyncChip";
const StrictGate = (0, import_react.memo)(createGate(Strict), () => true);
StrictGate.displayName = "AsyncChip.Strict";
const AsyncChip = Object.defineProperty(Gate, "Strict", { value: StrictGate });
function chip(render) {
  return (0, import_react.createElement)(Chip2, { children: render });
}
function strictChip(render) {
  return (0, import_react.createElement)(Chip2.Strict, { children: render });
}
function asyncChip(render) {
  return (0, import_react.createElement)(AsyncChip, { children: render });
}
function asyncStrictChip(render) {
  return (0, import_react.createElement)(AsyncChip.Strict, { children: render });
}
