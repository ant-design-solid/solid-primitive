import { createTriggerCache } from '@solid-primitive/trigger'
import { batch } from 'solid-js'

const $ITERATE = Symbol('$__iterate')

export class ReactiveMap<K, V> extends Map<K, V> {
  #keyTriggers = createTriggerCache()
  #valueTriggers = createTriggerCache()

  constructor(entries?: Iterable<readonly [K, V]> | null) {
    super()

    if (entries) {
      for (const [key, value] of entries) {
        super.set(key, value)
      }
    }
  }

  get(key: K): V | undefined {
    this.#valueTriggers[0](key)
    return super.get(key)
  }

  has(key: K): boolean {
    this.#keyTriggers[0](key)
    return super.has(key)
  }

  get size() {
    this.#keyTriggers[0]($ITERATE)
    return super.size
  }

  set(key: K, value: V): this {
    const hadKey = super.has(key)
    const hasChanged = super.get(key) !== value

    super.set(key, value)

    if (!hadKey || hasChanged) {
      batch(() => {
        if (!hadKey) {
          this.#keyTriggers[1]($ITERATE)
          this.#keyTriggers[1](key)
        }

        this.#valueTriggers[1]($ITERATE)
        this.#valueTriggers[1](key)
      })
    }

    return this
  }

  delete(key: K): boolean {
    const result = super.delete(key)
    if (!result) return false

    batch(() => {
      this.#keyTriggers[1]($ITERATE)
      this.#valueTriggers[1]($ITERATE)
      this.#keyTriggers[1](key)
      this.#valueTriggers[1](key)
    })

    return true
  }

  clear(): void {
    if (super.size === 0) return

    super.clear()

    batch(() => {
      this.#keyTriggers[1]()
      this.#valueTriggers[1]()
    })
  }

  forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void {
    this.#keyTriggers[0]($ITERATE)
    this.#valueTriggers[0]($ITERATE)

    return super.forEach((value, key) => callbackfn.call(thisArg, value, key, this))
  }

  keys() {
    this.#keyTriggers[0]($ITERATE)
    return super.keys()
  }

  values() {
    this.#valueTriggers[0]($ITERATE)
    return super.values()
  }

  entries() {
    this.#keyTriggers[0]($ITERATE)
    this.#valueTriggers[0]($ITERATE)
    return super.entries()
  }

  [Symbol.iterator]() {
    this.#keyTriggers[0]($ITERATE)
    this.#valueTriggers[0]($ITERATE)
    return super[Symbol.iterator]()
  }
}

export class ReactiveWeakMap<K extends object, V> extends WeakMap<K, V> {
  #keyTriggers = createTriggerCache(WeakMap)
  #valueTriggers = createTriggerCache(WeakMap)

  constructor(entries?: Iterable<readonly [K, V]> | null) {
    super()

    if (entries) {
      for (const [key, value] of entries) {
        super.set(key, value)
      }
    }
  }

  get(key: K): V | undefined {
    this.#valueTriggers[0](key)
    return super.get(key)
  }

  has(key: K): boolean {
    this.#keyTriggers[0](key)
    return super.has(key)
  }

  set(key: K, value: V): this {
    const hadKey = super.has(key)
    const hasChanged = super.get(key) !== value

    super.set(key, value)

    if (!hadKey || hasChanged) {
      batch(() => {
        if (!hadKey) {
          this.#keyTriggers[1](key)
        }

        this.#valueTriggers[1](key)
      })
    }

    return this
  }

  delete(key: K): boolean {
    const result = super.delete(key)
    if (!result) return false

    batch(() => {
      this.#keyTriggers[1](key)
      this.#valueTriggers[1](key)
    })

    return true
  }
}

export function createMap<K, V>(entries?: Iterable<readonly [K, V]> | null): Map<K, V> {
  return new ReactiveMap(entries)
}

export function createWeakMap<K extends object, V>(entries?: Iterable<readonly [K, V]> | null): WeakMap<K, V> {
  return new ReactiveWeakMap(entries)
}
