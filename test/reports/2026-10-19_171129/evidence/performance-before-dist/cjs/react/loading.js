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
var loading_exports = {};
__export(loading_exports, {
  useLoading: () => useLoading
});
module.exports = __toCommonJS(loading_exports);
var import_react = require("react");
var import_batch = require("../batch.js");
var import_effect = require("../effect.js");
var import_reactive = require("../reactive.js");
var import_commit = require("./commit.js");
function useLoading(fn, initialLoading = false) {
  if (typeof fn !== "function")
    throw new TypeError("useLoading expects a function");
  const [controller] = (0, import_react.useState)(() => {
    if (typeof initialLoading !== "boolean" && (typeof initialLoading !== "number" || !Number.isSafeInteger(initialLoading) || initialLoading < 0)) {
      throw new TypeError("initialLoading must be a boolean or a nonnegative safe integer");
    }
    const state = (0, import_reactive.reactive)({ loading: initialLoading, stacksCount: 0 });
    const tokens = /* @__PURE__ */ new Set();
    return {
      state,
      tokens,
      started: false,
      publish() {
        (0, import_effect.untracked)(() => (0, import_batch.batch)(() => {
          state.stacksCount = tokens.size;
          state.loading = typeof initialLoading === "number" ? initialLoading + tokens.size : this.started ? tokens.size > 0 : initialLoading;
        }));
      }
    };
  });
  const committed = (0, import_commit.useCommittedRef)(fn, () => controller.publish());
  return (0, import_react.useState)(() => {
    const load = async (...args) => {
      if (!committed.active)
        throw new Error("Cannot call load before commit or after unmount");
      const call = committed.current;
      const token = {};
      controller.tokens.add(token);
      controller.started = true;
      const errors = [];
      let result;
      try {
        controller.publish();
      } catch (error) {
        errors.push(error);
      }
      try {
        result = await (0, import_effect.untracked)(() => call(...args));
      } catch (error) {
        errors.push(error);
      } finally {
        controller.tokens.delete(token);
        if (committed.active) {
          try {
            controller.publish();
          } catch (error) {
            errors.push(error);
          }
        }
      }
      if (errors.length === 1)
        throw errors[0];
      if (errors.length > 1)
        throw new AggregateError(errors, "Multiple errors in reactive load");
      return result;
    };
    return Object.freeze({
      load,
      get loading() {
        return controller.state.loading;
      },
      get stacksCount() {
        return controller.state.stacksCount;
      }
    });
  })[0];
}
