import {Effect, Payload} from './effect'

export class Batch {
    static batchingStackCount = 0

    static batchingEffects = new Map<Effect, Payload>()

    static startBatch() {
        this.batchingStackCount++
    }

    static addEffect(effect: Effect, payload: Payload) {
        this.batchingEffects.set(effect, payload)
    }

    static endBatch() {
        if (!--this.batchingStackCount) {
            // 执行批量操作
            for (const [effect, payload] of this.batchingEffects) {
                effect.callback(payload)
            }
            this.batchingEffects.clear()
        }
    }
}