import { createEffect } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { withRoot } from '../../.test'
import { createTrigger, createTriggerCache } from './index'

const flush = () => Promise.resolve()

describe('createTrigger', () => {
  it('dirty 应重新触发已 track 的依赖', async () => {
    await withRoot(async () => {
      const [track, dirty] = createTrigger()
      const effect = vi.fn(() => track())

      createEffect(effect)
      await flush()

      dirty()
      await flush()

      expect(effect).toHaveBeenCalledTimes(2)
    })
  })
})

describe('createTriggerCache', () => {
  it('dirty 应按 key 触发，dirtyAll 应触发全部已 track 的 key', async () => {
    await withRoot(async () => {
      const [track, dirty] = createTriggerCache<string>()
      const readA = vi.fn(() => track('a'))
      const readB = vi.fn(() => track('b'))

      createEffect(readA)
      createEffect(readB)
      await flush()

      dirty('a')
      await flush()

      expect(readA).toHaveBeenCalledTimes(2)
      expect(readB).toHaveBeenCalledTimes(1)

      dirty()
      await flush()

      expect(readA).toHaveBeenCalledTimes(3)
      expect(readB).toHaveBeenCalledTimes(2)
    })
  })
})
