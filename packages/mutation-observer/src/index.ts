import { access, MaybeAccessor, MaybeElement, toArray, tryOnCleanup } from '@solid-primitive/utils'
import { Accessor, createEffect, createMemo, createRoot, onCleanup } from 'solid-js'

export interface CreateMutationObserverOptions extends MutationObserverInit {
  controls?: boolean
}

export interface CreateMutationObserverControls {
  dispose: VoidFunction
  isSupported: Accessor<boolean>
}

export function createMutationObserver(
  target: MaybeAccessor<MaybeElement> | MaybeAccessor<MaybeElement[]>,
  callback: MutationCallback,
  options: CreateMutationObserverOptions & { controls: true },
): CreateMutationObserverControls

export function createMutationObserver(
  target: MaybeAccessor<MaybeElement> | MaybeAccessor<MaybeElement[]>,
  callback: MutationCallback,
  options?: CreateMutationObserverOptions,
): undefined

export function createMutationObserver(
  target: MaybeAccessor<MaybeElement> | MaybeAccessor<MaybeElement[]>,
  callback: MutationCallback,
  options: CreateMutationObserverOptions = {},
): CreateMutationObserverControls | undefined {
  const { controls = false, ...observerOptions } = options ?? {}

  const isSupported = () => typeof window !== 'undefined' && 'MutationObserver' in window

  const targets = createMemo(() => {
    const t = toArray(access(target))
    return t.map(v => access(v)).filter(v => v != null)
  })

  const attach = () => {
    if (!isSupported()) return
    const observer = new MutationObserver(callback)
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
