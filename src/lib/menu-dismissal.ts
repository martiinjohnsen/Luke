/** Safari can blur a summary without focusing the menu button being tapped. */
export function installMenuDismissal(menu: HTMLDetailsElement): () => void {
  const outside = (event: PointerEvent) => {
    if (!menu.contains(event.target as Node)) menu.open = false;
  };
  const blur = (event: FocusEvent) => {
    if (event.relatedTarget && !menu.contains(event.relatedTarget as Node))
      menu.open = false;
  };
  const key = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    menu.open = false;
    menu.querySelector("summary")?.focus();
  };
  const capture = { capture: true };
  document.addEventListener("pointerdown", outside, capture);
  menu.addEventListener("focusout", blur);
  menu.addEventListener("keydown", key);
  return () => {
    document.removeEventListener("pointerdown", outside, capture);
    menu.removeEventListener("focusout", blur);
    menu.removeEventListener("keydown", key);
  };
}
