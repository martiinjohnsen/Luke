/** Keep touch dialogs full size while the keyboard covers the lower screen. */
export function installDialogLayout(dialog: HTMLDialogElement): () => void {
  let layoutWidth = -1;
  const resize = () => {
    const width = document.documentElement.clientWidth;
    const touch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    // Keyboard and browser bars change height, not the page's layout width.
    // A rotation or a desktop window resize still gets a fresh measurement.
    if ((touch || width <= 760) && width === layoutWidth) return;
    layoutWidth = width;
    dialog.style.setProperty(
      "--dialog-layout-height",
      `${Math.max(document.documentElement.clientHeight, window.innerHeight)}px`,
    );
  };
  resize();
  window.addEventListener("resize", resize);
  return () => window.removeEventListener("resize", resize);
}
