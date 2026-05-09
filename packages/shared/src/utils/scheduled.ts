import { AnyFunction } from './type'

export interface DebounceOptions {
  maxWait?: number
  rejectOnCancel?: boolean
}

export function debounce<T extends AnyFunction>(callback: T, wait: number = 200, options: DebounceOptions = {}) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let maxTimer: ReturnType<typeof setTimeout> | undefined

  // 队列：用于收集防抖周期内所有的 Promise 控制器，避免内存泄漏
  let resolves: Array<(value: Awaited<ReturnType<T>>) => void> = []
  let rejects: Array<(reason?: any) => void> = []

  const clear = (reason?: Error) => {
    if (timer) clearTimeout(timer)
    if (maxTimer) clearTimeout(maxTimer)
    timer = maxTimer = undefined

    // 2. 实现 rejectOnCancel 逻辑，清空队列防止挂起
    if (reason && options.rejectOnCancel) {
      rejects.forEach(reject => reject(reason))
    }
    resolves = []
    rejects = []
  }

  function wrapper(this: any, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
    if (wait <= 0) {
      return Promise.resolve(callback.apply(this, args))
    }

    return new Promise((resolve, reject) => {
      resolves.push(resolve)
      rejects.push(reject)

      const invoke = () => {
        const currentResolves = resolves
        const currentRejects = rejects
        clear() // 执行前清理定时器和队列状态

        try {
          const result = callback.apply(this, args)
          // 3. 统一处理同步/异步返回值，将结果分发给所有等待的 Promise
          Promise.resolve(result)
            .then(res => currentResolves.forEach(r => r(res)))
            .catch(err => currentRejects.forEach(r => r(err)))
        } catch (error) {
          currentRejects.forEach(r => r(error))
        }
      }

      // 常规防抖重置
      if (timer) clearTimeout(timer)
      timer = setTimeout(invoke, wait)

      // 4. 实现 maxWait 逻辑：保证在最大等待时间内至少执行一次
      if (options.maxWait && !maxTimer) {
        maxTimer = setTimeout(invoke, options.maxWait)
      }
    })
  }

  return Object.assign(wrapper, { clear: () => clear(new Error('Debounce cancelled')) })
}
