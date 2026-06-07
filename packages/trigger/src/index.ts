import { createSignal, DEV, getListener, onCleanup, SignalOptions } from 'solid-js'
import { isServer } from 'solid-js/web'
import { noop } from '@solid-primitive/utils'

const triggerOptions: SignalOptions<undefined> = DEV ? { equals: false, name: 'trigger' } : { equals: false }

interface InternalNode {
  $: VoidFunction
  $$: VoidFunction
  n: number
}

interface DirtyTrigger<T> {
  (): void
  (key: T): void
}

type TriggerCache<T> = [track: (key: T) => void, dirty: DirtyTrigger<T>]

export function createTriggerCache<T = any>(): TriggerCache<T>
export function createTriggerCache<T extends object>(mapConstructor: WeakMapConstructor): TriggerCache<T>
export function createTriggerCache<T>(mapConstructor: MapConstructor): TriggerCache<T>
export function createTriggerCache<T extends object>(mapConstructor: WeakMapConstructor | MapConstructor = Map) {
  const cache: Map<T, InternalNode> = new (mapConstructor as any)()

  const track = (key: T) => {
    if (isServer || !getListener()) return

    let node = cache.get(key)

    if (!node) {
      const [$, $$] = createSignal(undefined, triggerOptions)
      cache.set(key, (node = { $, $$, n: 1 }))
    } else {
      node.n++
    }

    onCleanup(() => {
      if (--node.n === 0) {
        queueMicrotask(() => node.n === 0 && cache.delete(key))
      }
    })

    node.$()
  }

  const dirty = (...args: [T] | never[]) => {
    if (isServer) return
    if (!args.length) {
      cache.forEach?.(node => node.$$())
    } else {
      cache.get(args[0])?.$$()
    }
  }

  return [track, dirty] as const
}

export function createTrigger() {
  if (isServer) {
    return [noop, noop]
  }
  return createSignal(undefined, triggerOptions)
}
