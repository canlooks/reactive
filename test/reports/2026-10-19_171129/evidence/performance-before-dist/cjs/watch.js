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
var watch_exports = {};
__export(watch_exports, {
  createWatch: () => createWatch,
  watch: () => watch
});
module.exports = __toCommonJS(watch_exports);
var import_effect = require("./effect.js");
function createWatch(source, callback, options) {
  if (typeof source !== "function" || typeof callback !== "function") {
    throw new TypeError("watch expects source and callback functions");
  }
  const immediate = (0, import_effect.untracked)(() => options?.immediate === true);
  let initialized = false;
  let value;
  let silent = false;
  let refreshRequested = false;
  let revision = 0;
  const node = (0, import_effect.createEffectNode)(() => {
    const hadValue = initialized;
    const oldValue = value;
    revision++;
    const nextValue = source();
    value = nextValue;
    initialized = true;
    if (!silent && (hadValue || immediate)) {
      (0, import_effect.untracked)(() => callback(nextValue, hadValue ? oldValue : void 0));
    }
  });
  const handle = {
    node,
    get revision() {
      return revision;
    },
    initialize() {
      try {
        (0, import_effect.runEffect)(node);
      } catch (error) {
        handle.stop();
        throw error;
      }
    },
    update(nextSource, nextCallback) {
      source = nextSource;
      callback = nextCallback;
    },
    refresh() {
      if (!node.active || (0, import_effect.isEffectPending)(node))
        return;
      if (node.running) {
        refreshRequested = true;
        return;
      }
      silent = true;
      try {
        (0, import_effect.runEffect)(node);
      } finally {
        silent = false;
      }
    },
    stop() {
      refreshRequested = false;
      (0, import_effect.stopEffect)(node);
    }
  };
  node.afterRun = () => {
    if (!refreshRequested)
      return;
    refreshRequested = false;
    handle.refresh();
  };
  return handle;
}
function watch(source, callback, options) {
  const handle = createWatch(source, callback, options);
  handle.initialize();
  return handle.stop;
}
