"use client";
import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

export function AutoTextarea({ value, className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    const fit = () => {
      if (!field.clientWidth) return;
      const border = field.offsetHeight - field.clientHeight;
      field.style.height = "auto";
      field.style.height = `${field.scrollHeight + border}px`;
    };
    fit();
    let width = field.clientWidth;
    const observer = new ResizeObserver(() => {
      if (field.clientWidth === width) return;
      width = field.clientWidth;
      fit();
    });
    observer.observe(field);
    return () => observer.disconnect();
  }, [value]);
  return <textarea {...props} ref={ref} value={value} className={`auto-textarea ${className}`} />;
}
