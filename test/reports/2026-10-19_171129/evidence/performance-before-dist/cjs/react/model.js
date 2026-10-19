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
var model_exports = {};
__export(model_exports, {
  Model: () => Model,
  defineModel: () => defineModel,
  useModel: () => useModel
});
module.exports = __toCommonJS(model_exports);
var import_react = require("react");
var import_batch = require("../batch.js");
var import_effect = require("../effect.js");
var import_reactive = require("../reactive.js");
var import_reference = require("../reference.js");
var import_commit = require("./commit.js");
var import_functionComponent = require("./functionComponent.js");
function isControl(value) {
  if (value === null || typeof value !== "object")
    return false;
  const view = value.ownerDocument?.defaultView;
  return !!view && (value instanceof view.HTMLInputElement || value instanceof view.HTMLTextAreaElement || value instanceof view.HTMLSelectElement);
}
function normalizeInput(input) {
  if (input !== null && typeof input === "object" && "preventDefault" in input && typeof input.preventDefault === "function" && "stopPropagation" in input && typeof input.stopPropagation === "function") {
    const current = "currentTarget" in input ? input.currentTarget : void 0;
    const target = isControl(current) ? current : "target" in input ? input.target : void 0;
    if (isControl(target)) {
      if (target.tagName === "INPUT" && (target.type === "checkbox" || target.type === "radio")) {
        return target.checked;
      }
      if (target.tagName === "SELECT" && target.multiple) {
        return Array.from(target.selectedOptions, (option) => option.value);
      }
      return target.value;
    }
  }
  return input;
}
function useModel(initialValue) {
  const [state] = (0, import_react.useState)(() => (0, import_reactive.reactive)({ value: initialValue }));
  const committed = (0, import_commit.useCommittedRef)(state);
  return (0, import_react.useState)(() => Object.defineProperty(state, "onChange", {
    enumerable: true,
    value: (input) => {
      if (committed.active)
        (0, import_effect.untracked)(() => {
          state.value = normalizeInput(input);
        });
    }
  }))[0];
}
function ModelView(props) {
  const { source, postValue, valueProp, children } = props;
  if (!(0, import_react.isValidElement)(children) || children.type === import_react.Fragment) {
    throw new TypeError("Model requires exactly one control element, excluding Fragment");
  }
  const child = import_react.Children.only(children);
  if (child.type === "input" && child.props.type === "file")
    throw new TypeError("Model does not support file inputs");
  const reference = (0, import_reference.captureReference)(source);
  const field = valueProp ?? (typeof reference.value === "boolean" ? "checked" : "value");
  if (field !== "value" && field !== "checked")
    throw new TypeError("Model valueProp must be value or checked");
  const committed = (0, import_commit.useCommittedRef)({ source, postValue, onChange: child.props.onChange });
  const [onChange] = (0, import_react.useState)(() => (...args) => {
    if (!committed.active)
      return;
    const config = committed.current;
    (0, import_effect.untracked)(() => {
      const current = (0, import_reference.captureReference)(config.source);
      const next = config.postValue ? config.postValue(...args) : normalizeInput(args[0]);
      (0, import_batch.batch)(() => {
        current.write(next);
        config.onChange?.(...args);
      });
    });
  });
  let value = reference.value;
  if (typeof child.type === "string" && ["input", "textarea", "select"].includes(child.type) && value == null) {
    value = field === "checked" ? false : child.type === "select" && child.props.multiple ? [] : "";
  }
  return (0, import_react.cloneElement)(child, {
    [field]: value,
    [field === "checked" ? "defaultChecked" : "defaultValue"]: void 0,
    onChange
  });
}
const Model = (0, import_functionComponent.createObserverComponent)(ModelView);
function defineModel(component, postValue) {
  function DefinedModel({ refer, valueProp, ...props }) {
    return (0, import_react.createElement)(Model, {
      source: refer,
      valueProp,
      postValue,
      // Model supplies the omitted control props before React renders this child.
      children: (0, import_react.createElement)(component, props)
    });
  }
  DefinedModel.displayName = `Model(${component.displayName || component.name || "Component"})`;
  return DefinedModel;
}
