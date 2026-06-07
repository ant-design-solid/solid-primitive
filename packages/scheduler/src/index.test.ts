import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withRoot } from '../../.test'

import { $DISCARD, createTaskQueue } from './'

describe('createTaskQueue', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('executes queued tasks in submit order', async () => {
    await withRoot(async () => {
      const order: number[] = []
      const queue = createTaskQueue()

      const first = queue.submit(() => {
        order.push(1)
        return 'first'
      })
      const second = queue.submit(() => {
        order.push(2)
        return 'second'
      })

      await expect(first).resolves.toBe('first')
      await expect(second).resolves.toBe('second')
      expect(order).toEqual([1, 2])
      expect(queue.pending()).toBe(false)
    })
  })

  it('keeps only the latest task in latest strategy', async () => {
    await withRoot(async () => {
      const order: string[] = []
      const queue = createTaskQueue({
        strategy: 'latest',
      })

      const first = queue.submit(() => {
        order.push('first')
        return 'first'
      })
      const second = queue.submit(() => {
        order.push('second')
        return 'second'
      })

      await expect(first).resolves.toBe($DISCARD)
      await expect(second).resolves.toBe('second')
      expect(order).toEqual(['second'])
      expect(queue.pending()).toBe(false)
    })
  })

  it('settles pending tasks with $DISCARD when canceled', async () => {
    await withRoot(async () => {
      const queue = createTaskQueue()

      const task = queue.submit(() => 'done')
      queue.clear()

      await expect(task).resolves.toBe($DISCARD)
      expect(queue.pending()).toBe(false)
    })
  })

  it('cancels queued tasks that have not run yet during drain', async () => {
    await withRoot(async () => {
      const order: string[] = []
      const queue = createTaskQueue()

      let release!: () => void
      const gate = new Promise<void>(resolve => {
        release = resolve
      })

      const first = queue.submit(async () => {
        order.push('first')
        await gate
        return 'first'
      })
      const second = queue.submit(() => {
        order.push('second')
        return 'second'
      })

      await Promise.resolve()
      queue.clear()
      release()

      await expect(first).resolves.toBe('first')
      await expect(second).resolves.toBe($DISCARD)
      expect(order).toEqual(['first'])
      expect(queue.pending()).toBe(false)
    })
  })

  it('falls back to defer when animationFrame is unavailable', async () => {
    await withRoot(async () => {
      const originalRaf = globalThis.requestAnimationFrame
      const originalCancelRaf = globalThis.cancelAnimationFrame

      vi.stubGlobal('requestAnimationFrame', undefined)
      vi.stubGlobal('cancelAnimationFrame', undefined)

      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
      const queue = createTaskQueue({ schedule: 'animationFrame' })

      const task = queue.submit(() => 'done')

      await expect(task).resolves.toBe('done')
      expect(setTimeoutSpy).not.toHaveBeenCalled()

      if (originalRaf === undefined) {
        vi.unstubAllGlobals()
      } else {
        vi.stubGlobal('requestAnimationFrame', originalRaf)
        vi.stubGlobal('cancelAnimationFrame', originalCancelRaf)
      }
    })
  })
})
