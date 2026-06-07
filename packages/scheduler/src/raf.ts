import { access, MaybeAccessor, noop, tryOnCleanup } from '@solid-primitive/utils'
import { createSignal } from 'solid-js'
import { isServer } from 'solid-js/web'

type RafHandle = ReturnType<typeof setTimeout> | number

const now = () => (typeof performance !== 'undefined' ? (performance.now?.() ?? Date.now()) : Date.now())

let raf = (callback: FrameRequestCallback): RafHandle => setTimeout(() => callback(now()), 16)
let caf = (num: RafHandle) => clearTimeout(num)

if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
  raf = (callback: FrameRequestCallback) => window.requestAnimationFrame(callback)
  caf = (handle: RafHandle) => window.cancelAnimationFrame(handle as number)
}

export function makeRaf() {
  let frameId: RafHandle | undefined

  const cancelRaf = () => {
    if (frameId != null) {
      caf(frameId)
    }
  }
  const callRaf = (callback: FrameRequestCallback) => {
    cancelRaf()
    frameId = raf(timestamp => {
      frameId = undefined
      callback(timestamp)
    })
  }

  return [callRaf, cancelRaf] as const
}

export interface RafFnOptions {
  /**
   * @default true
   */
  immediate?: boolean

  /**
   * @default null
   */
  fpsLimit?: MaybeAccessor<number | null>

  /**
   * @default false
   */
  once?: boolean
}

export function useRafFn(
  fn: (arg: { timestamp: DOMHighResTimeStamp; delta: number }) => void | boolean,
  options: RafFnOptions = {},
) {
  if (isServer) {
    return {
      active: () => false,
      resume: noop,
      pause: noop,
    }
  }
  const { fpsLimit = null, once = false, immediate = true } = options

  const [active, setActive] = createSignal(false)
  const intervalLimit = () => {
    const limit = access(fpsLimit)
    return limit ? 1000 / limit : null
  }
  let preFrameTimestamp = 0
  const [raf, cancelRaf] = makeRaf()

  function loop(timestamp: DOMHighResTimeStamp) {
    if (!active()) return
    if (!preFrameTimestamp) preFrameTimestamp = timestamp

    const delta = timestamp - preFrameTimestamp

    if (intervalLimit() && delta < intervalLimit()!) {
      raf(loop)
      return
    }

    preFrameTimestamp = timestamp
    const shouldContinue = fn({ timestamp, delta })
    if (once || shouldContinue === false) {
      setActive(false)
      cancelRaf()
      return
    }
    raf(loop)
  }

  function resume() {
    if (active()) return
    setActive(true)
    preFrameTimestamp = 0
    raf(loop)
  }

  function pause() {
    setActive(false)
    cancelRaf()
  }

  immediate && resume()

  tryOnCleanup(pause)

  return {
    active,
    resume,
    pause,
  }
}
