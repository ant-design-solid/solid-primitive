import { noop } from '@solid-primitive/utils'
import { Accessor, batch, createComputed, createSignal, untrack, useTransition } from 'solid-js'
import { isServer } from 'solid-js/web'

export type MotionMode = 'out-in' | 'in-out' | 'parallel'

export type OnMotion<T> = (el: T, done: () => void) => void

export interface SwitchMotionOptions<T> {
  onEnter?: OnMotion<T>

  onExit?: OnMotion<T>

  mode?: MotionMode

  appear?: boolean
}

export function createSwitchMotion<T>(source: Accessor<T>, options: SwitchMotionOptions<NonNullable<T>>) {
  const initSource = untrack(source)
  const initReturned = initSource ? [initSource] : []

  if (isServer) {
    return () => initReturned
  }

  const { onEnter, onExit, appear, mode } = options

  const [returned, setReturned] = createSignal<NonNullable<T>[]>(appear ? [] : initReturned)

  const [isTransitionPending] = useTransition()

  let next: T | undefined
  let isExiting = false

  function exit(el: T | undefined, after?: VoidFunction) {
    if (!el) return after?.()
    isExiting = true
    onExit?.(el, () => {
      batch(() => {
        isExiting = false
        setReturned(p => p.filter(e => e !== el))
        after?.()
      })
    })
  }

  function enter(after?: VoidFunction) {
    const el = next
    if (!el) return after?.()
    next = undefined
    setReturned(p => [el, ...p])
    onEnter?.(el, after ?? noop)
  }

  const trigger: (prev: T | undefined) => void =
    mode === 'out-in'
      ? // exit ->  enter
        prev => isExiting || exit(prev, enter)
      : mode === 'in-out'
        ? // enter -> exit
          prev => enter(() => exit(prev))
        : // exit && enter
          prev => {
            exit(prev)
            enter()
          }

  createComputed(
    (prev: T | undefined) => {
      const el = source()
      if (untrack(isTransitionPending)) {
        isTransitionPending()
        return prev
      }
      if (el !== prev) {
        next = el
        batch(() => untrack(() => trigger(prev)))
      }
      return el
    },
    appear ? undefined : initSource,
  )

  return returned
}
