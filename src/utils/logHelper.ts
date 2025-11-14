import {Fn} from '../..'

const isDev = process.env.NODE_ENV === 'development'

export const logPrefix = '[@canlooks/reactive] '

export function printError(fn?: Fn, target?: any, p?: PropertyKey) {
    if (isDev) {
        if (target && p) {
            const targetName = target.name || target.constructor.name || '[unknown]'
            const propertyName = p?.toString() || '[unknown]'
            console.error(`${logPrefix}This error occured in "${targetName}.${propertyName}"`)
        } else {
            fn?.name && console.error(`${logPrefix}This error occured in function "${fn.name}"`)
        }
    }
}