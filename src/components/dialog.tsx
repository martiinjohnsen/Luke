"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icons";
import { fieldScrollOffset } from "@/lib/dialog-layout";
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
  className = "",
  overlay,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
  overlay?: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const focusFrame = useRef(0);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function revealFocusedField(center = false) {
    cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => {
      const dialog = ref.current;
      const active = document.activeElement;
      const scroller = dialog?.querySelector<HTMLElement>(".dialog-scroll");
      if (!scroller || !(active instanceof HTMLElement) || !scroller.contains(active) ||
        !active.matches("input:not([type='file']),textarea,select,[contenteditable='true']")) return;
      const bounds = scroller.getBoundingClientRect();
      let bottom = bounds.bottom;
      // A pinned action row is inside the scroller but covers part of its view.
      for (const footer of scroller.querySelectorAll<HTMLElement>(".sticky-actions, .calendar-settings-panel > .dialog-actions")) {
        const rect = footer.getBoundingClientRect();
        if (getComputedStyle(footer).position === "sticky" && rect.top < bottom && rect.bottom > bounds.top)
          bottom = Math.max(bounds.top, rect.top);
      }
      const offset = fieldScrollOffset({ top: bounds.top, bottom }, active.getBoundingClientRect(), 16, center && window.matchMedia("(max-width: 760px)").matches);
      if (offset) scroller.scrollTop += offset;
    });
  }
  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement;
    const dialog = ref.current;
    const viewport = window.visualViewport;
    const resize = () => {
      const focused = document.activeElement;
      const typing = focused instanceof HTMLElement && dialog?.contains(focused) && focused.matches("input:not([type='checkbox']):not([type='radio']):not([type='file']),textarea,[contenteditable='true']");
      dialog?.classList.toggle("is-keyboard-open", !!typing && Math.max(window.innerHeight, document.documentElement.clientHeight) - (viewport?.height ?? window.innerHeight) > 120);
      dialog?.style.setProperty(
        "--dialog-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      dialog?.style.setProperty(
        "--dialog-viewport-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
      dialog?.style.setProperty(
        "--dialog-effect-height", `${dialog.clientHeight}px`,
      );
      revealFocusedField();
    };
    dialog?.showModal();
    resize();
    const observer = new ResizeObserver(resize);
    if (dialog) observer.observe(dialog);
    const content = dialog?.querySelector(".dialog-scroll")?.firstElementChild;
    if (content) observer.observe(content);
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      cancelAnimationFrame(focusFrame.current);
      if (focusTimer.current) clearTimeout(focusTimer.current);
      observer.disconnect();
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
      document.body.style.overflow = previousOverflow;
      returnFocus.current?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "dialog-wide" : ""} ${className}`}
      aria-label={title}
      onFocusCapture={() => {
        revealFocusedField(true);
        if (focusTimer.current) clearTimeout(focusTimer.current);
        // iOS changes the visible viewport throughout the keyboard animation.
        focusTimer.current = setTimeout(() => revealFocusedField(true), 350);
      }}
      onCancel={(event) => {
        if(event.target!==event.currentTarget) return;
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (
          event.target === event.currentTarget &&
          event.clientX !== 0 &&
          event.clientY !== 0
        ) {
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Lukk dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="dialog-scroll" tabIndex={0}>
        {children}
      </div>
      {footer && <div className="dialog-footer">{footer}</div>}
      {overlay && <div className="dialog-effects">{overlay}</div>}
    </dialog>
  );
}
