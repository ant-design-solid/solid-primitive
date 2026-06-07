import { createEffect } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { withRoot } from '../../.test'
import { createMemoize } from './index'

const flush = () => Promise.resolve()

describe('createMemoize', () => {
  it('caches results for repeated calls with the same args', () => {
    let calls = 0
    const memoized = createMemoize((value: number) => {
      calls += 1
      return value + calls
    })

    expect(memoized(1)).toBe(2)
    expect(memoized(1)).toBe(2)
    expect(memoized.getKey(1)).toBe('[1]')
    expect(calls).toBe(1)
  })

  it('delete and clear invalidate cached entries', () => {
    let calls = 0
    const resolver = vi.fn((value: string) => {
      calls += 1
      return `${value}:${calls}`
    })
    const memoized = createMemoize(resolver)

    expect(memoized('a')).toBe('a:1')
    expect(memoized('b')).toBe('b:2')

    memoized.delete('a')
    expect(memoized('a')).toBe('a:3')
    expect(memoized('b')).toBe('b:2')

    memoized.clear()
    expect(memoized('b')).toBe('b:4')
  })

  it('invalidates tracked reads when using a plain external cache', async () => {
    await withRoot(async () => {
      const cache = new Map<string, string>()
      let calls = 0
      const memoized = createMemoize(
        (value: string) => {
          calls += 1
          return `${value}:${calls}`
        },
        { cache, getKey: value => value },
      )
      const read = vi.fn(() => memoized('a'))

      createEffect(read)
      await flush()

      expect(read).toHaveBeenCalledTimes(1)
      expect(read).toHaveLastReturnedWith('a:1')

      memoized.delete('a')
      await flush()

      expect(read).toHaveBeenCalledTimes(2)
      expect(read).toHaveLastReturnedWith('a:2')

      memoized.load('a')
      await flush()

      expect(read).toHaveBeenCalledTimes(3)
      expect(read).toHaveLastReturnedWith('a:3')
    })
  })
})
