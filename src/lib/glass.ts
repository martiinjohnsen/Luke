export const DEFAULT_GLASS = 60;
export const GUEST_GLASS = 52;
export function glassLevel(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : DEFAULT_GLASS;
}
/** Preserve distinct strengths for actions, selections and the navigation frame. */
export function glassStyle(value: number): Record<string, string> {
  const level = glassLevel(value);
  const interpolate = (low: number, normal: number, high: number) => level <= DEFAULT_GLASS
    ? low + (normal-low)*level/DEFAULT_GLASS
    : normal + (high-normal)*(level-DEFAULT_GLASS)/(100-DEFAULT_GLASS);
  return {
    "--glass-action-fill": `${interpolate(42,80,98).toFixed(1)}%`,
    "--glass-choice-fill": `${interpolate(12,45,92).toFixed(1)}%`,
    "--glass-neutral-fill": `${interpolate(4,42,96).toFixed(1)}%`,
    "--glass-nav-fill": `${interpolate(0.5,32,96).toFixed(1)}%`,
    "--glass-shine": `${interpolate(8,28,35).toFixed(1)}%`,
    "--glass-blur": `${interpolate(12,20,26).toFixed(1)}px`,
    "--glass-nav-blur": `${interpolate(1,20,26).toFixed(1)}px`,
    "--glass-nav-shine": `${interpolate(0,28,35).toFixed(1)}%`,
    "--glass-reflection": `${interpolate(45,18,0).toFixed(1)}%`,
    "--glass-edge-light": `${interpolate(74,40,32.2).toFixed(1)}%`,
    // Less white pigment keeps transparent selections visibly lavender.
    "--glass-choice-tint": `${interpolate(80,32,32).toFixed(1)}%`,
    "--glass-choice-hover-tint": `${interpolate(86,40,40).toFixed(1)}%`,
    "--glass-choice-pressed-tint": `${interpolate(92,46,46).toFixed(1)}%`,
    // Keep the Safari-safe help surface, while letting its opacity follow the slider.
    "--glass-help-mix": `${interpolate(100,35,35).toFixed(1)}%`,
  };
}
