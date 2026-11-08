"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icons";
import { installDialogLayout } from "@/lib/dialog-layout";
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
  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement;
    const dialog = ref.current;
    if (!dialog) return;
    // Measure before showModal can focus a field and open the keyboard.
    const stopLayout = installDialogLayout(dialog);
    dialog.showModal();
    const resizeEffects = () => dialog.style.setProperty("--dialog-effect-height", `${dialog.clientHeight}px`);
    resizeEffects();
    const observer = new ResizeObserver(resizeEffects);
    observer.observe(dialog);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      stopLayout();
      observer.disconnect();
      document.body.style.overflow = previousOverflow;
      returnFocus.current?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "dialog-wide" : ""} ${className}`}
      aria-label={title}
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
          type="button"
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
