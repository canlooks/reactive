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
var hooks_exports = {};
__export(hooks_exports, {
  useReactive: () => useReactive,
  useWatch: () => useWatch
});
module.exports = __toCommonJS(hooks_exports);
var import_react = require("react");
var import_reactive = require("../reactive.js");
var import_watch = require("../watch.js");
var import_commit = require("./commit.js");
var import_observer = require("./observer.js");
function useReactive(initialState) {
  return (0, import_react.useState)(() => (0, import_reactive.reactive)(initialState))[0];
}
function useWatch(source, callback, options) {
  const [slot] = (0, import_react.useState)(() => ({ handle: void 0 }));
  const render = (0, import_observer.currentRender)();
  const nextCallback = callback;
  let prepared;
  let revision;
  const registration = {
    prepare() {
      prepared = slot.handle;
      revision = prepared?.revision;
      prepared?.update(source, nextCallback);
    },
    initialize() {
      if (slot.handle)
        return;
      const handle = (0, import_watch.createWatch)(source, nextCallback, options);
      slot.handle = handle;
      try {
        handle.initialize();
      } catch (error) {
        handle.stop();
        if (slot.handle === handle)
          slot.handle = void 0;
        throw error;
      }
    },
    finish() {
      if (prepared && slot.handle === prepared && prepared.revision === revision)
        prepared.refresh();
    },
    stop() {
      slot.handle?.stop();
      slot.handle = void 0;
    }
  };
  render?.watches.push(registration);
  (0, import_commit.useCommitEffect)(() => registration.stop, [slot]);
  (0, import_commit.useCommitEffect)(() => {
    if (!render) {
      registration.prepare();
      registration.initialize();
      registration.finish();
    }
  });
}
