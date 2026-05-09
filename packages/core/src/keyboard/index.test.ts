import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { useKeyboard, type UseKeyboardOptions } from "./index";

function withKeyboard(
  options: UseKeyboardOptions = {},
  run: (keyboard: ReturnType<typeof useKeyboard>) => void | Promise<void>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    createRoot((dispose) => {
      const keyboard = useKeyboard({
        window,
        ...options,
      });

      Promise.resolve()
        .then(() => undefined)
        .then(() => run(keyboard))
        .then(
          () => {
            dispose();
            resolve();
          },
          (error) => {
            dispose();
            reject(error);
          },
        );
    });
  });
}

async function dispatchKeyDown(
  target: EventTarget,
  init: KeyboardEventInit = {},
): Promise<KeyboardEvent> {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });

  target.dispatchEvent(event);
  await Promise.resolve();
  return event;
}

function createKeyboardTarget(platform: string) {
  return Object.assign(new EventTarget(), {
    navigator: { platform },
  }) as Window;
}

describe("useKeyboard", () => {
  it("mod 应按平台解析，并支持 command/cmd 别名", async () => {
    const macTarget = createKeyboardTarget("MacIntel");

    await withKeyboard({ window: macTarget }, async (keyboard) => {
      const modAction = vi.fn();
      const commandAction = vi.fn();
      const cmdAction = vi.fn();

      keyboard.bind("mod+a", modAction);
      keyboard.bind("command+b", commandAction);
      keyboard.bind("cmd+c", cmdAction);

      await dispatchKeyDown(macTarget, {
        key: "a",
        code: "KeyA",
        metaKey: true,
      });
      await dispatchKeyDown(macTarget, {
        key: "b",
        code: "KeyB",
        metaKey: true,
      });
      await dispatchKeyDown(macTarget, {
        key: "c",
        code: "KeyC",
        metaKey: true,
      });
      await dispatchKeyDown(macTarget, {
        key: "a",
        code: "KeyA",
        ctrlKey: true,
      });

      expect(modAction).toHaveBeenCalledTimes(1);
      expect(commandAction).toHaveBeenCalledTimes(1);
      expect(cmdAction).toHaveBeenCalledTimes(1);
    });

    const windowsTarget = createKeyboardTarget("Win32");

    await withKeyboard({ window: windowsTarget }, async (keyboard) => {
      const action = vi.fn();

      keyboard.bind("mod+d", action);

      await dispatchKeyDown(windowsTarget, {
        key: "d",
        code: "KeyD",
        ctrlKey: true,
      });
      await dispatchKeyDown(windowsTarget, {
        key: "d",
        code: "KeyD",
        metaKey: true,
      });

      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  it("数组形式绑定应作为多个独立快捷键处理", async () => {
    const target = createKeyboardTarget("Win32");

    await withKeyboard({ window: target }, async (keyboard) => {
      const action = vi.fn();

      keyboard.bind(["ctrl+a", "meta+a"], action);

      await dispatchKeyDown(target, { key: "a", code: "KeyA", ctrlKey: true });
      await dispatchKeyDown(target, { key: "a", code: "KeyA", metaKey: true });

      expect(action).toHaveBeenCalledTimes(2);
    });
  });

  it("unbind 后快捷键不应再触发", async () => {
    const target = createKeyboardTarget("Win32");

    await withKeyboard({ window: target }, async (keyboard) => {
      const action = vi.fn();

      const off = keyboard.bind("ctrl+k", action);

      await dispatchKeyDown(target, { key: "k", code: "KeyK", ctrlKey: true });
      expect(action).toHaveBeenCalledTimes(1);

      off();
      await dispatchKeyDown(target, { key: "k", code: "KeyK", ctrlKey: true });
      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  it("trigger 与 reset 应分别执行触发与清空绑定", async () => {
    const target = createKeyboardTarget("Win32");

    await withKeyboard({ window: target }, async (keyboard) => {
      const action = vi.fn();

      keyboard.bind("ctrl+l", action);
      keyboard.trigger("ctrl+l");
      expect(action).toHaveBeenCalledTimes(1);

      keyboard.reset();
      keyboard.trigger("ctrl+l");
      await dispatchKeyDown(target, { key: "l", code: "KeyL", ctrlKey: true });
      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  it("输入元素默认不应触发快捷键，mousetrap 类名可放行", async () => {
    await withKeyboard({}, async (keyboard) => {
      const action = vi.fn();
      const input = document.createElement("input");

      document.body.appendChild(input);
      keyboard.bind("delete", action);

      try {
        await dispatchKeyDown(input, { key: "Delete", code: "Delete" });
        expect(action).not.toHaveBeenCalled();

        input.className = "mousetrap";
        await dispatchKeyDown(input, { key: "Delete", code: "Delete" });
        expect(action).toHaveBeenCalledTimes(1);
      } finally {
        input.remove();
      }
    });
  });

  it("plus/++ 写法应匹配 shift 产生的加号键", async () => {
    const target = createKeyboardTarget("MacIntel");

    await withKeyboard({ window: target }, async (keyboard) => {
      const action = vi.fn();

      keyboard.bind("mod++", action);

      const event = await dispatchKeyDown(target, {
        key: "+",
        code: "Equal",
        ctrlKey: true,
        shiftKey: true,
      });

      expect(action).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });
  });

  it("按键序列应保持可用", async () => {
    const target = createKeyboardTarget("Win32");

    await withKeyboard({ window: target }, async (keyboard) => {
      const action = vi.fn();

      keyboard.bind("g i", action);

      await dispatchKeyDown(target, { key: "g", code: "KeyG" });
      await dispatchKeyDown(target, { key: "i", code: "KeyI" });

      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  it("非 shift 必需字符不应容忍额外修饰键", async () => {
    const target = createKeyboardTarget("Win32");

    await withKeyboard({ window: target }, async (keyboard) => {
      const action = vi.fn();

      keyboard.bind("ctrl+a", action);

      await dispatchKeyDown(target, {
        key: "a",
        code: "KeyA",
        ctrlKey: true,
        shiftKey: true,
      });
      expect(action).not.toHaveBeenCalled();

      await dispatchKeyDown(target, { key: "a", code: "KeyA", ctrlKey: true });
      expect(action).toHaveBeenCalledTimes(1);
    });
  });
});
