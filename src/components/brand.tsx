/** The approved brand keeps its own colors in every calendar theme. */
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <img
      className={`brand-logo ${className}`}
      src="/brand/luke-lockup-v3.svg"
      width={266}
      height={106}
      alt="Luke"
      draggable={false}
    />
  );
}
