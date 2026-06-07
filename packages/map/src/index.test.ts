import { createEffect } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { withRoot } from '../../.test'
import { createMap, createWeakMap, ReactiveMap, ReactiveWeakMap } from './index'

const flush = () => Promise.resolve()

describe('map', () => {
  it('应保留原生 Map 的 instanceof 语义', () => {
    expect(createMap()).toBeInstanceOf(Map)
    expect(createWeakMap()).toBeInstanceOf(WeakMap)
    expect(createMap()).toBeInstanceOf(ReactiveMap)
    expect(createWeakMap()).toBeInstanceOf(ReactiveWeakMap)
  })

  it('createMap 应按 Map 构造器语义 clone 初始值', () => {
    const raw = new Map<string, number>([['a', 1]])
    const map = createMap(raw)

    raw.set('a', 2)

    expect(map.get('a')).toBe(1)
  })

  it('Map 应只触发被读取 key 的依赖', async () => {
    await withRoot(async () => {
      const map = createMap<string, number>([['a', 1]])
      const readA = vi.fn(() => map.get('a'))
      const readB = vi.fn(() => map.get('b'))

      createEffect(readA)
      createEffect(readB)
      await flush()

      map.set('a', 2)
      await flush()

      expect(readA).toHaveBeenCalledTimes(2)
      expect(readB).toHaveBeenCalledTimes(1)
    })
  })

  it('Map 新增 undefined 值应触发 values 迭代', async () => {
    await withRoot(async () => {
      const map = createMap<string, number | undefined>()
      const readValues = vi.fn(() => [...map.values()])

      createEffect(readValues)
      await flush()

      map.set('a', undefined)
      await flush()

      expect(readValues).toHaveBeenCalledTimes(2)
    })
  })

  it('WeakMap 应追踪指定对象 key 的 has 与 get', async () => {
    await withRoot(async () => {
      const key = {}
      const otherKey = {}
      const weakMap = createWeakMap<object, number>()
      const readKey = vi.fn(() => [weakMap.has(key), weakMap.get(key)])

      createEffect(readKey)
      await flush()

      weakMap.set(otherKey, 1)
      await flush()
      expect(readKey).toHaveBeenCalledTimes(1)

      weakMap.set(key, 2)
      await flush()
      expect(readKey).toHaveBeenCalledTimes(2)
    })
  })
})
