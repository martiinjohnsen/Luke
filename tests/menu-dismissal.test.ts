import test from "node:test";
import assert from "node:assert/strict";
import { installMenuDismissal } from "../src/lib/menu-dismissal.ts";

test("touch menu actions survive Safari's unfocused button tap; outside taps and Escape still dismiss", t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  const document = new EventTarget();
  const button = new EventTarget();
  let focusCount = 0, activations = 0;
  const summary = { focus: () => focusCount++ };
  const menu = Object.assign(new EventTarget(), {
    open: true,
    contains: (target: unknown) => target === button || target === summary || target === menu,
    querySelector: () => summary,
  });
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  const stop = installMenuDismissal(menu as unknown as HTMLDetailsElement);
  t.after(() => {
    stop();
    if (original) Object.defineProperty(globalThis, "document", original);
    else Reflect.deleteProperty(globalThis, "document");
  });
  function fire(target: EventTarget, name: string, properties: Record<string, unknown> = {}) {
    const event = new Event(name);
    for (const [key, value] of Object.entries(properties)) Object.defineProperty(event, key, { value });
    target.dispatchEvent(event);
  }
  button.addEventListener("click", () => { if (menu.open) activations++; });
  for (const action of ["duplicate", "delete"]) {
    menu.open = true;
    fire(document, "pointerdown", { target: button, pointerType: "touch" });
    fire(menu, "focusout", { relatedTarget: null });
    assert.equal(menu.open, true, `${action} was hidden before the click`);
    fire(button, "click");
  }
  assert.equal(activations, 2);
  fire(menu, "focusout", { relatedTarget: summary });
  assert.equal(menu.open, true);
  fire(document, "pointerdown");
  assert.equal(menu.open, false);
  menu.open = true;
  fire(menu, "focusout", { relatedTarget: document });
  assert.equal(menu.open, false);
  menu.open = true;
  fire(menu, "keydown", { key: "Escape" });
  assert.equal(menu.open, false);
  assert.equal(focusCount, 1);
  stop();
  menu.open = true;
  fire(document, "pointerdown");
  assert.equal(menu.open, true, "The menu listener survived teardown");
});
