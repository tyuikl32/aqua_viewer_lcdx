export interface ViewportPoint {
  x: number;
  y: number;
}

export interface FixedPositionPoint {
  left: number;
  top: number;
}

export interface FixedPositioningContextOrigin {
  left: number;
  top: number;
}

/**
 * Finds the ancestor that changes the containing block for a fixed-position
 * descendant. A transformed route wrapper is enough to make `position: fixed`
 * relative to that wrapper instead of the viewport.
 */
export function findFixedPositioningContext(element: HTMLElement): HTMLElement | null {
  let ancestor = element.parentElement;
  while (ancestor) {
    const style = getComputedStyle(ancestor);
    if (
      style.transform !== 'none' ||
      style.perspective !== 'none' ||
      style.filter !== 'none' ||
      style.contain !== 'none' ||
      style.willChange.split(',').some((value) => {
        const property = value.trim();
        return property === 'transform' || property === 'perspective' || property === 'filter';
      })
    ) {
      return ancestor;
    }
    ancestor = ancestor.parentElement;
  }
  return null;
}

/** Returns the viewport origin used by a fixed descendant of the context. */
export function getFixedPositioningContextOrigin(
  context: HTMLElement | null,
): FixedPositioningContextOrigin {
  if (!context) return { left: 0, top: 0 };
  const rect = context.getBoundingClientRect();
  return {
    left: rect.left + context.clientLeft,
    top: rect.top + context.clientTop,
  };
}

/** Converts a viewport point into the coordinate system used by a fixed card. */
export function toFixedPositionPoint(
  point: ViewportPoint,
  context: HTMLElement | null,
): FixedPositionPoint {
  const origin = getFixedPositioningContextOrigin(context);
  return {
    left: point.x - origin.left,
    top: point.y - origin.top,
  };
}
