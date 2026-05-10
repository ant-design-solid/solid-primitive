import { AnyFunction } from './type'

interface ScheduledOptions {
  rejectOnCancel?: boolean
  leading?: boolean
  trailing?: boolean
}

export interface DebounceOptions extends ScheduledOptions {
  maxWait?: number
}

export interface ThrottleOptions extends ScheduledOptions {}

function settleInvocation<T extends AnyFunction>(
  callback: T,
  thisArg: ThisParameterType<T> | undefined,
  args: Parameters<T>,
  resolves: Array<(value: Awaited<ReturnType<T>>) => void>,
  rejects: Array<(reason?: any) => void>,
): Promise<Awaited<ReturnType<T>>> {
  try {
    const result = Promise.resolve(callback.apply(thisArg, args))
    result.then(
      value => resolves.forEach(resolve => resolve(value)),
      error => rejects.forEach(reject => reject(error)),
    )
    return result
  } catch (error) {
    const result = Promise.reject(error)
    rejects.forEach(reject => reject(error))
    return result
  }
}

export function debounce<T extends AnyFunction>(callback: T, wait: number = 200, options: DebounceOptions = {}) {
  const { maxWait, leading = true, trailing = false, rejectOnCancel } = options

  let timer: ReturnType<typeof setTimeout> | undefined
  let maxTimer: ReturnType<typeof setTimeout> | undefined
  let lastArgs: Parameters<T> | undefined
  let lastThis: ThisParameterType<T> | undefined
  let lastResult: Promise<Awaited<ReturnType<T>>> | undefined
  let pendingTrailing = false

  let resolves: Array<(value: Awaited<ReturnType<T>>) => void> = []
  let rejects: Array<(reason?: any) => void> = []

  const clear = (reason?: Error) => {
    if (timer) clearTimeout(timer)
    if (maxTimer) clearTimeout(maxTimer)
    timer = maxTimer = undefined
    lastArgs = undefined
    lastThis = undefined
    pendingTrailing = false

    if (reason && rejectOnCancel) {
      rejects.forEach(reject => reject(reason))
    }
    resolves = []
    rejects = []
  }

  const flush = () => {
    if (!lastArgs || !pendingTrailing) {
      clear()
      return
    }

    const currentResolves = resolves
    const currentRejects = rejects
    const currentArgs = lastArgs
    const currentThis = lastThis
    clear()
    lastResult = settleInvocation(callback, currentThis, currentArgs, currentResolves, currentRejects)
  }

  function wrapper(this: ThisParameterType<T>, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
    if (wait <= 0) {
      return Promise.resolve(callback.apply(this, args))
    }

    if (!leading && !trailing) {
      return Promise.resolve(undefined as Awaited<ReturnType<T>>)
    }

    const isLeadingCall = leading && !timer

    lastArgs = args
    lastThis = this

    if (trailing) {
      pendingTrailing = pendingTrailing || !isLeadingCall
    }

    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      flush()
    }, wait)

    if (trailing && maxWait && !maxTimer) {
      maxTimer = setTimeout(() => {
        flush()
      }, maxWait)
    }

    if (isLeadingCall) {
      lastResult = settleInvocation(callback, this, args, [], [])
      return lastResult
    }

    if (trailing) {
      return new Promise((resolve, reject) => {
        resolves.push(resolve)
        rejects.push(reject)
      })
    }

    return lastResult ?? Promise.resolve(undefined as Awaited<ReturnType<T>>)
  }

  return Object.assign(wrapper, { clear: () => clear(new Error('Debounce cancelled')) })
}

export function throttle<T extends AnyFunction>(callback: T, wait: number = 200, options: ThrottleOptions = {}) {
  const { leading = true, trailing = false, rejectOnCancel = false } = options

  let timer: ReturnType<typeof setTimeout> | undefined
  let lastInvokeTime = 0
  let lastArgs: Parameters<T> | undefined
  let lastThis: ThisParameterType<T> | undefined
  let lastResult: Promise<Awaited<ReturnType<T>>> | undefined

  let resolves: Array<(value: Awaited<ReturnType<T>>) => void> = []
  let rejects: Array<(reason?: any) => void> = []

  const clear = (reason?: Error) => {
    if (timer) clearTimeout(timer)
    timer = undefined
    lastArgs = undefined
    lastThis = undefined

    if (reason && rejectOnCancel) {
      rejects.forEach(reject => reject(reason))
    }
    resolves = []
    rejects = []
  }

  const flush = (invokeTime: number) => {
    if (!lastArgs || !resolves.length) {
      clear()
      return
    }

    const currentResolves = resolves
    const currentRejects = rejects
    const currentArgs = lastArgs
    const currentThis = lastThis
    clear()
    lastInvokeTime = invokeTime
    lastResult = settleInvocation(callback, currentThis, currentArgs, currentResolves, currentRejects)
  }

  function wrapper(this: ThisParameterType<T>, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
    if (wait <= 0) {
      return Promise.resolve(callback.apply(this, args))
    }

    if (!leading && !trailing) {
      return Promise.resolve(undefined as Awaited<ReturnType<T>>)
    }

    const now = Date.now()
    const canInvokeLeading = leading && (!lastInvokeTime || now - lastInvokeTime >= wait)

    lastArgs = args
    lastThis = this

    if (canInvokeLeading) {
      if (timer) {
        clearTimeout(timer)
        timer = undefined
      }

      if (resolves.length) {
        return new Promise((resolve, reject) => {
          resolves.push(resolve)
          rejects.push(reject)
          flush(now)
        })
      }

      lastInvokeTime = now
      lastResult = settleInvocation(callback, this, args, [], [])
      return lastResult
    }

    if (trailing) {
      if (!lastInvokeTime) {
        lastInvokeTime = now
      }

      const remaining = wait - (now - lastInvokeTime)

      return new Promise((resolve, reject) => {
        resolves.push(resolve)
        rejects.push(reject)

        if (!timer) {
          timer = setTimeout(
            () => {
              timer = undefined
              flush(Date.now())
            },
            Math.max(remaining, 0),
          )
        }
      })
    }

    return lastResult ?? Promise.resolve(undefined as Awaited<ReturnType<T>>)
  }

  return Object.assign(wrapper, { clear: () => clear(new Error('Throttle cancelled')) })
}
