import { useEffect, useState, type RefObject } from 'react';

export function useScrollTop(ref: RefObject<HTMLElement | null>, threshold = 100) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onScroll = () => setShow(element.scrollTop > threshold);
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
  }, [ref, threshold]);

  const scrollToTop = () => ref.current?.scrollTo({ top: 0, behavior: 'smooth' });
  return { show, scrollToTop };
}
