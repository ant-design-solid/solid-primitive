import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { createScroll } from './index'

function withRoot<T>(run: () => T | Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    createRoot(dispose => {
      let result: T | Promise<T>

      try {
        result = run()
      } catch (error) {
        dispose()
        reject(error)
        return
      }

      Promise.resolve(result).then(
        value => {
          dispose()
          resolve(value)
        },
        error => {
          dispose()
          reject(error)
        },
      )
    })
  })
}

function mockProperties(target: object, values: Record<string, number>) {
  const restores = Object.entries(values).map(([key, value]) => {
    const ownDescriptor = Object.getOwnPropertyDescriptor(target, key)

    Object.defineProperty(target, key, {
      configurable: true,
      writable: true,
      value,
    })

    return () => {
      if (ownDescriptor) {
        Object.defineProperty(target, key, ownDescriptor)
      } else {
        delete (target as Record<string, unknown>)[key]
      }
    }
  })

  return () => restores.reverse().forEach(restore => restore())
}

describe('createScroll', () => {
  it('scrollTo 在 Document 目标上应委托给 window.scroll', async () => {
    await withRoot(async () => {
      const scrollSpy = vi.spyOn(window, 'scroll').mockImplementation(() => undefined)

      try {
        const scroll = createScroll(document, { behavior: 'smooth' })
        await Promise.resolve()

        scroll.scrollTo(24, 48)

        expect(scrollSpy).toHaveBeenCalledWith({
          left: 24,
          top: 48,
          behavior: 'smooth',
        })
      } finally {
        scrollSpy.mockRestore()
      }
    })
  })

  it('Document 滚动事件应在 documentElement 为 0 时回退到 body.scrollTop', async () => {
    await withRoot(async () => {
      const restoreDocumentElement = mockProperties(document.documentElement, {
        scrollLeft: 0,
        scrollTop: 0,
        clientWidth: 100,
        scrollWidth: 100,
        clientHeight: 100,
        scrollHeight: 400,
      })
      const restoreBody = mockProperties(document.body, {
        scrollTop: 36,
      })

      try {
        const scroll = createScroll(document)
        await Promise.resolve()

        document.body.scrollTop = 72
        document.dispatchEvent(new Event('scroll'))

        expect(scroll.position.y).toBe(72)
        expect(scroll.direction.bottom).toBe(true)
      } finally {
        restoreBody()
        restoreDocumentElement()
      }
    })
  })
})
