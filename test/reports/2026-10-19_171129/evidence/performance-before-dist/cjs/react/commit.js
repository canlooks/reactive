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
var commit_exports = {};
__export(commit_exports, {
  useCommitEffect: () => useCommitEffect,
  useCommittedRef: () => useCommittedRef
});
module.exports = __toCommonJS(commit_exports);
var import_react = require("react");
var import_effect = require("../effect.js");
var import_observer = require("./observer.js");
function useCommitEffect(...args) {
  const hook = typeof window === "undefined" ? import_react.useEffect : import_react.useLayoutEffect;
  hook(...args);
}
function useCommittedRef(value, publish) {
  const [slot] = (0, import_react.useState)(() => ({ active: false }));
  const render = (0, import_observer.currentRender)();
  const registration = {
    apply() {
      slot.current = value;
      slot.active = true;
    },
    publish() {
      if (publish)
        (0, import_effect.untracked)(publish);
    },
    stop() {
      slot.active = false;
    }
  };
  render?.commits.push(registration);
  useCommitEffect(() => registration.stop, [slot]);
  useCommitEffect(() => {
    if (!render) {
      registration.apply();
      try {
        (0, import_effect.runInBatch)(registration.publish);
      } catch (error) {
        registration.stop();
        throw error;
      }
    }
  });
  return slot;
}
