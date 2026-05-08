import { Accessor, getOwner, onCleanup } from 'solid-js'
import { isDev } from 'solid-js/web'

export type MaybeAccessor<T = any> = Accessor<T> | T

export type MaybeAccessorValue<T extends MaybeAccessor<any>> = T extends () => any ? ReturnType<T> : T

export const access = <T extends MaybeAccessor<any>>(v: T): MaybeAccessorValue<T> =>
  typeof v === 'function' && !v.length ? v() : (v as any)

/**
 * 不在组件内运行时会报错
 * */
export const tryOnCleanup: typeof onCleanup = isDev ? fn => (getOwner() ? onCleanup(fn) : fn) : onCleanup
