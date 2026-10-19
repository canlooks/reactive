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
var storage_exports = {};
__export(storage_exports, {
  stopStorage: () => stopStorage,
  storage: () => storage
});
module.exports = __toCommonJS(storage_exports);
var import_effect = require("./effect.js");
var import_batch = require("./batch.js");
var import_reactive = require("./reactive.js");
var import_reference = require("./reference.js");
var import_storageSnapshot = require("./storageSnapshot.js");
const roots = /* @__PURE__ */ new WeakMap();
const backends = /* @__PURE__ */ new WeakMap();
function isolated(fn) {
  return (0, import_effect.outsideReadContext)(() => (0, import_reference.withoutReferenceCapture)(fn));
}
function report(name, phase, error) {
  try {
    isolated(() => console.warn("@canlooks/reactive storage failed", { name, phase, error }));
  } catch {
  }
}
function asPromise(value) {
  if (value === null || typeof value !== "object" && typeof value !== "function")
    return void 0;
  const then = Reflect.get(value, "then");
  if (typeof then !== "function")
    return void 0;
  return Promise.resolve().then(() => new Promise((resolve, reject) => {
    Reflect.apply(then, value, [resolve, reject]);
  }));
}
function release(registration) {
  (0, import_effect.stopEffect)(registration.node);
  const backend2 = registration.backend.deref();
  const names = backend2 && backends.get(backend2);
  if (names?.get(registration.name) === registration.reference)
    names.delete(registration.name);
}
const finalizer = new FinalizationRegistry(release);
function observation(reference) {
  const node = (0, import_effect.createEffectNode)(() => {
    const controller = reference.deref();
    if (controller)
      controller.observe();
    else
      (0, import_effect.stopEffect)(node);
  });
  return node;
}
function writer(reference) {
  return () => isolated(() => reference.deref()?.drain());
}
class StorageController {
  raw;
  name;
  adapter;
  state;
  node;
  registration;
  writeAfterEffects;
  phase = "reading";
  generation = 0;
  localRevision = 0;
  baseline = false;
  lastObserved;
  confirmed;
  pending;
  inFlight;
  retry = false;
  constructor(raw, name, adapter) {
    this.raw = raw;
    this.name = name;
    this.adapter = adapter;
    this.state = (0, import_reactive.reactive)(raw);
    const reference = new WeakRef(this);
    this.node = observation(reference);
    this.writeAfterEffects = writer(reference);
    this.registration = { node: this.node, backend: new WeakRef(adapter), name, reference };
  }
  observe() {
    if (this.phase === "stopped")
      return;
    if (!this.baseline)
      this.localRevision++;
    (0, import_storageSnapshot.scanStorage)(this.raw);
    let snapshot;
    try {
      snapshot = (0, import_storageSnapshot.encodeStorage)(this.raw);
    } catch (error) {
      this.pending = void 0;
      this.retry = true;
      report(this.name, "encode", error);
      return;
    }
    const changed = snapshot !== this.lastObserved || this.retry;
    this.lastObserved = snapshot;
    if (!this.baseline && this.phase === "ready" && changed)
      this.queue(snapshot);
  }
  sample() {
    this.baseline = true;
    this.retry = false;
    try {
      (0, import_effect.runEffect)(this.node);
    } finally {
      this.baseline = false;
    }
  }
  start() {
    this.sample();
    let result;
    let promise;
    try {
      result = this.adapter.getItem(this.name);
      promise = asPromise(result);
    } catch (error) {
      this.readFailed("get", error);
      return;
    }
    if (!promise) {
      this.receive(result);
      return;
    }
    const generation = this.generation;
    void promise.then((value) => isolated(() => {
      if (!this.current(generation))
        return;
      try {
        this.receive(value);
      } catch (error) {
        report(this.name, "hydrate", error);
      }
    }), (error) => isolated(() => {
      if (this.current(generation))
        this.readFailed("get", error);
    })).catch((error) => report(this.name, "hydrate", error));
  }
  current(generation) {
    return this.phase !== "stopped" && generation === this.generation;
  }
  readFailed(phase, error) {
    report(this.name, phase, error);
    this.phase = "ready";
    this.pending = void 0;
    this.retry = false;
    this.sample();
  }
  receive(value) {
    if (value === null) {
      this.phase = "ready";
      this.sample();
      if (!this.retry && this.lastObserved !== void 0)
        this.queue(this.lastObserved);
      return;
    }
    let decoded;
    try {
      decoded = (0, import_storageSnapshot.decodeStorage)(value, this.raw);
    } catch (error) {
      this.readFailed("decode", error);
      return;
    }
    if (this.localRevision) {
      this.confirmed = decoded.snapshot;
      this.phase = "ready";
      this.sample();
      if (!this.retry && this.lastObserved !== void 0)
        this.queue(this.lastObserved);
      return;
    }
    let restore;
    try {
      restore = (0, import_storageSnapshot.prepareStorageRestore)(this.raw, decoded.data);
    } catch (error) {
      this.readFailed("restore", error);
      return;
    }
    this.confirmed = this.lastObserved = restore.snapshot;
    this.retry = false;
    this.phase = "ready";
    (0, import_batch.batch)(() => {
      restore.apply(this.state);
      this.sample();
    });
  }
  queue(snapshot) {
    this.retry = false;
    this.pending = snapshot;
    (0, import_effect.afterEffectsSettled)(this, this.writeAfterEffects);
  }
  drain() {
    if (this.phase !== "ready" || this.inFlight || this.pending === void 0)
      return;
    const snapshot = this.pending;
    this.pending = void 0;
    if (snapshot === this.confirmed)
      return;
    const attempt = this.inFlight = { snapshot, generation: this.generation };
    let promise;
    try {
      const result = this.adapter.setItem(this.name, snapshot);
      promise = asPromise(result);
      if (!promise && result !== void 0)
        throw new TypeError("storage setItem must return void or a PromiseLike");
    } catch (error) {
      this.written(attempt, false, error);
      return;
    }
    if (!promise) {
      this.written(attempt, true);
      return;
    }
    void promise.then(() => isolated(() => this.written(attempt, true)), (error) => isolated(() => this.written(attempt, false, error))).catch((error) => report(this.name, "set", error));
  }
  written(attempt, success, error) {
    if (!this.current(attempt.generation) || this.inFlight !== attempt)
      return;
    this.inFlight = void 0;
    if (success)
      this.confirmed = attempt.snapshot;
    else {
      this.retry = true;
      if (this.pending === attempt.snapshot)
        this.pending = void 0;
      report(this.name, "set", error);
    }
    if (this.pending !== void 0)
      (0, import_effect.afterEffectsSettled)(this, this.writeAfterEffects);
  }
  stop() {
    if (this.phase === "stopped")
      return;
    this.phase = "stopped";
    this.generation++;
    this.pending = this.inFlight = void 0;
    release(this.registration);
    finalizer.unregister(this.registration);
    if (roots.get(this.raw) === this)
      roots.delete(this.raw);
  }
}
function validAdapter(value) {
  return value !== null && (typeof value === "object" || typeof value === "function") && typeof Reflect.get(value, "getItem") === "function" && typeof Reflect.get(value, "setItem") === "function";
}
function backend(options) {
  if (options.adapter !== void 0) {
    if (!validAdapter(options.adapter))
      throw new TypeError("storage adapter requires getItem and setItem functions");
    return options.adapter;
  }
  try {
    const browser = globalThis.window;
    if (!browser)
      return void 0;
    const adapter = browser[options.type ?? "localStorage"];
    if (!validAdapter(adapter))
      throw new TypeError("Browser storage is unavailable");
    return adapter;
  } catch (error) {
    report(options.name, "access", error);
    return void 0;
  }
}
function storage(initialState, options) {
  return isolated(() => {
    if (!(0, import_storageSnapshot.isStorageRoot)(initialState))
      throw new TypeError("storage expects a plain object or array");
    if (!options || typeof options.name !== "string" || !options.name.trim())
      throw new TypeError("storage requires a non-empty name");
    if (options.type !== void 0 && options.type !== "localStorage" && options.type !== "sessionStorage") {
      throw new TypeError("storage type must be localStorage or sessionStorage");
    }
    const raw = (0, import_reactive.toRaw)(initialState);
    const adapter = backend(options);
    const previous = roots.get(raw);
    if (previous) {
      if (previous.adapter !== adapter || previous.name !== options.name)
        throw new TypeError("storage root is already bound to another key or adapter");
      return previous.state;
    }
    if (!adapter)
      return (0, import_reactive.reactive)(initialState);
    let names = backends.get(adapter);
    if (!names)
      backends.set(adapter, names = /* @__PURE__ */ new Map());
    for (const [name, reference] of names)
      if (!reference.deref())
        names.delete(name);
    if (names.get(options.name)?.deref())
      throw new TypeError("storage key already belongs to another root");
    const controller = new StorageController(raw, options.name, adapter);
    roots.set(raw, controller);
    names.set(options.name, controller.registration.reference);
    finalizer.register(controller, controller.registration, controller.registration);
    try {
      controller.start();
    } catch (error) {
      controller.stop();
      throw error;
    }
    return controller.state;
  });
}
function stopStorage(state) {
  roots.get((0, import_reactive.toRaw)(state))?.stop();
}
