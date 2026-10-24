"use client";

import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

/**
 * One drag behaviour for the whole app, the way native apps do it:
 *
 * - Mouse/trackpad: the drag starts after moving 6 px, so a plain click
 *   still selects or opens the item.
 * - Touch (iPad): press and hold for 250 ms, then drag. A quick tap still
 *   works as a tap, and swiping right away scrolls the list as usual.
 * - Keyboard: Space/Enter picks up, arrow keys move, Space/Enter drops,
 *   Escape cancels.
 *
 * MouseSensor + TouchSensor instead of PointerSensor: on iPad, touches also
 * fire pointer events, so a PointerSensor would start a drag on every swipe
 * and block scrolling.
 */
export const DRAG_TOUCH_DELAY_MS = 250;

export function useDragSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: DRAG_TOUCH_DELAY_MS, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );
}

/**
 * Classes for every drag source: no text selection or iOS callout menu on
 * long press, and normal panning stays possible until the drag starts.
 */
export const DRAG_SOURCE_CLASS =
  "select-none touch-manipulation [-webkit-touch-callout:none] [-webkit-user-select:none]";

/** Short haptic tick when a drag starts (Android; iOS Safari ignores it). */
export function dragStartFeedback() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
  } catch {
    // Some browsers throw without a user gesture; feedback is optional.
  }
}
