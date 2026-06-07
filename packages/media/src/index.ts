import { access, isFunction, MaybeAccessor, defaultWindow } from '@solid-primitive/utils'
import { createEffect, createMemo, createSignal } from 'solid-js'
import { useEventListener } from '@solid-primitive/event-listener'

export interface CreateMediaQueryOptions {
  window?: Window
}

export function createMediaQuery(query: MaybeAccessor<string>, options: CreateMediaQueryOptions = {}) {
  const { window = defaultWindow } = options
  const isSupported = () => !!window && 'metachMedia' in window && isFunction(window.matchMedia)

  const [mediaQuery, setMediaQuery] = createSignal<MediaQueryList>()
  const [matches, setMatches] = createSignal(false)

  const handler = (event: MediaQueryListEvent) => {
    setMatches(event.matches)
  }

  createEffect(() => {
    if (!isSupported()) return
    const mediaQuery = window?.matchMedia(access(query))
    setMediaQuery(mediaQuery)
    setMatches(mediaQuery!.matches)
  })

  useEventListener(mediaQuery, 'change', handler, { passive: true })

  return matches
}

interface CreateDevicePixelRatioOptions extends CreateMediaQueryOptions {}

export function createDevicePixelRatio(options: CreateDevicePixelRatioOptions = {}): () => number {
  const { window = defaultWindow } = options

  const [pixelRatio, setPixelRatio] = createSignal(1)

  const query = createMediaQuery(
    createMemo(() => `(resolution: ${pixelRatio()}dppx)`),
    options,
  )

  if (window) {
    createEffect(() => {
      query()
      setPixelRatio(window.devicePixelRatio)
    })
  }

  return pixelRatio
}
