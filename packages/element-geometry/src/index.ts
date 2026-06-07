import { Accessor, createEffect, createMemo, createRoot, createSignal, untrack } from 'solid-js'
import { access, MaybeAccessor, MaybeElement, tryOnCleanup, toArray, defaultWindow } from '@solid-primitive/utils'
import {
  createResizeObserver,
  CreateResizeObserverControls,
  CreateResizeObserverOptions,
} from '@solid-primitive/resize-observer'
import { useEventListener } from '@solid-primitive/event-listener'

type ElementSize = Record<'width' | 'height', number>

export interface CreateElementSizeOptions extends CreateResizeObserverOptions {
  initialSize?: ElementSize
}

type CreateElementSizeBaseReturn = {
  size: Accessor<ElementSize>
}

export interface CreateElementSizeControls extends CreateResizeObserverControls {}

export function createElementSize(
  target: MaybeAccessor<MaybeElement>,
  options: CreateElementSizeOptions & { controls: true },
): CreateElementSizeControls & CreateElementSizeBaseReturn
export function createElementSize(
  target: MaybeAccessor<MaybeElement>,
  options?: CreateElementSizeOptions,
): CreateElementSizeBaseReturn
export function createElementSize(
  target: MaybeAccessor<MaybeElement>,
  options: CreateElementSizeOptions = {},
): (CreateElementSizeControls & CreateElementSizeBaseReturn) | CreateElementSizeBaseReturn {
  const { initialSize = { width: 0, height: 0 }, ...resizeObserverOptions } = options
  const { window = defaultWindow, box = 'content-box' } = resizeObserverOptions
  const isSVG = createMemo(() => access(target)?.namespaceURI?.includes('svg'))
  const [size, _setSize] = createSignal({ ...initialSize })

  const setSize = (width: number, height: number) => _setSize({ width, height })

  const control = createResizeObserver(
    target,
    ([entry]) => {
      const boxSize =
        box === 'border-box'
          ? entry.borderBoxSize
          : box === 'content-box'
            ? entry.contentBoxSize
            : entry.devicePixelContentBoxSize

      if (window && isSVG()) {
        const el = access(target)
        if (el) {
          const rect = el.getBoundingClientRect()
          setSize(rect.width, rect.height)
        }
      }

      if (boxSize) {
        const formatBoxSize = toArray(boxSize)
        const width = formatBoxSize.reduce((acc, { inlineSize }) => acc + inlineSize, 0)
        const height = formatBoxSize.reduce((acc, { blockSize }) => acc + blockSize, 0)

        setSize(width, height)
      } else {
        setSize(entry.contentRect.width, entry.contentRect.height)
      }
    },
    resizeObserverOptions,
  ) as any

  const attach = () => {
    const el = access(target)
    if (el) {
      const width = 'offsetWidth' in el ? el.clientWidth : initialSize.width
      const height = 'offsetHeight' in el ? el.clientHeight : initialSize.height

      setSize(width, height)
    }
  }

  if (control) {
    const dispose = createRoot(dispose => {
      createEffect(attach)
      return dispose
    })

    const stop = () => {
      dispose()
      control.stop()
    }

    tryOnCleanup(dispose)

    return {
      ...control,
      stop,
      size,
    }
  }

  createEffect(attach)

  return {
    size,
  }
}

export type CreateElementSize = ReturnType<typeof createElementSize>

export interface CreateElementRectOptions {
  window?: Window

  /**
   * @default true
   */
  reset?: boolean

  /**
   * @defualt true
   */
  windowResize?: boolean

  /**
   * @defualt true
   */
  windowScroll?: boolean

  /*
   * @default true
   */
  immediate?: boolean

  /*
   * @default true
   */
  sync?: boolean
}

const genInitialRect = () => ({ height: 0, width: 0, left: 0, right: 0, top: 0, bottom: 0, x: 0, y: 0 })

export type ElementRect = ReturnType<typeof genInitialRect>

export function createElementRect(target: MaybeAccessor<MaybeElement>, options: CreateElementRectOptions = {}) {
  const {
    window = defaultWindow,
    reset = true,
    windowResize = true,
    windowScroll = true,
    sync = true,
    immediate = true,
  } = options
  const [rect, setRect] = createSignal<ElementRect>(genInitialRect())

  function recalculate() {
    const el = access(target)
    if (!el) {
      if (reset) {
        setRect(genInitialRect())
      }
      return
    }
    const _rect = el.getBoundingClientRect()

    setRect({
      x: _rect.x,
      y: _rect.y,
      width: _rect.width,
      height: _rect.height,
      top: _rect.top,
      bottom: _rect.bottom,
      left: _rect.left,
      right: _rect.right,
    })
  }

  function update() {
    if (sync) {
      recalculate()
    } else {
      requestAnimationFrame(recalculate)
    }
  }

  createEffect(prev => {
    const el = access(target) ?? null

    if (prev === undefined ? immediate : el !== prev) {
      untrack(update)
    }

    return el
  })

  createResizeObserver(target, update)

  windowScroll && useEventListener(window, 'scroll', update, { capture: true, passive: true })

  windowResize && useEventListener(window, 'resize', update, { passive: true })

  return [rect, update]
}
