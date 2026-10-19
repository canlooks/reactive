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
var observer_exports = {};
__export(observer_exports, {
  Observer: () => Observer,
  currentRender: () => currentRender
});
module.exports = __toCommonJS(observer_exports);
var import_effect = require("../effect.js");
var import_props = require("./props.js");
let rendering;
function currentRender() {
  return rendering;
}
function isCurrent(attempt) {
  return (!attempt.reads || (0, import_effect.readsAreCurrent)(attempt.reads)) && [...attempt.view.computations.values()].every((candidate) => (0, import_effect.readsAreCurrent)(candidate.reads));
}
class Observer {
  props;
  node;
  listener;
  committed;
  version = 0;
  commitId = 0;
  mounted = false;
  constructor(props, wholeObject = false) {
    this.props = new import_props.PropsCell(props, wholeObject);
  }
  attempt(props) {
    return {
      props,
      view: this.props.view(props),
      watches: [],
      commits: [],
      version: this.version,
      staleToken: /* @__PURE__ */ Symbol("stale render"),
      sealed: false
    };
  }
  render(attempt, fn) {
    const previous = rendering;
    rendering = attempt;
    try {
      const candidate = (0, import_effect.withReadView)(attempt.view, () => (0, import_effect.captureDependencies)(fn));
      attempt.reads = candidate.reads;
      return candidate.value;
    } finally {
      rendering = previous;
    }
  }
  snapshot(attempt) {
    if (attempt.version !== this.version)
      return this.version;
    return !attempt.sealed && !isCurrent(attempt) ? attempt.staleToken : attempt.version;
  }
  connect() {
    this.mounted = true;
    if (!this.node?.active) {
      this.node = (0, import_effect.createEffectNode)(() => {
      });
      this.node.notify = () => {
        this.version++;
        this.listener?.();
      };
      if (this.committed?.reads)
        (0, import_effect.replaceDeps)(this.node, this.committed.reads.keys());
    }
    return this.node;
  }
  subscribe = (listener) => {
    this.listener = listener;
    this.connect();
    return () => this.disconnect();
  };
  disconnect(retainListener = false) {
    this.mounted = false;
    if (!retainListener)
      this.listener = void 0;
    if (this.node)
      (0, import_effect.stopEffect)(this.node);
    this.node = void 0;
    for (const registration of this.committed?.commits ?? [])
      registration.stop();
    for (const watch of this.committed?.watches ?? [])
      watch.stop();
  }
  commit(attempt) {
    try {
      this.commitAttempt(attempt);
    } catch (error) {
      this.disconnect();
      throw error;
    }
  }
  commitAttempt(attempt) {
    this.connect();
    this.committed = attempt;
    const commit = ++this.commitId;
    for (const registration of attempt.commits)
      registration.apply();
    for (const watch of attempt.watches)
      watch.prepare();
    (0, import_effect.runInBatch)(() => {
      for (const registration of attempt.commits)
        registration.publish();
      const receipt = this.props.publish(attempt.props, { owner: this, commit });
      if (attempt.reads)
        (0, import_effect.acknowledgeReads)(attempt.reads, receipt);
      for (const candidate of attempt.view.computations.values())
        (0, import_effect.acknowledgeReads)(candidate.reads, receipt);
      (0, import_effect.onBatchSettled)(this, () => {
        if (!this.mounted || this.committed !== attempt)
          return;
        const current = isCurrent(attempt);
        if (current) {
          for (const candidate of attempt.view.computations.values())
            candidate.adopt();
          (0, import_effect.acknowledgeNotification)(this.node, this, commit);
        }
        if (attempt.reads)
          (0, import_effect.replaceDeps)(this.node, attempt.reads.keys());
        attempt.sealed = current;
        if (!current)
          (0, import_effect.enqueueEffect)(this.node);
      }, () => {
        if (this.mounted && this.committed === attempt) {
          for (const watch of attempt.watches)
            watch.finish();
        }
      });
    });
    if (this.mounted && this.committed === attempt) {
      for (const watch of attempt.watches)
        watch.initialize();
    }
  }
}
