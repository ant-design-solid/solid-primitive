import { isServer } from 'solid-js/web'

export function canUseDom() {
  return !isServer && typeof window !== 'undefined' && window.document && window.document.createElement
}

export const isIOS = (function () {
  return (
    !isServer &&
    !!window?.navigator?.userAgent &&
    (/iP(?:ad|hone|od)/.test(window.navigator.userAgent) ||
      // The new iPad Pro Gen3 does not identify itself as iPad, but as Macintosh.
      // https://github.com/vueuse/vueuse/issues/3577
      (window?.navigator?.maxTouchPoints > 2 && /iPad|Macintosh/.test(window?.navigator.userAgent)))
  )
})()
