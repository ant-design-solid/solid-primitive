import { isServer } from 'solid-js/web'
import {
  access,
  AnyFunction,
  MaybeAccessor,
  noop,
  PromisifyFunction,
  throttle,
  ThrottleOptions,
  tryOnCleanup,
} from '../utils'

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
