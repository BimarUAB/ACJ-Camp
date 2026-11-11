import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Content is visible without this enhancement; animation never gates navigation.
export default function InterfaceMotion() {
  const { pathname } = useLocation();
  const keyboardInput = useRef(false);

  useEffect(() => {
    const header = document.querySelector('.camp-site-header');
    const app = document.querySelector('.camp-app');
    if (!header || !app) return;
    const resize = new ResizeObserver(() => {
      app.style.setProperty('--camp-header-height', `${header.getBoundingClientRect().height}px`);
    });
    resize.observe(header);
    return () => resize.disconnect();
  }, []);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const app = document.querySelector('.camp-app');
    if (!app || !Element.prototype.animate) return;
    const seen = new WeakSet();
    const running = new Set();
    const cancel = () => {
      for (const animation of running) animation.cancel();
      running.clear();
    };
    const onKey = () => { keyboardInput.current = true; cancel(); };
    const onPointer = () => { keyboardInput.current = false; };
    const onPreference = () => { if (preference.matches) cancel(); };
    const enter = () => {
      const targets = app.querySelectorAll('.dashboard-hero__copy > h1, .dashboard-hero__copy > p, .camp-home-search, .dashboard-hero__visual, .camp-auth-card, .camp-admin-content > div');
      let index = 0;
      for (const element of targets) {
        if (seen.has(element)) continue;
        seen.add(element);
        if (pathname === '/mapa' || preference.matches || keyboardInput.current || document.hidden) continue;
        const visual = element.matches('.dashboard-hero__visual');
        const animation = element.animate(
          visual
            ? [{ clipPath: 'inset(0 5% 0 0)', opacity: 0.6 }, { clipPath: 'inset(0 0% 0 0)', opacity: 1 }]
            : [{ transform: 'translateY(8px)', opacity: 0.5 }, { transform: 'translateY(0)', opacity: 1 }],
          { duration: 240, delay: Math.min(index++ * 35, 105), easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
        );
        running.add(animation);
        animation.finished.then(() => running.delete(animation), () => running.delete(animation));
      }
    };
    const observer = new MutationObserver(enter);
    observer.observe(app, { childList: true, subtree: true });
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    preference.addEventListener('change', onPreference);
    enter();
    return () => {
      observer.disconnect();
      cancel();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      preference.removeEventListener('change', onPreference);
    };
  }, [pathname]);
  return null;
}
