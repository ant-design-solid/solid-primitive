import { access, MaybeAccessor, tryOnCleanup } from '@solid-primitive/utils'
import { Accessor, createEffect, createMemo, createSignal, on, untrack } from 'solid-js'
import { isServer } from 'solid-js/web'

export type CubicBezierPoints = [number, number, number, number]

export type EasingFunction = (n: number) => number

export type InterpolationFunction<T> = (from: T, to: T, t: number) => T

export interface TweenOptions<T> {
  abort?: () => any

  duration?: number

  easing?: EasingFunction | CubicBezierPoints

  interpolation?: InterpolationFunction<T>
}

const _EasingPresets = {
  easeInSine: [0.12, 0, 0.39, 0],
  easeOutSine: [0.61, 1, 0.88, 1],
  easeInOutSine: [0.37, 0, 0.63, 1],
  easeInQuad: [0.11, 0, 0.5, 0],
  easeOutQuad: [0.5, 1, 0.89, 1],
  easeInOutQuad: [0.45, 0, 0.55, 1],
  easeInCubic: [0.32, 0, 0.67, 0],
  easeOutCubic: [0.33, 1, 0.68, 1],
  easeInOutCubic: [0.65, 0, 0.35, 1],
  easeInQuart: [0.5, 0, 0.75, 0],
  easeOutQuart: [0.25, 1, 0.5, 1],
  easeInOutQuart: [0.76, 0, 0.24, 1],
  easeInQuint: [0.64, 0, 0.78, 0],
  easeOutQuint: [0.22, 1, 0.36, 1],
  easeInOutQuint: [0.83, 0, 0.17, 1],
  easeInExpo: [0.7, 0, 0.84, 0],
  easeOutExpo: [0.16, 1, 0.3, 1],
  easeInOutExpo: [0.87, 0, 0.13, 1],
  easeInCirc: [0.55, 0, 1, 0.45],
  easeOutCirc: [0, 0.55, 0.45, 1],
  easeInOutCirc: [0.85, 0, 0.15, 1],
  easeInBack: [0.36, 0, 0.66, -0.56],
  easeOutBack: [0.34, 1.56, 0.64, 1],
  easeInOutBack: [0.68, -0.6, 0.32, 1.6],
} as const

const linear = <T>(v: T): T => v

export const EasingPresets = Object.assign({ linear }, _EasingPresets) as Record<
  keyof typeof _EasingPresets,
  CubicBezierPoints
> & { linear: EasingFunction }

function createEasingFunction([p0, p1, p2, p3]: CubicBezierPoints): EasingFunction {
  if (p0 === p1 && p2 === p3) return linear

  const a = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1
  const b = (a1: number, a2: number) => 3 * a2 - 6 * a1
  const c = (a1: number) => 3 * a1

  const calcBezier = (t: number, a1: number, a2: number) => ((a(a1, a2) * t + b(a1, a2)) * t + c(a1)) * t

  const getSlope = (t: number, a1: number, a2: number) => 3 * a(a1, a2) * t * t + 2 * b(a1, a2) * t + c(a1)

  const getTforX = (x: number) => {
    let aGuessT = x
    for (let i = 0; i < 4; ++i) {
      const currentSlope = getSlope(aGuessT, p0, p2)
      if (currentSlope === 0) return aGuessT
      const currentX = calcBezier(aGuessT, p0, p2) - x
      aGuessT -= currentX / currentSlope
    }
    return aGuessT
  }

  return (x: number) => calcBezier(getTforX(x), p1, p3)
}

function lerp(a: number, b: number, alpha: number) {
  return a + alpha * (b - a)
}

function defaultInterpolation<T>(a: T, b: T, t: number) {
  const aVal = access(a)
  const bVal = access(b)

  if (typeof aVal === 'number' && typeof bVal === 'number') {
    return lerp(aVal, bVal, t) as T
  }

  if (Array.isArray(aVal) && Array.isArray(bVal)) {
    return aVal.map((v, i) => lerp(v, access(bVal[i]), t)) as T
  }

  throw new TypeError('Unknown transition type, specify an interpolation function.')
}

function normalizeEasing(easing: EasingFunction | CubicBezierPoints | undefined) {
  return typeof easing === 'function' ? easing : (easing ?? linear)
}

export function tween<T>(setSource: (val: T) => void, from: T, to: T, options: TweenOptions<T> = {}) {
  if (isServer) return Promise.resolve()
  const { interpolation = defaultInterpolation, easing, duration = 1000 } = options
  const fromVal = from
  const toVal = to
  const startedAt = Date.now()
  const endAt = Date.now() + duration

  const trans = normalizeEasing(easing)

  const ease = typeof trans === 'function' ? trans : createEasingFunction(trans)

  return new Promise<void>(resolve => {
    setSource(fromVal)
    const tick = () => {
      if (options.abort?.()) {
        resolve()
        return
      }

      const now = Date.now()
      const progress = Math.min((now - startedAt) / duration, 1)
      const alpha = ease(progress)

      setSource(interpolation(fromVal, toVal, alpha))

      if (now < endAt) {
        requestAnimationFrame(tick)
      } else {
        setSource(toVal)
        resolve()
      }
    }
    tick()
  })
}

export interface CreateTweenOptions<T> extends Omit<TweenOptions<T>, 'duration' | 'easing'> {
  duration?: MaybeAccessor<number>

  easing?: MaybeAccessor<EasingFunction | CubicBezierPoints>

  delay?: MaybeAccessor<number>

  disabled?: MaybeAccessor<boolean>

  onFinished?: VoidFunction

  onStarted?: VoidFunction
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function createTween<T extends MaybeAccessor<number>[]>(
  source: [...T],
  options?: CreateTweenOptions<T>,
): Accessor<{ [K in keyof T]: number }>

export function createTween<T>(source: MaybeAccessor<T>, options?: CreateTweenOptions<T>): Accessor<T>

export function createTween<T>(source: MaybeAccessor<T>, options: CreateTweenOptions<T> = {}): Accessor<T> {
  const { interpolation, easing, duration, abort } = options
  if (isServer) {
    const value = access(source) as T
    return () => value
  }

  let currentId = 0

  const getSource = () => {
    return access(source) as T
  }

  let outputValue: T = getSource()
  const [track, trigger] = createSignal(undefined, { equals: false })
  const output = () => {
    track()
    return outputValue
  }

  createEffect(
    on(
      () => getSource(),
      async (to: T) => {
        if (access(options.disabled)) return
        const id = ++currentId
        options.delay && (await sleep(access(options.delay)))
        if (id !== currentId) return

        options.onStarted?.()

        await tween(
          v => {
            outputValue = v
            trigger()
          },
          output(),
          to,
          {
            interpolation,
            easing: access(easing),
            duration: access(duration),
            abort: () => id !== currentId || abort?.(),
          },
        )

        options.onFinished?.()
      },
    ),
  )

  createEffect(() => {
    const disable = access(options.disabled)
    if (disable) {
      untrack(() => {
        currentId++
        outputValue = getSource()
        trigger()
      })
    }
  })

  tryOnCleanup(() => {
    currentId++
  })

  return createMemo(() => (access(options.disabled) ? getSource() : output()))
}
