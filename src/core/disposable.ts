/**
 * 可销毁的对象，Proxyable，Effect类会继承
 */
export class Disposable {
    private disposers = new Set<() => void>()

    addDisposer(disposer: () => void) {
        this.disposers.add(disposer)
    }

    dispose() {
        for (const disposer of this.disposers) {
            disposer()
        }
        this.disposers.clear()
    }
}