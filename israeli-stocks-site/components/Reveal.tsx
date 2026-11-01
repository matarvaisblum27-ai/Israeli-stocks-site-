'use client';

import { createElement, useEffect, useRef, type ReactNode, type CSSProperties } from 'react';

/**
 * Slides children up + fades them in the first time they enter the viewport.
 * Uses a single IntersectionObserver per element; respects reduced-motion via CSS.
 */
export default function Reveal({
  children,
  as = 'div',
  delay = 0,
  className = '',
  style,
}: {
  children: ReactNode;
  as?: keyof JSX.IntrinsicElements;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        }
      },
      // threshold 0 so very tall blocks (long company lists) still trigger
      { threshold: 0, rootMargin: '0px 0px -10% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return createElement(
    as,
    {
      ref,
      className: `reveal ${className}`,
      style: { transitionDelay: delay ? `${delay}ms` : undefined, ...style },
    },
    children
  );
}
