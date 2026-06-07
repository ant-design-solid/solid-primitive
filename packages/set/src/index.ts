import { createTriggerCache } from '@solid-primitive/trigger'
import { batch } from 'solid-js'

const $ITERATE = Symbol('$__iterate')

export class ReactiveSet<T> extends Set<T> {
  #triggers = createTriggerCache()

  constructor(values?: Iterable<T> | null) {
    super()
    if (values) {
      for (const value of values) {
        super.add(value)
      }
    }
  }

  has(value: T): boolean {
    this.#triggers[0](value)
    return super.has(value)
  }

  get size() {
    this.#triggers[0]($ITERATE)
    return super.size
  }

  add(value: T): this {
    const hadValue = super.has(value)

    super.add(value)

    if (!hadValue) {
      batch(() => {
        this.#triggers[1]($ITERATE)
        this.#triggers[1](value)
      })
    }

    return this
  }

  delete(value: T): boolean {
    const result = super.delete(value)
    if (!result) return false

    batch(() => {
      this.#triggers[1]($ITERATE)
      this.#triggers[1](value)
    })

    return true
  }

  clear(): void {
    if (super.size === 0) return

    super.clear()
    this.#triggers[1]()
  }

  forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: any): void {
    this.#triggers[0]($ITERATE)
    return super.forEach(value => callbackfn.call(thisArg, value, value, this))
  }

  keys() {
    this.#triggers[0]($ITERATE)
    return super.keys()
  }

  values() {
    this.#triggers[0]($ITERATE)
    return super.values()
  }

  entries() {
    this.#triggers[0]($ITERATE)
    return super.entries()
  }

  [Symbol.iterator]() {
    this.#triggers[0]($ITERATE)
    return super[Symbol.iterator]()
  }
}

export class ReactiveWeakSet<T extends object> extends WeakSet<T> {
  #triggers = createTriggerCache(WeakMap)

  constructor(values?: Iterable<T> | null) {
    super()

    if (values) {
      for (const value of values) {
        super.add(value)
      }
    }
  }

  has(value: T): boolean {
    this.#triggers[0](value)
    return super.has(value)
  }

  add(value: T): this {
    const hadValue = super.has(value)

    super.add(value)

    if (!hadValue) {
      this.#triggers[1](value)
    }

    return this
  }

  delete(value: T): boolean {
    const result = super.delete(value)
    if (!result) return false

    this.#triggers[1](value)
    return true
  }
}

export function createSet<T>(values?: Iterable<T> | null): Set<T> {
  return new ReactiveSet(values)
}

export function createWeakSet<T extends object>(values?: Iterable<T> | null): WeakSet<T> {
  return new ReactiveWeakSet(values)
}
