export const EASE_OUT = [0.215, 0.61, 0.355, 1] as const;
export const EASE_SOFT = [0.22, 1, 0.36, 1] as const;

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

export function smoothstep(value: number) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

export function smootherstep(value: number) {
  const t = clamp(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export const INTRO_HOLD_SVH = 52;
export const INTRO_SPAN_SVH = 205;
export const INTRO_LOCK_SVH = INTRO_HOLD_SVH + INTRO_SPAN_SVH + 20;

export function introProgress(value: number, unitsPerVh: number) {
  return clamp(
    (value - INTRO_HOLD_SVH * unitsPerVh) / (INTRO_SPAN_SVH * unitsPerVh),
  );
}

export function introDepart(progress: number) {
  return smootherstep((progress - 0.58) / 0.42);
}

export function introFade(progress: number) {
  return smootherstep((progress - 0.56) / 0.44);
}

export function introHintFade(progress: number) {
  return smootherstep((progress - 0.42) / 0.24);
}

export function introLineReveal(progress: number) {
  return clamp((progress - 0.96) / 0.04);
}

export function introClearY(unitsPerVh: number) {
  return INTRO_HOLD_SVH * unitsPerVh + INTRO_SPAN_SVH * unitsPerVh;
}

export function stageEntered(value: number, nodeY: number, lead = 540) {
  return smoothstep((value - (nodeY - lead)) / 320);
}

export function stageOpacity(value: number, nodeY: number, lead = 540) {
  const faded = smoothstep((value - (nodeY + 500)) / 760);
  return stageEntered(value, nodeY, lead) * (1 - faded);
}

export function stageEnterY(value: number, nodeY: number, lead = 540) {
  return (1 - stageEntered(value, nodeY, lead)) * 16;
}

export function stageIsQuiet(value: number, nodeY: number, lead = 540) {
  return stageOpacity(value, nodeY, lead) < 0.36;
}

export function stageIsLive(value: number, nodeY: number, lead = 540) {
  return stageOpacity(value, nodeY, lead) > 0.24;
}

export function stageHoldFade(value: number, nodeY: number, exitY: number) {
  const span = Math.max(exitY - nodeY, 1);
  const t = clamp((value - nodeY) / span);
  if (t <= 0.75) return 0;
  if (t >= 0.92) return 1;
  return smoothstep((t - 0.75) / 0.17);
}

export function stageHoldOpacity(value: number, nodeY: number, exitY: number) {
  return stageEntered(value, nodeY) * (1 - stageHoldFade(value, nodeY, exitY));
}

export function stageHoldShift(value: number, nodeY: number, exitY: number) {
  return stageEnterY(value, nodeY) + stageHoldFade(value, nodeY, exitY) * 10;
}

export function stageHoldScale(value: number, nodeY: number, exitY: number) {
  return 1 - stageHoldFade(value, nodeY, exitY) * 0.035;
}
