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
var react_exports = {};
__export(react_exports, {
  AsyncChip: () => import_chip.AsyncChip,
  Chip: () => import_chip.Chip,
  Model: () => import_model.Model,
  RC: () => ReactiveComponent,
  RCC: () => import_classComponent2.ReactiveClassComponent,
  RFC: () => import_functionComponent.ReactiveFunctionComponent,
  ReactiveClassComponent: () => import_classComponent2.ReactiveClassComponent,
  ReactiveComponent: () => ReactiveComponent,
  ReactiveFunctionComponent: () => import_functionComponent.ReactiveFunctionComponent,
  asyncChip: () => import_chip.asyncChip,
  asyncStrictChip: () => import_chip.asyncStrictChip,
  chip: () => import_chip.chip,
  defineModel: () => import_model.defineModel,
  loading: () => import_loadingDecorator.loading,
  strictChip: () => import_chip.strictChip,
  useLoading: () => import_loading.useLoading,
  useModel: () => import_model.useModel,
  useReactive: () => import_hooks.useReactive,
  useWatch: () => import_hooks.useWatch
});
module.exports = __toCommonJS(react_exports);
var import_functionComponent = require("./functionComponent.js");
var import_hooks = require("./hooks.js");
var import_chip = require("./chip.js");
var import_model = require("./model.js");
var import_loading = require("./loading.js");
var import_loadingDecorator = require("./loadingDecorator.js");
var import_functionComponent2 = require("./functionComponent.js");
var import_classComponent = require("./classComponent.js");
var import_classComponent2 = require("./classComponent.js");
function ReactiveComponent(component) {
  return typeof component === "function" && component.prototype?.isReactComponent ? (0, import_classComponent.ReactiveClassComponent)(component) : (0, import_functionComponent2.ReactiveFunctionComponent)(component);
}
