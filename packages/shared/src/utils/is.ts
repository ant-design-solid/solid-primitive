export const isObject = (v: any): v is object => v !== null && typeof v === 'object'

export const toTypeString = (val: unknown) => Object.prototype.toString.call(val)

export const toRawType = (value: unknown): string => toTypeString(value).slice(8, -1)

export const isPlainObject = (v: any): v is Record<string, any> => isObject(v) && toTypeString(v) === '[object Object]'

export const isNil = (v: unknown): v is null | undefined => v == null

export const isNonNullable = <T = any>(val?: T | null | undefined): val is T => val != null

export const isFunction = (val: unknown): val is Function => typeof val === 'function'

export const isArray: <T = any>(val: unknown) => val is T[] = Array.isArray

export const isString = (val: unknown): val is string => typeof val === 'string'

export const isNumber = (val: unknown): val is number => typeof val === 'number'

export const isNumString = (str: unknown): boolean => isString(str) && /^\d+(\.\d+)?$/.test(str)

export const isNumeric = (val: unknown): val is string | number => isNumber(val) || isNumString(val)

export const isMap = <K = any, V = any>(value: unknown): value is Map<K, V> => toRawType(value) === 'Map'
