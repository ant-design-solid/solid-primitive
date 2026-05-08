export const noop = () => {}

export function toArray<T>(value: null | undefined): []
export function toArray<T>(value: T): T extends readonly unknown[] ? T : [T]
export function toArray<T>(value: T | null | undefined): unknown[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

export const hasOwn = <T extends object, K extends keyof T>(val: T, key: K): key is K =>
  Object.prototype.hasOwnProperty.call(val, key)
