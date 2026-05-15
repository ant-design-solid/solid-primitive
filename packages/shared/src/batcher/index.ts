import { batch, createSignal, type Accessor } from 'solid-js'
import { tryOnCleanup } from '../utils'

export type BatcherSchedule = 'microtask' | 'defer' | 'animationFrame'
export type BatcherStrategy = 'queue' | 'latest'
export const $DISCARD = Symbol('BATCHER_DISCARD')
export type BatcherDiscard = typeof $DISCARD

function timeoutFlush(callback: VoidFunction, delay = 0) {
  const id = setTimeout(callback, delay)
  return () => clearTimeout(id)
}

function microtaskFlush(callback: VoidFunction) {
  let canceled = false
  const schedule =
    typeof queueMicrotask === 'function' ? queueMicrotask : (fn: VoidFunction) => Promise.resolve().then(fn)

  schedule(() => {
    if (!canceled) {
      callback()
    }
  })

  return () => {
    canceled = true
  }
}

function deferFlush(callback: VoidFunction) {
  if (typeof MessageChannel === 'undefined') {
    return timeoutFlush(callback)
  }

  const channel = new MessageChannel()

  channel.port1.onmessage = () => {
    channel.port1.close()
    channel.port2.close()
    callback()
  }
  channel.port2.postMessage(undefined)

  return () => {
    channel.port1.close()
    channel.port2.close()
  }
}

function flushSchedule(mode: BatcherSchedule, callback: VoidFunction) {
  if (mode === 'microtask') {
    return microtaskFlush(callback)
  }

  if (mode === 'defer') {
    return deferFlush(callback)
  }

  if (typeof requestAnimationFrame !== 'undefined') {
    const id = requestAnimationFrame(callback)
    return () => cancelAnimationFrame(id)
  }

  return deferFlush(callback)
}

interface PendingTask<T = unknown> {
  run: () => unknown | Promise<unknown>
  resolve: (value: T | BatcherDiscard) => void
  reject: (error: unknown) => void
}

export interface BatcherOptions {
  /**
   * @default 'microtask'
   * `animationFrame` falls back to `defer` outside DOM environments.
   */
  schedule?: BatcherSchedule
  /**
   * @default 'queue'
   */
  strategy?: BatcherStrategy
}

export interface Batcher {
  isPending: Accessor<boolean>
  submit<T>(task: () => T | Promise<T>): Promise<T | BatcherDiscard>
  flush(): Promise<void>
  cancel(): void
  stop(): void
}

export function createBatcher(options: BatcherOptions = {}): Batcher {
  const { schedule = 'microtask', strategy = 'queue' } = options

  let queuedTasks: PendingTask[] = []
  let drainingTasks: PendingTask[] = []
  let latestTask: PendingTask | null = null
  let disposed = false
  let currentDrain: Promise<void> | null = null

  const [cancelFlush, setCancelFlush] = createSignal<VoidFunction>()
  const [isPending, setIsPending] = createSignal(false)

  const hasBufferedTasks = () => queuedTasks.length > 0 || drainingTasks.length > 0 || latestTask !== null

  const syncPendingState = () => {
    setIsPending(!!cancelFlush() || !!currentDrain || hasBufferedTasks())
  }

  const settleDiscard = (task: PendingTask) => {
    task.resolve($DISCARD)
  }

  const takeNextTask = () => {
    if (strategy === 'latest') {
      if (!latestTask) {
        return
      }

      const task = latestTask
      latestTask = null
      return task
    }

    if (!drainingTasks.length && queuedTasks.length) {
      drainingTasks = queuedTasks
      queuedTasks = []
    }

    return drainingTasks.shift()
  }

  const runTask = async (task: PendingTask) => {
    try {
      // 同步任务里的 signal 更新合并到一个 batch 中，减少额外响应式开销。
      const result = batch(() => task.run())
      task.resolve(await result)
    } catch (error) {
      task.reject(error)
    }
  }

  const scheduleFlush = () => {
    if (disposed || currentDrain || cancelFlush() || !hasBufferedTasks()) {
      syncPendingState()
      return
    }

    const cancel = flushSchedule(schedule, () => {
      setCancelFlush(undefined)
      syncPendingState()
      void drain()
    })

    setCancelFlush(() => cancel)
    syncPendingState()
  }

  const drain = async () => {
    if (currentDrain) {
      return currentDrain
    }

    currentDrain = (async () => {
      try {
        while (!disposed) {
          const task = takeNextTask()
          if (!task) {
            break
          }

          await runTask(task)
        }
      } finally {
        currentDrain = null
        if (!disposed && hasBufferedTasks()) {
          scheduleFlush()
        } else {
          syncPendingState()
        }
      }
    })()

    syncPendingState()
    return currentDrain
  }

  const submit = <T>(task: () => T | Promise<T>) => {
    if (disposed) {
      return Promise.resolve<T | BatcherDiscard>($DISCARD)
    }

    return new Promise<T | BatcherDiscard>((resolve, reject) => {
      const pendingTask = {
        run: task,
        resolve,
        reject,
      } as PendingTask

      if (strategy === 'latest') {
        if (latestTask) {
          settleDiscard(latestTask)
        }
        latestTask = pendingTask
      } else {
        queuedTasks.push(pendingTask)
      }

      syncPendingState()
      scheduleFlush()
    })
  }

  const flush = async () => {
    if (disposed) {
      return
    }

    const cancel = cancelFlush()
    if (cancel) {
      cancel()
      setCancelFlush(undefined)
    }

    syncPendingState()
    await drain()
  }

  const cancel = () => {
    const scheduledCancel = cancelFlush()
    if (scheduledCancel) {
      scheduledCancel()
      setCancelFlush(undefined)
    }

    const tasks = queuedTasks
    const draining = drainingTasks
    const latest = latestTask
    queuedTasks = []
    drainingTasks = []
    latestTask = null

    tasks.forEach(settleDiscard)
    draining.forEach(settleDiscard)
    if (latest) {
      settleDiscard(latest)
    }

    syncPendingState()
  }

  const stop = () => {
    disposed = true
    cancel()
  }

  tryOnCleanup(stop)

  return {
    isPending,
    submit,
    flush,
    cancel,
    stop,
  }
}
