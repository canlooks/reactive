import { acknowledgeNotification, acknowledgeReads, captureDependencies, createEffectNode, enqueueEffect, onBatchSettled, readsAreCurrent, replaceDeps, runInBatch, stopEffect, withReadView, } from '../effect.js';
import { PropsCell } from './props.js';
let rendering;
export function currentRender() { return rendering; }
function isCurrent(attempt) {
    return (!attempt.reads || readsAreCurrent(attempt.reads))
        && [...attempt.view.computations.values()].every(candidate => readsAreCurrent(candidate.reads));
}
/** All permanent subscriptions originate in commit/subscribe, never render. */
export class Observer {
    props;
    node;
    listener;
    committed;
    version = 0;
    commitId = 0;
    mounted = false;
    constructor(props, wholeObject = false) { this.props = new PropsCell(props, wholeObject); }
    attempt(props) {
        return { props, view: this.props.view(props), watches: [], commits: [], version: this.version,
            staleToken: Symbol('stale render'), sealed: false };
    }
    render(attempt, fn) {
        const previous = rendering;
        rendering = attempt;
        try {
            const candidate = withReadView(attempt.view, () => captureDependencies(fn));
            attempt.reads = candidate.reads;
            return candidate.value;
        }
        finally {
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
            this.node = createEffectNode(() => { });
            this.node.notify = () => {
                this.version++;
                this.listener?.();
            };
            if (this.committed?.reads)
                replaceDeps(this.node, this.committed.reads.keys());
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
            this.listener = undefined;
        if (this.node)
            stopEffect(this.node);
        this.node = undefined;
        for (const registration of this.committed?.commits ?? [])
            registration.stop();
        for (const watch of this.committed?.watches ?? [])
            watch.stop();
    }
    commit(attempt) {
        try {
            this.commitAttempt(attempt);
        }
        catch (error) {
            // A later setup can fail before earlier hooks have registered their
            // React cleanups. The coordinator already owns all their handles.
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
        runInBatch(() => {
            for (const registration of attempt.commits)
                registration.publish();
            const receipt = this.props.publish(attempt.props, { owner: this, commit });
            // React can check this render's snapshot before an enclosing batch
            // settles. Acknowledge only these exact own-props version increments
            // now; publishing caches/subscriptions and watcher baselines still waits.
            if (attempt.reads)
                acknowledgeReads(attempt.reads, receipt);
            for (const candidate of attempt.view.computations.values())
                acknowledgeReads(candidate.reads, receipt);
            onBatchSettled(this, () => {
                if (!this.mounted || this.committed !== attempt)
                    return;
                const current = isCurrent(attempt);
                if (current) {
                    // Candidates are inserted after their dependencies (postorder).
                    for (const candidate of attempt.view.computations.values())
                        candidate.adopt();
                    acknowledgeNotification(this.node, this, commit);
                }
                if (attempt.reads)
                    replaceDeps(this.node, attempt.reads.keys());
                attempt.sealed = current;
                // Finalizers publish only internal state. React callbacks run in
                // the shared queue, after every owner's candidate is installed.
                if (!current)
                    enqueueEffect(this.node);
            }, () => {
                if (this.mounted && this.committed === attempt) {
                    for (const watch of attempt.watches)
                        watch.finish();
                }
            });
        });
        // Even an enclosing public batch must not defer a new watch's setup.
        if (this.mounted && this.committed === attempt) {
            for (const watch of attempt.watches)
                watch.initialize();
        }
    }
}
