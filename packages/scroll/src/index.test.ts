import { describe, expect, it, vi } from 'vitest'
import { withRoot } from '../../.test'
import { createSignal } from 'solid-js'
import { createScroll, createScrollLock } from '.'

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

describe('createScrollLock', () => {
  it('locks and restores the original overflow', async () => {
    await withRoot(async () => {
      const element = document.createElement('div')
      element.style.overflow = 'scroll'

      const [isLocked, setLocked] = createScrollLock(element)

      expect(isLocked()).toBe(false)

      setLocked(true)
      await Promise.resolve()
      expect(isLocked()).toBe(true)
      expect(element.style.overflow).toBe('hidden')

      setLocked(false)
      await Promise.resolve()
      expect(isLocked()).toBe(false)
      expect(element.style.overflow).toBe('scroll')
    })
  })

  it('restores the previous target when the element accessor changes', async () => {
    await withRoot(async () => {
      const first = document.createElement('div')
      const second = document.createElement('div')
      first.style.overflow = 'auto'
      second.style.overflow = 'scroll'

      const [element, setElement] = createSignal<HTMLElement | null>(first)
      createScrollLock(element, true)
      await Promise.resolve()

      expect(first.style.overflow).toBe('hidden')
      expect(second.style.overflow).toBe('scroll')

      setElement(second)
      await Promise.resolve()

      expect(first.style.overflow).toBe('auto')
      expect(second.style.overflow).toBe('hidden')
    })
  })
})
