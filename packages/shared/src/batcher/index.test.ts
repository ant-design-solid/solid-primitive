import { createRoot } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withRoot } from '../../../.test'

import { $DISCARD, createBatcher } from './'

describe('createBatcher', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('executes queued tasks in submit order', async () => {
    await withRoot(async () => {
      const order: number[] = []
      const batcher = createBatcher()

      const first = batcher.submit(() => {
        order.push(1)
        return 'first'
      })
      const second = batcher.submit(() => {
        order.push(2)
        return 'second'
      })

      await expect(first).resolves.toBe('first')
      await expect(second).resolves.toBe('second')
      expect(order).toEqual([1, 2])
      expect(batcher.isPending()).toBe(false)
    })
  })

  it('keeps only the latest task in latest strategy', async () => {
    await withRoot(async () => {
      const order: string[] = []
      const batcher = createBatcher({
        strategy: 'latest',
      })

      const first = batcher.submit(() => {
        order.push('first')
        return 'first'
      })
      const second = batcher.submit(() => {
        order.push('second')
        return 'second'
      })

      await expect(first).resolves.toBe($DISCARD)
      await expect(second).resolves.toBe('second')
      expect(order).toEqual(['second'])
      expect(batcher.isPending()).toBe(false)
    })
  })

  it('settles pending tasks with $DISCARD when canceled', async () => {
    await withRoot(async () => {
      const batcher = createBatcher()

      const task = batcher.submit(() => 'done')
      batcher.cancel()

      await expect(task).resolves.toBe($DISCARD)
      expect(batcher.isPending()).toBe(false)
    })
  })

  it('cancels queued tasks that have not run yet during drain', async () => {
    await withRoot(async () => {
      const order: string[] = []
      const batcher = createBatcher()

      let release!: () => void
      const gate = new Promise<void>(resolve => {
        release = resolve
      })

      const first = batcher.submit(async () => {
        order.push('first')
        await gate
        return 'first'
      })
      const second = batcher.submit(() => {
        order.push('second')
        return 'second'
      })

      await Promise.resolve()
      batcher.cancel()
      release()

      await expect(first).resolves.toBe('first')
      await expect(second).resolves.toBe($DISCARD)
      expect(order).toEqual(['first'])
      expect(batcher.isPending()).toBe(false)
    })
  })

  it('falls back to defer when animationFrame is unavailable', async () => {
    await withRoot(async () => {
      const originalRaf = globalThis.requestAnimationFrame
      const originalCancelRaf = globalThis.cancelAnimationFrame

      vi.stubGlobal('requestAnimationFrame', undefined)
      vi.stubGlobal('cancelAnimationFrame', undefined)

      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
      const batcher = createBatcher({ schedule: 'animationFrame' })

      const task = batcher.submit(() => 'done')

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
