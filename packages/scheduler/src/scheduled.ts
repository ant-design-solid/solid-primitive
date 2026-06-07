import {
  access,
  AnyFunction,
  debounce,
  DebounceOptions,
  MaybeAccessor,
  noop,
  PromisifyFunction,
  throttle,
  ThrottleOptions,
  tryOnCleanup,
} from '@solid-primitive/utils'
import { isServer } from 'solid-js/web'

export function useThrottle<T extends AnyFunction>(
  fn: T,
  ms: MaybeAccessor<number> = 200,
  options: ThrottleOptions = {},
): PromisifyFunction<T> {
  if (isServer) {
    return Object.assign(() => Promise.resolve() as Promise<Awaited<ReturnType<T>>>, { clear: noop })
  }

  const throttled = throttle(fn, access(ms), options)
  tryOnCleanup(() => throttled.clear())
  return throttled
}

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
