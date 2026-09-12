import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const MOBILE_QUERY = '(max-width: 991.98px)';
const SCROLL_THRESHOLD = 18;
const BOTTOM_GESTURE_THRESHOLD = 32;

function pagePosition() {
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  // Clamp elastic overscroll so bouncing back from an edge is not a reversal.
  const y = Math.min(max, Math.max(0, window.scrollY));
  return { y, atBottom: max - y <= 2 };
}

function isPageGesture(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (target.closest('footer, [role="dialog"], [role="menu"], [data-slot="sheet-content"]')) return false;
  for (let node: Element | null = target; node && node !== document.body; node = node.parentElement) {
    if (node.scrollHeight > node.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(node).overflowY)) {
      return false;
    }
  }
  return true;
}

/** Keep the glass stationary in its own layer; only its dimensions morph. */
export function useMobileLiquidFooter(enabled: boolean, routeKey: string) {
  const footerRef = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);

  useLayoutEffect(() => {
    const footer = footerRef.current;
    if (!enabled || !footer) return;
    const layout = footer.querySelector<HTMLElement>('.shell-footer-layout');
    const controls = footer.querySelector<HTMLElement>('.shell-footer-controls');
    if (!layout || !controls) return;
    const media = window.matchMedia(MOBILE_QUERY);
    const measure = () => {
      if (!media.matches) return;
      const style = getComputedStyle(layout);
      const inlinePadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const blockPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      // The inner layout retains its full width throughout the transition, so
      // wrapping, language changes, and web fonts cannot create a resize loop.
      footer.style.setProperty('--footer-expanded-height', `${layout.offsetHeight + 2}px`);
      footer.style.setProperty('--footer-compact-width', `${controls.offsetWidth + inlinePadding + 2}px`);
      footer.style.setProperty('--footer-compact-height', `${controls.offsetHeight + blockPadding + 2}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(layout);
    observer.observe(controls);
    media.addEventListener('change', measure);
    measure();
    return () => {
      observer.disconnect();
      media.removeEventListener('change', measure);
      for (const name of ['--footer-expanded-height', '--footer-compact-width', '--footer-compact-height']) {
        footer.style.removeProperty(name);
      }
    };
  }, [enabled]);

  useEffect(() => {
    setCompact(false);
    if (!enabled) return;
    const media = window.matchMedia(MOBILE_QUERY);
    let previousY = pagePosition().y;
    let travel = 0;
    let direction = 0;
    let bottomExpanded = false;
    let touch: { x: number; y: number } | null = null;
    let lastWheelAt = -Infinity;
    let wheelStartedAtBottom = false;
    let wheelTravel = 0;

    const menuOpen = () => Boolean(footerRef.current?.querySelector('[aria-expanded="true"]'));
    const reset = () => {
      previousY = pagePosition().y;
      travel = 0;
      direction = 0;
      touch = null;
      lastWheelAt = -Infinity;
      if (!media.matches) {
        bottomExpanded = false;
        setCompact(false);
      }
    };
    const expandAtBottom = () => {
      if (!pagePosition().atBottom || menuOpen()) return;
      bottomExpanded = true;
      travel = 0;
      setCompact(false);
    };
    const onScroll = () => {
      const { y, atBottom } = pagePosition();
      const delta = y - previousY;
      previousY = y;
      if (!atBottom) bottomExpanded = false;
      if (!media.matches || menuOpen()) {
        travel = 0;
        return;
      }
      if (y <= 24) {
        setCompact(false);
        travel = 0;
        return;
      }
      if (Math.abs(delta) < 1) return;
      const nextDirection = Math.sign(delta);
      travel = nextDirection === direction ? travel + Math.abs(delta) : Math.abs(delta);
      direction = nextDirection;
      if (travel < SCROLL_THRESHOLD) return;
      // Do not collapse information a keyboard user is currently navigating.
      const detailsFocused = footerRef.current?.querySelector('.shell-footer-details')?.contains(document.activeElement);
      if (direction < 0) setCompact(false);
      else if (!bottomExpanded && !detailsFocused) setCompact(true);
    };
    const onTouchStart = (event: TouchEvent) => {
      touch = null;
      if (!media.matches || event.touches.length !== 1 || !pagePosition().atBottom || !isPageGesture(event.target)) return;
      touch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!touch || event.touches.length !== 1) return;
      const dy = touch.y - event.touches[0].clientY;
      const dx = Math.abs(touch.x - event.touches[0].clientX);
      if (dy > BOTTOM_GESTURE_THRESHOLD && dy > dx) {
        expandAtBottom();
        touch = null;
      }
    };
    const endTouch = () => { touch = null; };
    const onWheel = (event: WheelEvent) => {
      if (!media.matches || event.ctrlKey || !isPageGesture(event.target)) return;
      if (event.timeStamp - lastWheelAt > 180) {
        wheelStartedAtBottom = pagePosition().atBottom;
        wheelTravel = 0;
      }
      lastWheelAt = event.timeStamp;
      if (event.deltaY <= 0 || Math.abs(event.deltaX) > event.deltaY) {
        wheelStartedAtBottom = false;
        return;
      }
      wheelTravel += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      if (wheelStartedAtBottom && wheelTravel > BOTTOM_GESTURE_THRESHOLD) expandAtBottom();
    };

    // Document scroll does not bubble from nested scrollers. Touch/wheel are
    // used only for a NEW downward gesture when the page cannot scroll farther.
    document.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', endTouch, { passive: true });
    document.addEventListener('touchcancel', endTouch, { passive: true });
    document.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('resize', reset);
    media.addEventListener('change', reset);
    return () => {
      document.removeEventListener('scroll', onScroll);
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', endTouch);
      document.removeEventListener('touchcancel', endTouch);
      document.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', reset);
      media.removeEventListener('change', reset);
    };
  }, [enabled, routeKey]);

  return { footerRef, compact: enabled && compact };
}
