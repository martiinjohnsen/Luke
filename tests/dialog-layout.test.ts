import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { installDialogLayout } from "../src/lib/dialog-layout.ts";

function layout(t: TestContext, width: number, height: number, touch: boolean) {
  const originals = ["window", "document"].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  const visualViewport = Object.assign(new EventTarget(), { height, offsetTop: 0 });
  const viewport = Object.assign(new EventTarget(), { innerHeight: height, visualViewport, matchMedia: () => ({ matches: touch }) });
  const root = { clientWidth: width, clientHeight: height };
  const values = new Map<string, string>();
  const dialog = { scrollTop: 128, style: { setProperty: (name: string, value: string) => values.set(name, value) } };
  Object.defineProperty(globalThis, "window", { configurable: true, value: viewport });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: root } });
  const stop = installDialogLayout(dialog as unknown as HTMLDialogElement);
  t.after(() => {
    stop();
    for (const [name, original] of originals) {
      if (original) Object.defineProperty(globalThis, name, original);
      else Reflect.deleteProperty(globalThis, name);
    }
  });
  const resize = (width: number, height: number) => {
    root.clientWidth = width;
    root.clientHeight = viewport.innerHeight = height;
    viewport.dispatchEvent(new Event("resize"));
  };
  return { values, viewport, dialog, resize, stop };
}

test("opening, panning and closing the mobile keyboard preserves dialog height and manual scroll", t => {
  const { values, viewport, dialog, resize } = layout(t, 390, 844, true);
  viewport.visualViewport.height = 380;
  viewport.visualViewport.offsetTop = 120;
  viewport.visualViewport.dispatchEvent(new Event("resize"));
  viewport.visualViewport.dispatchEvent(new Event("scroll"));
  resize(390, 380);
  assert.equal(values.get("--dialog-layout-height"), "844px");
  assert.equal(dialog.scrollTop, 128);
  resize(390, 844);
  assert.equal(values.get("--dialog-layout-height"), "844px");
});
test("rotating a touch device updates the full dialog height even in wide landscape", t => {
  const { values, resize } = layout(t, 390, 844, true);
  resize(844, 390);
  assert.equal(values.get("--dialog-layout-height"), "390px");
  resize(844, 220);
  assert.equal(values.get("--dialog-layout-height"), "390px");
});
test("desktop dialogs still adapt to window height and remove their listener on close", t => {
  const { values, resize, stop } = layout(t, 1200, 900, false);
  resize(1200, 650);
  assert.equal(values.get("--dialog-layout-height"), "650px");
  stop();
  resize(1200, 800);
  assert.equal(values.get("--dialog-layout-height"), "650px");
});
