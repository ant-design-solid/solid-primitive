import { describe, expect, it, vi } from 'vitest'
import { debounce, throttle } from './scheduled'

describe('debounce', () => {
  it('默认应领先触发且不执行尾随调用', async () => {
    vi.useFakeTimers()

    try {
      const callback = vi.fn((value: string) => value)
      const debounced = debounce(callback, 10)

      await expect(debounced('a')).resolves.toBe('a')
      await expect(debounced('b')).resolves.toBe('a')
      await vi.advanceTimersByTimeAsync(10)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenLastCalledWith('a')
    } finally {
      vi.useRealTimers()
    }
  })

  it('trailing 模式应使用最后一次调用的 this 与参数执行', async () => {
    vi.useFakeTimers()

    try {
      const callback = vi.fn(function (this: { prefix: string }, value: string) {
        return `${this.prefix}:${value}`
      })

      const debounced = debounce(callback, 10, { leading: false, trailing: true })
      const first = { prefix: 'first' }
      const second = { prefix: 'second' }

      const firstPromise = debounced.call(first, 'a')
      const secondPromise = debounced.call(second, 'b')

      await vi.advanceTimersByTimeAsync(10)

      await expect(firstPromise).resolves.toBe('second:b')
      await expect(secondPromise).resolves.toBe('second:b')
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback.mock.calls[0]).toEqual(['b'])
      expect(callback.mock.contexts[0]).toBe(second)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('throttle', () => {
  it('默认应领先触发且不执行尾随调用', async () => {
    vi.useFakeTimers()

    try {
      const callback = vi.fn((value: string) => value)
      const throttled = throttle(callback, 10)

      await expect(throttled('a')).resolves.toBe('a')
      await expect(throttled('b')).resolves.toBe('a')
      await vi.advanceTimersByTimeAsync(10)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenLastCalledWith('a')
    } finally {
      vi.useRealTimers()
    }
  })

  it('leading + trailing 模式应立即执行首次调用，并在间隔内合并后续调用', async () => {
    vi.useFakeTimers()

    try {
      const callback = vi.fn((value: string) => value)
      const throttled = throttle(callback, 10, { trailing: true })

      await expect(throttled('a')).resolves.toBe('a')
      const secondPromise = throttled('b')
      const thirdPromise = throttled('c')

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenLastCalledWith('a')

      await vi.advanceTimersByTimeAsync(10)

      await expect(secondPromise).resolves.toBe('c')
      await expect(thirdPromise).resolves.toBe('c')
      expect(callback).toHaveBeenCalledTimes(2)
      expect(callback).toHaveBeenLastCalledWith('c')
    } finally {
      vi.useRealTimers()
    }
  })

  it('trailing 模式应使用最后一次调用的 this 与参数', async () => {
    vi.useFakeTimers()

    try {
      const callback = vi.fn(function (this: { prefix: string }, value: string) {
        return `${this.prefix}:${value}`
      })

      const throttled = throttle(callback, 10, { leading: false, trailing: true })
      const first = { prefix: 'first' }
      const second = { prefix: 'second' }
      const third = { prefix: 'third' }

      const firstPromise = throttled.call(first, 'a')
      const secondPromise = throttled.call(second, 'b')
      const thirdPromise = throttled.call(third, 'c')

      await vi.advanceTimersByTimeAsync(10)

      await expect(firstPromise).resolves.toBe('third:c')
      await expect(secondPromise).resolves.toBe('third:c')
      await expect(thirdPromise).resolves.toBe('third:c')
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback.mock.calls[0]).toEqual(['c'])
      expect(callback.mock.contexts[0]).toBe(third)
    } finally {
      vi.useRealTimers()
    }
  })

  it('尾随执行应 resolve 窗口内所有挂起调用', async () => {
    vi.useFakeTimers()

    try {
      const callback = vi.fn((value: string) => value)
      const throttled = throttle(callback, 10, { trailing: true })

      await expect(throttled('a')).resolves.toBe('a')
      const secondPromise = throttled('b')
      const thirdPromise = throttled('c')

      await vi.advanceTimersByTimeAsync(10)

      await expect(Promise.all([secondPromise, thirdPromise])).resolves.toEqual(['c', 'c'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('clear 在 rejectOnCancel 时应拒绝挂起调用', async () => {
    vi.useFakeTimers()

    try {
      const callback = vi.fn((value: string) => value)
      const throttled = throttle(callback, 10, { trailing: true, rejectOnCancel: true })

      await expect(throttled('a')).resolves.toBe('a')
      const pending = throttled('b')

      throttled.clear()

      await expect(pending).rejects.toThrow('Throttle cancelled')
      expect(callback).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
