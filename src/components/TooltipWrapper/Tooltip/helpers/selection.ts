export const selectionExists = (selection: Selection | null) => {
  return (
    !!selection &&
    selection.rangeCount > 0 &&
    !selection.isCollapsed &&
    selection.toString().length > 0 &&
    !selection.toString().match(/^\n+$/i)
  );
};

export const isSelectionInEditableElement = () => {
  const selection = getSelection()!;
  if (selectionExists(selection)) {
    const range = selection.getRangeAt(0);
    for (
      let container: Node | null = range.commonAncestorContainer;
      container !== null;
      container = container.parentNode
    ) {
      if (container.nodeType !== Node.ELEMENT_NODE) continue;
      const element = container as HTMLElement;
      const name = element.tagName.toLowerCase();
      if (name === 'input' || name === 'textarea' || element.isContentEditable) {
        return true;
      }
    }
  }

  return false;
};

export const getHoveredRect = (e: MouseEvent, rects: DOMRectList | null) => {
  if (rects) {
    for (let i = 0; i < rects.length; i++) {
      if (isMouseInRect(e, rects[i])) {
        return rects[i];
      }
    }
  }

  return null;
};

/**
 * Determine if cursor is currently inside of given rect (including edges).
 * @param e
 * @param rect
 */
export const isMouseInRect = (e: MouseEvent, rect: DOMRect): boolean => {
  rect = getTolerantRect(rect);
  return (
    e.clientX >= rect.left &&
    e.clientX <= rect.right &&
    e.clientY >= rect.top &&
    e.clientY <= rect.bottom
  );
};

/**
 * Computes the if the mouse is contained within the polygon defined by the three furthest
 * corners on both given rectangles.
 * @param e
 * @param r1
 * @param r2
 */
export const isMouseBetweenRects = (e: MouseEvent, r1: DOMRect, r2: DOMRect): boolean => {
  r1 = getTolerantRect(r1);
  r2 = getTolerantRect(r2);

  // Ensure that r1 is always the higher rect and r2 is the lower rect
  if (r2.bottom < r1.bottom) {
    const temp = r1;
    r1 = r2;
    r2 = temp;
  }

  if (
    e.clientY < r1.top ||
    e.clientY > r2.bottom ||
    e.clientX < Math.min(r1.left, r2.left) ||
    e.clientX > Math.max(r1.right, r2.right)
  ) {
    return false;
  }

  // Compute left bound
  let ratio: number;
  if (r1.left > r2.left) {
    // Left edge is defined by top left corners of both rects
    ratio = (e.clientY - r1.top) / (r2.top - r1.top);
  } else {
    // Left edge is defined by bottom left corners of both rects
    ratio = (e.clientY - r1.bottom) / (r2.bottom - r1.bottom);
  }

  const xL = r1.left - ratio * (r1.left - r2.left);
  if (e.clientX < xL) return false;

  // Compute right bound
  if (r1.right <= r2.right) {
    // Right edge is defined by top right corners of both rects
    ratio = (e.clientY - r1.top) / (r2.top - r1.top);
  } else {
    // Right edge is defined by bottom right corners of both rects
    ratio = (e.clientY - r1.bottom) / (r2.bottom - r1.bottom);
  }

  const xR = r1.right - ratio * (r1.right - r2.right);
  return e.clientX <= xR;
};

/**
 * Returns a rect that is slightly larger and encompasses given rect. This tolerance reconciles
 * clientRect with the area used for mouseenter events, which seem to be off by a few pixels.
 * @param rect
 */
const getTolerantRect = (rect: DOMRect) => {
  const tolerance = 1.5;
  return new DOMRect(
    rect.x - tolerance,
    rect.y - tolerance,
    rect.width + 2 * tolerance,
    rect.height + 2 * tolerance,
  );
};
