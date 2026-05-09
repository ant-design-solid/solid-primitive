import { createRoot } from 'solid-js'
import { ConfigurableWindow, defaultWindow } from '../_configurable'
import { access, isIOS, MaybeAccessor, MaybeElement, noop, tryOnCleanup } from '@s-primitives/shared'
import { useEventListener } from '../event-listener'

export interface OnClickOutsideOptions<Controls extends boolean = false> extends ConfigurableWindow {
  ignore?: MaybeAccessor<(MaybeAccessor<MaybeElement> | string)[]>

  /**
   * @default true
   */
  capture?: boolean

  /**
   * @default false
   */
  detectIframe?: boolean

  /**
   * @default false
   */
  controls?: Controls
}

export type OnClickOutsideHandler<T extends OnClickOutsideOptions<boolean> = OnClickOutsideOptions<boolean>> = (
  event:
    | (T['detectIframe'] extends true ? FocusEvent : never)
    | (T['controls'] extends true ? Event : never)
    | PointerEvent,
) => void

export type OnClickOutsideReturn<Controls extends boolean = false> = Controls extends false
  ? VoidFunction
  : {
      stop: VoidFunction
      cancel: VoidFunction
      trigger: (event: Event) => void
    }

let _iOSWorkaround = false

export function onClickOutside<T extends OnClickOutsideOptions>(
  target: MaybeAccessor<MaybeElement>,
  handler: OnClickOutsideHandler<T>,
  options?: T,
): OnClickOutsideReturn<false>

export function onClickOutside<T extends OnClickOutsideOptions<true>>(
  target: MaybeAccessor<MaybeElement>,
  handler: OnClickOutsideHandler<T>,
  options: T,
): OnClickOutsideReturn<true>

export function onClickOutside(
  target: MaybeAccessor<MaybeElement>,
  handler: OnClickOutsideHandler,
  options: OnClickOutsideOptions<boolean> = {},
): OnClickOutsideReturn<boolean> {
  const { window = defaultWindow, ignore = [], capture = true, detectIframe = false, controls = false } = options

  if (!window) {
    return controls ? { stop: noop, cancel: noop, trigger: noop } : noop
  }

  if (isIOS && !_iOSWorkaround) {
    _iOSWorkaround = true
    const listenerOptions = { passive: true }
    // Not using useEventListener because these event handlers must not be disposed.
    // See previously linked references and https://github.com/vueuse/vueuse/issues/4724
    Array.from(window.document.body.children).forEach(el => el.addEventListener('click', noop, listenerOptions))
    window.document.documentElement.addEventListener('click', noop, listenerOptions)
  }

  let shouldListen = true
  const shouldIgnore = (event: Event) =>
    access(ignore).some(target => {
      if (typeof target === 'string') {
        return Array.from(window.document.querySelectorAll(target)).some(
          el => el === event.target || event.composedPath().includes(el),
        )
      }
      const el = access(target)
      return el && (el === event.target || event.composedPath().includes(el))
    })

  const listener = (event: Event) => {
    const el = access(target)
    if (event.target == null) return

    if (!el || el === event.target || event.composedPath().includes(el)) return

    if ('detail' in event && event.detail === 0) {
      shouldListen = !shouldIgnore(event)
    }

    if (!shouldListen) {
      shouldListen = true
      return
    }
    handler(event as any)
  }

  let isProcessingClick = false

  const stop = createRoot(dispose => {
    useEventListener(
      window,
      'click',
      (event: PointerEvent) => {
        if (!isProcessingClick) {
          isProcessingClick = true
          setTimeout(() => {
            isProcessingClick = false
          }, 0)
          listener(event)
        }
      },
      { passive: true, capture },
    )
    useEventListener(
      window,
      'pointerdown',
      e => {
        const el = access(target)
        shouldListen = !shouldIgnore(e) && !!(el && !e.composedPath().includes(el))
      },
      { passive: true },
    )
    detectIframe &&
      useEventListener(
        window,
        'blur',
        event => {
          setTimeout(() => {
            const el = access(target)
            if (!el) return
            let activeEl: Element | null = window.document.activeElement
            while (activeEl?.shadowRoot) {
              activeEl = activeEl.shadowRoot.activeElement
            }
            if (activeEl?.tagName === 'IFRAME' && !el?.contains(window.document.activeElement)) {
              handler(event as any)
            }
          }, 0)
        },
        { passive: true },
      )
    return dispose
  })

  tryOnCleanup(stop)

  if (controls) {
    return {
      stop,
      cancel: () => {
        shouldListen = false
      },
      trigger: (event: Event) => {
        shouldListen = true
        listener(event)
        shouldListen = false
      },
    }
  }

  return stop
}
