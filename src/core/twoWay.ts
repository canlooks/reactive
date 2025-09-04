export class TwoWay<T = any, P extends keyof T = any> {
    static stacks: TwoWay[] = []

    refer<T>(refer: () => T): T {
        try {
            TwoWay.stacks.push(this)
            return refer()
        } finally {
            TwoWay.stacks.pop()
        }
    }

    private target?: T
    private p?: P

    link(target: T, p: P) {
        this.target = target
        this.p = p
    }

    get isBound() {
        return !!this.target
    }

    getValue() {
        return this.p && this.target?.[this.p]
    }

    setValue(value: any) {
        if (this.target && this.p) {
            this.target[this.p] = value
        }
    }

    private updatingStackCount = 0

    putIn(value: any) {
        !this.updatingStackCount++ && this.setValue(value)
    }

    tackOut(value: any) {
        !--this.updatingStackCount && this.setValue(value)
    }
}