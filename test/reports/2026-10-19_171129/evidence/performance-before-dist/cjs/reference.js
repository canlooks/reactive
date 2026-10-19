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
var reference_exports = {};
__export(reference_exports, {
  captureReference: () => captureReference,
  markDerivedRead: () => markDerivedRead,
  recordReferenceRead: () => recordReferenceRead,
  withoutReferenceCapture: () => withoutReferenceCapture
});
module.exports = __toCommonJS(reference_exports);
let capturing;
function recordReferenceRead(receiver, rawTarget, key, value, descriptor) {
  if (capturing)
    capturing.reads.push({ receiver, rawTarget, key, value, descriptor });
  return value;
}
function markDerivedRead() {
  if (capturing)
    capturing.derived = true;
}
function withoutReferenceCapture(fn) {
  const previous = capturing;
  capturing = void 0;
  try {
    return fn();
  } finally {
    capturing = previous;
  }
}
function captureReference(selector) {
  if (typeof selector !== "function")
    throw new TypeError("Model source must be a writable property selector");
  const previous = capturing;
  const capture = { reads: [], derived: false };
  capturing = capture;
  let value;
  try {
    value = selector();
  } finally {
    capturing = previous;
  }
  const { reads } = capture;
  const terminal = reads.at(-1);
  if (capture.derived || !terminal || !Object.is(value, terminal.value) || reads.some((read, index) => index > 0 && read.receiver !== reads[index - 1].value)) {
    throw new TypeError("Model source must select one writable reactive property without derived or ambiguous reads");
  }
  const { receiver, rawTarget, key, descriptor } = terminal;
  const writable = descriptor && !("value" in descriptor) ? typeof descriptor.set === "function" : descriptor?.writable !== false && (Object.hasOwn(rawTarget, key) || Object.isExtensible(rawTarget));
  if (!writable)
    throw new TypeError("Model source selects a readonly property");
  return {
    value,
    write(next) {
      if (!Reflect.set(receiver, key, next, receiver))
        throw new TypeError("Model could not write the selected property");
    }
  };
}
