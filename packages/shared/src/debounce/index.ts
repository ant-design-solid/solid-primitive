import { isServer } from 'solid-js/web'
import {
  access,
  type AnyFunction,
  debounce,
  type DebounceOptions,
  type MaybeAccessor,
  type PromisifyFunction,
  tryOnCleanup,
} from '../utils'

export function useDebounce<T extends AnyFunction>(
  fn: T,
  ms: MaybeAccessor<number> = 200,
  options: DebounceOptions = {},
): PromisifyFunction<T> {
  if (isServer) {
    return Object.assign(() => Promise.resolve() as Promise<Awaited<ReturnType<T>>>, { clear: () => void 0 })
  }

  const debounced = debounce(fn, access(ms), options)
  tryOnCleanup(() => debounced.clear())
  return debounced
}
