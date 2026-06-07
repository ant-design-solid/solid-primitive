import { createEffect } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { withRoot } from '../../.test'
import { createSet, createWeakSet, ReactiveSet, ReactiveWeakSet } from './index'

const flush = () => Promise.resolve()

describe('set', () => {
  it('应保留原生 Set 的 instanceof 语义', () => {
    expect(createSet()).toBeInstanceOf(Set)
    expect(createWeakSet()).toBeInstanceOf(WeakSet)
    expect(createSet()).toBeInstanceOf(ReactiveSet)
    expect(createWeakSet()).toBeInstanceOf(ReactiveWeakSet)
  })

  it('Set 重复 add 不应触发依赖，新增值应触发迭代依赖', async () => {
    await withRoot(async () => {
      const set = createSet(['a'])
      const readValues = vi.fn(() => [...set])

      createEffect(readValues)
      await flush()

      set.add('a')
      await flush()
      expect(readValues).toHaveBeenCalledTimes(1)

      set.add('b')
      await flush()
      expect(readValues).toHaveBeenCalledTimes(2)
    })
  })
})
