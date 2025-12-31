import {Fn} from '../..'

const isDev = process.env.NODE_ENV === 'development'

export const logPrefix = '[@canlooks/reactive] '

export const DEBUG_NAME = Symbol('debug name')

function getName(it?: any) {
    return it ? it[DEBUG_NAME] || it.name : void 0
}

export function printError(fn?: Fn, target?: any, p?: PropertyKey) {
    if (isDev) {
        if (target && p) {
            const targetName = getName(target) || getName(target.constructor) || '[unknown]'
            const propertyName = p?.toString() || '[unknown]'
            console.error(`${logPrefix}This error occurred in "${targetName}.${propertyName}"`)
        } else {
            const fnName = getName(fn)
            fnName && console.error(`${logPrefix}This error occurred in function "${fnName}"`)
        }
    }
}