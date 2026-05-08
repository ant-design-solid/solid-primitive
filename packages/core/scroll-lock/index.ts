import {
  access,
  isIOS,
  MaybeAccessor,
  tryOnCleanup,
} from "@s-primitives/shared";
import { Accessor, createEffect, createSignal, untrack } from "solid-js";
import { makeEventListener } from "../event-listener";

const HIDDEN = "hidden";
const SCROLL = "scroll";
const AUTO = "auto";

function checkOverflowScroll(ele: Element): boolean {
  const style = window.getComputedStyle(ele);

  if (
    style.overflowX === SCROLL ||
    style.overflowY === "scroll" ||
    (style.overflowX === AUTO && ele.clientWidth < ele.scrollWidth) ||
    (style.overflowY === AUTO && ele.clientHeight < ele.scrollHeight)
  ) {
    return true;
  } else {
    const parent = ele.parentNode as Element;
    if (!parent || parent.tagName === "BODY") {
      return false;
    }
    return checkOverflowScroll(parent);
  }
}

function preventDefault(rawEvent: TouchEvent): boolean {
  const e = rawEvent || window.event;
  const _target = e.target as Element;

  if (checkOverflowScroll(_target)) return false;

  if (e.touches.length > 1) return true;

  e.preventDefault?.();

  return false;
}

const elInitialOverflow = new WeakMap<
  HTMLElement,
  CSSStyleDeclaration["overflow"]
>();

type MaybeElement = HTMLElement | SVGElement | null | undefined;

function resolveElement(el: MaybeElement | Window | Document) {
  if (typeof Window !== "undefined" && el instanceof Window) {
    return el.document.documentElement;
  }
  if (typeof Document !== "undefined" && el instanceof Document) {
    return el.documentElement;
  }
  return el as MaybeElement;
}

export function createScrollLock(
  element: MaybeAccessor<
    HTMLElement | SVGElement | Window | Document | null | undefined
  >,
  initialState = false,
): [get: Accessor<boolean>, set: (value: boolean) => void] {
  const [isLocked, setIsLocked] = createSignal(initialState);
  let stopTouchMoveListener: VoidFunction | null = null;
  let initialOverflow: CSSStyleDeclaration["overflow"] = "";

  createEffect(() => {
    const ele = resolveElement(access(element)) as HTMLElement;

    if (ele) {
      const elOverflow = ele.style.overflow;
      if (!elInitialOverflow.get(ele)) {
        elInitialOverflow.set(ele, elOverflow);
      }
      if (ele.style.overflow !== HIDDEN) {
        initialOverflow = elOverflow;
      }

      if (ele.style.overflow === HIDDEN) {
        return setIsLocked(true);
      }
      untrack(isLocked) && (ele.style.overflow = HIDDEN);
    }
  });

  const lock = () => {
    const el = resolveElement(access(element));
    if (!el || isLocked()) return;

    if (isIOS) {
      stopTouchMoveListener = makeEventListener(
        el,
        "touchmove",
        (e) => preventDefault(e),
        {
          passive: false,
        },
      );
    }

    el.style.overflow = HIDDEN;
    setIsLocked(true);
  };

  const unlock = () => {
    const el = resolveElement(access(element));
    if (!el || !isLocked()) return;

    isIOS && stopTouchMoveListener?.();
    el.style.overflow = initialOverflow;
    elInitialOverflow.delete(el as HTMLElement);
    setIsLocked(false);
  };

  tryOnCleanup(unlock);

  return [isLocked, (v: boolean) => (v ? lock() : unlock())];
}
