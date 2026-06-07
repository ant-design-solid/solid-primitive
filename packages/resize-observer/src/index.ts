import { Accessor, createEffect, createMemo, createRoot, onCleanup } from 'solid-js'
import { access, MaybeAccessor, MaybeElement, toArray, tryOnCleanup, defaultWindow } from '@solid-primitive/utils'

export interface CreateResizeObserverOptions extends ResizeObserverOptions {
  controls?: boolean
}

export interface CreateResizeObserverControls {
  dispose: VoidFunction
  isSupported: Accessor<boolean>
}

export function createResizeObserver(
  target: MaybeAccessor<MaybeElement> | MaybeAccessor<MaybeElement[]>,
  callback: ResizeObserverCallback,
  options: CreateResizeObserverOptions & { controls: true },
): CreateResizeObserverControls

export function createResizeObserver(
  target: MaybeAccessor<MaybeElement> | MaybeAccessor<MaybeElement[]>,
  callback: ResizeObserverCallback,
  options?: CreateResizeObserverOptions,
): undefined

export function createResizeObserver(
  target: MaybeAccessor<MaybeElement> | MaybeAccessor<MaybeElement[]>,
  callback: ResizeObserverCallback,
  options: CreateResizeObserverOptions = {},
): CreateResizeObserverControls | undefined {
  const { controls = false, ...observerOptions } = options ?? {}

  const isSupported = () => typeof window !== 'undefined' && 'ResizeObserver' in window

  const targets = createMemo(() => {
    const t = toArray(access(target))
    return t.map(v => access(v)).filter(v => v != null)
  })

  const attach = () => {
    if (!isSupported()) return
    const observer = new ResizeObserver(callback)
    targets().forEach(v => observer.observe(v, observerOptions))
    onCleanup(() => {
      observer.disconnect()
    })
  }

  if (controls) {
    const dispose = createRoot(dispose => {
      createEffect(attach)
      return dispose
    })

    tryOnCleanup(dispose)

    return {
      isSupported,
      dispose,
    }
  }

  createEffect(attach)
}
