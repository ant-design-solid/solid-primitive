import { isIOS, MaybeArray, toArray, tryOnCleanup, ValueOf } from '@s-primitives/shared'
import { onCleanup, onMount } from 'solid-js'
import type { ConfigurableWindow } from '../_configurable'
import { defaultWindow } from '../_configurable'
import { makeEventListener } from '../event-listener'

export type KeyCombo = MaybeArray<string>

export interface UseKeyboardOptions extends ConfigurableWindow {
  ignore?: (e: KeyboardEvent, target: Element | null, combo: string | null) => boolean
}

interface ParsedCombo {
  key: string | null
  modifiers: Modifier[]
}

interface Binding {
  id: string
  lookupKey: string
  combos: ParsedCombo[]
  action: () => void
}

const PLUS_PLACEHOLDER = '__diagen_plus__'
const SEQUENCE_TIMEOUT = 1000

const MODIFIER_ALIASES = {
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  os: 'meta',
} as const

const KEY_ALIASES = {
  return: 'enter',
  escape: 'esc',
  esc: 'esc',
  del: 'delete',
  delete: 'delete',
  ins: 'insert',
  insert: 'insert',
  ' ': 'space',
  space: 'space',
  spacebar: 'space',
  arrowleft: 'left',
  left: 'left',
  arrowright: 'right',
  right: 'right',
  arrowup: 'up',
  up: 'up',
  arrowdown: 'down',
  down: 'down',
  plus: '+',
} as const

const CODE_ALIASES = {
  backspace: 'backspace',
  tab: 'tab',
  enter: 'enter',
  escape: 'esc',
  space: 'space',
  delete: 'delete',
  insert: 'insert',
  home: 'home',
  end: 'end',
  pageup: 'pageup',
  pagedown: 'pagedown',
  arrowleft: 'left',
  arrowright: 'right',
  arrowup: 'up',
  arrowdown: 'down',
  metaleft: 'meta',
  metaright: 'meta',
  controlleft: 'ctrl',
  controlright: 'ctrl',
  shiftleft: 'shift',
  shiftright: 'shift',
  altleft: 'alt',
  altright: 'alt',
  minus: '-',
  equal: '=',
  bracketleft: '[',
  bracketright: ']',
  backslash: '\\',
  semicolon: ';',
  quote: "'",
  comma: ',',
  period: '.',
  slash: '/',
  backquote: '`',
} as const

const SHIFT_REQUIRED_KEYS = new Set([
  '~',
  '!',
  '@',
  '#',
  '$',
  '%',
  '^',
  '&',
  '*',
  '(',
  ')',
  '_',
  '+',
  ':',
  '"',
  '<',
  '>',
  '?',
  '|',
])

type Modifier = ValueOf<typeof MODIFIER_ALIASES>

const MODIFIER_ORDER: Modifier[] = ['ctrl', 'alt', 'shift', 'meta']

const isModifier = (key: string): key is Modifier => MODIFIER_ORDER.includes(key as Modifier)

const sortModifiers = (modifiers: Modifier[]): Modifier[] =>
  [...modifiers].sort((left, right) => MODIFIER_ORDER.indexOf(left) - MODIFIER_ORDER.indexOf(right))

function normalizeKeyToken(key: string): string {
  const normalized = key.trim().toLowerCase()
  if (!normalized) return ''

  if (normalized === 'mod') {
    return isIOS ? 'meta' : 'ctrl'
  }

  if (normalized in MODIFIER_ALIASES) {
    return MODIFIER_ALIASES[normalized as keyof typeof MODIFIER_ALIASES]
  }

  if (normalized in KEY_ALIASES) {
    return KEY_ALIASES[normalized as keyof typeof KEY_ALIASES]
  }

  return normalized
}

function normalizeCode(code: string): string {
  if (!code) return ''

  if (code.startsWith('Key')) {
    return code.slice(3).toLowerCase()
  }

  if (code.startsWith('Digit')) {
    return code.slice(5)
  }

  if (/^Numpad[0-9]$/.test(code)) {
    return code.slice(6)
  }

  if (code.startsWith('Numpad')) {
    const value = code.slice(6).toLowerCase()
    if (value === 'add') return '+'
    if (value === 'subtract') return '-'
    if (value === 'multiply') return '*'
    if (value === 'divide') return '/'
    if (value === 'decimal') return '.'
    if (value === 'enter') return 'enter'
  }

  const normalized = code.toLowerCase()
  if (normalized in CODE_ALIASES) {
    return CODE_ALIASES[normalized as keyof typeof CODE_ALIASES]
  }

  return normalized
}

function normalizeEventKey(e: KeyboardEvent): string | null {
  if (e.key && e.key !== 'Unidentified') {
    const normalizedKey = normalizeKeyToken(e.key)
    if (normalizedKey) return normalizedKey
  }

  const normalizedCode = normalizeCode(e.code)
  return normalizedCode || null
}

function parseCombo(combo: string): ParsedCombo {
  const normalizedCombo = combo.trim().toLowerCase()
  if (!normalizedCombo) {
    return { key: null, modifiers: [] }
  }

  const tokens =
    normalizedCombo === '+'
      ? ['plus']
      : normalizedCombo
          .replace(/\+{2}/g, `+${PLUS_PLACEHOLDER}`)
          .split('+')
          .map(token => token.replace(PLUS_PLACEHOLDER, 'plus').trim())
          .filter(Boolean)

  const modifiers: Modifier[] = []
  let key: string | null = null

  for (const token of tokens) {
    const normalizedKey = normalizeKeyToken(token)
    if (!normalizedKey) continue

    if (isModifier(normalizedKey)) {
      if (!modifiers.includes(normalizedKey)) {
        modifiers.push(normalizedKey)
      }
      continue
    }

    key = normalizedKey
  }

  return {
    key,
    modifiers: sortModifiers(modifiers),
  }
}

function parseKeys(key: KeyCombo): ParsedCombo[][] {
  return toArray(key)
    .map(combo => combo.trim())
    .filter(Boolean)
    .map(combo =>
      combo
        .split(/\s+/)
        .map(part => parseCombo(part))
        .filter(parsed => parsed.key !== null || parsed.modifiers.length > 0),
    )
    .filter(combos => combos.length > 0)
}

function comboToId(combo: ParsedCombo): string {
  return [...combo.modifiers, ...(combo.key ? [combo.key] : [])].join('+')
}

function getBindingId(combos: ParsedCombo[]): string {
  return combos.map(comboToId).join(' ')
}

function getLookupKey(combo: ParsedCombo): string {
  return combo.key ? `key:${combo.key}` : `mods:${combo.modifiers.join('+')}`
}

function getEventModifiers(e: KeyboardEvent): Modifier[] {
  const modifiers: Modifier[] = []

  if (e.ctrlKey) modifiers.push('ctrl')
  if (e.altKey) modifiers.push('alt')
  if (e.shiftKey) modifiers.push('shift')
  if (e.metaKey) modifiers.push('meta')

  return sortModifiers(modifiers)
}

function getEventCombo(e: KeyboardEvent): ParsedCombo {
  return {
    key: normalizeEventKey(e),
    modifiers: getEventModifiers(e),
  }
}

function getEventLookupKeys(combo: ParsedCombo): string[] {
  const lookupKeys: string[] = []

  if (combo.key) {
    lookupKeys.push(`key:${combo.key}`)
  }

  if (combo.modifiers.length > 0) {
    lookupKeys.push(`mods:${combo.modifiers.join('+')}`)
  }

  return lookupKeys
}

function matchCombo(eventCombo: ParsedCombo, combo: ParsedCombo): boolean {
  if (combo.key) {
    if (eventCombo.key !== combo.key) return false
  } else if (!eventCombo.key || !isModifier(eventCombo.key) || !combo.modifiers.includes(eventCombo.key as Modifier)) {
    return false
  }

  for (const modifier of combo.modifiers) {
    if (!eventCombo.modifiers.includes(modifier)) {
      return false
    }
  }

  const extraModifiers = eventCombo.modifiers.filter(modifier => !combo.modifiers.includes(modifier))
  if (extraModifiers.length === 0) {
    return true
  }

  return (
    combo.key !== null &&
    SHIFT_REQUIRED_KEYS.has(combo.key) &&
    !combo.modifiers.includes('shift') &&
    extraModifiers.length === 1 &&
    extraModifiers[0] === 'shift'
  )
}

function resolveElement(target: EventTarget | null): Element | null {
  if (!target) return null
  if (target instanceof Element) return target
  if (target instanceof Node) return target.parentElement
  return null
}

function getEventTargetElement(e: KeyboardEvent): Element | null {
  if (typeof e.composedPath === 'function') {
    const initialTarget = e.composedPath()[0]
    const resolved = resolveElement(initialTarget ?? null)
    if (resolved) {
      return resolved
    }
  }

  return resolveElement(e.target)
}

function defaultIgnoreCallback(_e: KeyboardEvent, target: Element | null): boolean {
  if (!target) return false
  if (target.closest('.mousetrap')) return false

  const tagName = target.tagName
  return (
    (target as HTMLElement).isContentEditable || tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA'
  )
}

export function useKeyboard(options: UseKeyboardOptions = {}) {
  const { window: targetWindow = defaultWindow, ignore = defaultIgnoreCallback } = options

  const bindings = new Map<string, Binding>()
  const lookup = new Map<string, Map<string, Binding>>()

  let sequence: ParsedCombo[] = []
  let sequenceTimer: ReturnType<typeof setTimeout> | null = null

  const clearSequenceTimer = () => {
    if (sequenceTimer !== null) {
      clearTimeout(sequenceTimer)
      sequenceTimer = null
    }
  }

  const resetSequence = () => {
    sequence = []
    clearSequenceTimer()
  }

  const removeBinding = (id: string) => {
    const binding = bindings.get(id)
    if (!binding) return

    bindings.delete(id)
    const bucket = lookup.get(binding.lookupKey)
    bucket?.delete(id)
    if (bucket?.size === 0) {
      lookup.delete(binding.lookupKey)
    }
  }

  const addBinding = (combos: ParsedCombo[], action: () => void): string => {
    const id = getBindingId(combos)
    removeBinding(id)

    const binding: Binding = {
      id,
      lookupKey: getLookupKey(combos[combos.length - 1]),
      combos,
      action,
    }

    bindings.set(id, binding)

    const bucket = lookup.get(binding.lookupKey) ?? new Map<string, Binding>()
    bucket.set(id, binding)
    lookup.set(binding.lookupKey, bucket)

    return id
  }

  const getCandidates = (eventCombo: ParsedCombo): Binding[] => {
    const candidates = new Map<string, Binding>()

    for (const lookupKey of getEventLookupKeys(eventCombo)) {
      const bucket = lookup.get(lookupKey)
      if (!bucket) continue

      bucket.forEach((binding, id) => {
        candidates.set(id, binding)
      })
    }

    return Array.from(candidates.values())
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    const eventCombo = getEventCombo(e)
    const comboText = comboToId(eventCombo) || null
    const target = getEventTargetElement(e)

    if (ignore(e, target, comboText)) {
      return
    }

    clearSequenceTimer()
    sequence = [...sequence, eventCombo]
    sequenceTimer = setTimeout(() => {
      sequence = []
      sequenceTimer = null
    }, SEQUENCE_TIMEOUT)

    for (const binding of getCandidates(eventCombo)) {
      if (binding.combos.length === 1) {
        if (!matchCombo(eventCombo, binding.combos[0])) continue

        e.preventDefault()
        binding.action()
        resetSequence()
        return
      }

      const recentSequence = sequence.slice(-binding.combos.length)
      if (recentSequence.length !== binding.combos.length) continue

      const matched = recentSequence.every((combo, index) => matchCombo(combo, binding.combos[index]))
      if (!matched) continue

      e.preventDefault()
      binding.action()
      resetSequence()
      return
    }
  }

  const bind = (key: KeyCombo, action: () => void): (() => void) => {
    const ids = parseKeys(key).map(combos => addBinding(combos, action))
    const off = () => {
      ids.forEach(removeBinding)
    }
    tryOnCleanup(off)
    return off
  }

  const unbind = (key: KeyCombo): void => {
    parseKeys(key).forEach(combos => {
      removeBinding(getBindingId(combos))
    })
  }

  const trigger = (key: KeyCombo): void => {
    parseKeys(key).forEach(combos => {
      bindings.get(getBindingId(combos))?.action()
    })
  }

  const reset = (): void => {
    bindings.clear()
    lookup.clear()
    resetSequence()
  }

  onMount(() => {
    targetWindow && makeEventListener(targetWindow, 'keydown', handleKeyDown as EventListener)
  })

  onCleanup(reset)

  return { bind, unbind, trigger, reset }
}

export type UseKeyboard = ReturnType<typeof useKeyboard>
