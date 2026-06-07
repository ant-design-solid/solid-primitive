import { noop } from '@solid-primitive/utils'
import { $TRACK, Accessor, createMemo, createSignal, untrack, useTransition } from 'solid-js'
import { isServer } from 'solid-js/web'

export type OnListChange<T> = (payload: {
  list: T[]
  added: T[]
  removed: T[]
  unchanged: T[]
  finishRemoved: (els: T[]) => void
}) => void

export type ExitMethod = 'remove' | 'move-to-end' | 'keep-index'

export type ListMotionOptions<T> = {
  onChange: OnListChange<T>

  appear?: boolean

  /**
   * @default 'move-to-end'
   */
  exitMethod?: ExitMethod
}

export function createListMotion<T extends object>(
  source: Accessor<readonly T[]>,
  options: ListMotionOptions<T>,
): Accessor<T[]> {
  const initSource = untrack(source)

  if (isServer) {
    const copy = initSource.slice()
    return () => copy
  }

  const { onChange, appear, exitMethod } = options

  // if appear is enabled, the initial motion won't have any previous elements.
  // otherwise the elements will match and motion skipped, or motioned if the source is different from the initial value
  let prevSet: ReadonlySet<T> = new Set(appear ? undefined : initSource)
  const exiting = new WeakSet<T>()

  const [toRemove, setToRemove] = createSignal<T[]>([], { equals: false })
  const [isTransitionPending] = useTransition()

  const finishRemoved: (els: T[]) => void =
    exitMethod === 'remove'
      ? noop
      : els => {
          setToRemove(p => (p.push.apply(p, els), p))
          for (const el of els) exiting.delete(el)
        }

  const handleRemoved: (els: T[], el: T, i: number) => void =
    exitMethod === 'remove'
      ? noop
      : exitMethod === 'keep-index'
        ? (els, el, i) => els.splice(i, 0, el)
        : (els, el) => els.push(el)

  return createMemo(
    prev => {
      const elsToRemove = toRemove()
      const sourceList = source()
      ;(sourceList as any)[$TRACK] // top level store tracking

      if (untrack(isTransitionPending)) {
        // wait for pending motion to end before animating
        isTransitionPending()
        return prev
      }

      if (elsToRemove.length) {
        const next = prev.filter(e => !elsToRemove.includes(e))
        elsToRemove.length = 0
        onChange({
          list: next,
          added: [],
          removed: [],
          unchanged: next,
          finishRemoved,
        })
        return next
      }

      return untrack(() => {
        const nextSet: ReadonlySet<T> = new Set(sourceList)
        const next: T[] = sourceList.slice()

        const added: T[] = []
        const removed: T[] = []
        const unchanged: T[] = []

        for (const el of sourceList) {
          ;(prevSet.has(el) ? unchanged : added).push(el)
        }

        let nothingChanged = !added.length
        for (let i = 0; i < prev.length; i++) {
          const el = prev[i]!
          if (!nextSet.has(el)) {
            if (!exiting.has(el)) {
              removed.push(el)
              exiting.add(el)
            }
            handleRemoved(next, el, i)
          }
          if (nothingChanged && el !== next[i]) nothingChanged = false
        }

        // skip if nothing changed
        if (!removed.length && nothingChanged) return prev

        onChange({ list: next, added, removed, unchanged, finishRemoved })

        prevSet = nextSet
        return next
      })
    },
    appear ? [] : initSource.slice(),
  )
}
