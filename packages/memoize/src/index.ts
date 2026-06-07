import { createTriggerCache } from '@solid-primitive/trigger'
import { isMap } from '@solid-primitive/utils/shared'

export type CreateMemoizeCache<Key, Value> = Key extends object
  ? Map<Key, Value> | WeakMap<Key, Value>
  : Map<Key, Value>

export interface CreateMemoizeReturn<Result, Args extends unknown[], Key = any> {
  (...args: Args): Result

  load: (...args: Args) => Result

  delete: (...args: Args) => void

  clear: () => void

  getKey: (...args: Args) => Key

  cache: CreateMemoizeCache<Key, Result>
}

export interface CreateMemoizeOptions<Result, Args extends unknown[], Key = any> {
  getKey?: (...args: Args) => Key

  cache?: CreateMemoizeCache<Key, Result>
}

export function createMemoize<Result, Args extends unknown[], Key = any>(
  resolver: (...args: Args) => Result,
  options: CreateMemoizeOptions<Result, Args, Key> = {},
): CreateMemoizeReturn<Result, Args> {
  const { cache = new Map() } = options
  const isMapCache = isMap(cache)
  const [track, dirty] = createTriggerCache<Key>(isMapCache ? Map : (WeakMap as any))

  const getKey = (...args: Args) => (options.getKey ? options.getKey(...args) : (JSON.stringify(args) as Key))

  const _load = (key: Key, shouldDirty: boolean, ...args: Args) => {
    const value = resolver(...args)
    cache.set(key, value)
    shouldDirty && dirty(key)
    return value
  }

  const load = (...args: Args): Result => _load(getKey(...args), true, ...args)

  const deleteByArgs = (...args: Args): void => {
    const key = getKey(...args)
    cache.delete(key) && dirty(key)
  }

  const clear = (): void => {
    if (!isMapCache || cache.size === 0) return

    cache.clear()
    dirty()
  }

  const memoized = Object.assign(
    (...args: Args): Result => {
      const key = getKey(...args)

      track(key)

      return cache.has(key) ? (cache.get(key) as Result) : _load(key, false, ...args)
    },
    {
      load,
      delete: deleteByArgs,
      clear,
      getKey,
      cache,
    },
  )

  return memoized
}
