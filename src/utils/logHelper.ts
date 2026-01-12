const isDev = process.env.NODE_ENV === 'development'
const debug = process.env.DEBUG?.toLowerCase() === 'true' || process.env.DEBUG?.toLowerCase() === 'on'

export const logPrefix = '[@canlooks/reactive] '

export const DEBUG_NAME = Symbol('debug name')

function getName(it?: any) {
    return it ? it[DEBUG_NAME] || it.name : void 0
}

export function printError(target?: any, p?: PropertyKey) {
    if (isDev || debug) {
        const targetName = getName(target) || getName(target?.constructor) || '[unknown]'
        const propertyName = p?.toString() || '[unknown]'
        console.error(`${logPrefix}This error occurred in "${targetName}.${propertyName}"`)
    }
}