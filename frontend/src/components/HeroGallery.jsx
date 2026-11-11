import { useEffect, useRef, useState } from 'react';
import lugarService from '../services/lugarService';

const PHOTO_INTERVAL = 8000;
const REFRESH_INTERVAL = 60000;

export default function HeroGallery({ fallbackImage }) {
  const [photos, setPhotos] = useState([]);
  const [selectedUrl, setSelectedUrl] = useState(fallbackImage);
  const [displayed, setDisplayed] = useState({ url: fallbackImage, lugar_nombre: '' });
  const [previous, setPrevious] = useState(null);
  const [visible, setVisible] = useState(!document.hidden);
  const [inView, setInView] = useState(true);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const visualRef = useRef(null);
  const displayedRef = useRef(displayed);
  const failedUrls = useRef(new Set());

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const onPreference = () => setReduced(preference.matches);
    const onVisibility = () => setVisible(!document.hidden);
    preference.addEventListener('change', onPreference);
    document.addEventListener('visibilitychange', onVisibility);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(visualRef.current);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', onPreference);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || document.hidden) return;
      refreshing = true;
      try {
        const { data } = await lugarService.getGaleria({ signal: controller.signal });
        if (controller.signal.aborted) return;
        const next = (data.fotos || []).filter((photo) => !failedUrls.current.has(photo.url));
        setPhotos(next);
        setSelectedUrl((current) => next.some((photo) => photo.url === current) ? current : next[0]?.url || fallbackImage);
      } catch {
        // A temporary service failure keeps the last successful gallery visible.
      } finally { refreshing = false; }
    };
    const onVisibility = () => { if (!document.hidden) refresh(); };
    refresh();
    const timer = window.setInterval(refresh, REFRESH_INTERVAL);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fallbackImage]);

  const selected = photos.find((photo) => photo.url === selectedUrl) || photos[0];
  const targetUrl = selected?.url || fallbackImage;
  const targetName = selected?.lugar_nombre || '';
  useEffect(() => {
    if (targetUrl === displayedRef.current.url) {
      if (targetName !== displayedRef.current.lugar_nombre) {
        const next = { url: targetUrl, lugar_nombre: targetName };
        displayedRef.current = next;
        setDisplayed(next);
      }
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      setPrevious(displayedRef.current);
      const next = { url: targetUrl, lugar_nombre: targetName };
      displayedRef.current = next;
      setDisplayed(next);
    };
    image.onerror = () => {
      if (cancelled) return;
      failedUrls.current.add(targetUrl);
      setPhotos((current) => current.filter((photo) => photo.url !== targetUrl));
    };
    image.src = targetUrl;
    return () => { cancelled = true; image.onload = null; image.onerror = null; };
  }, [targetUrl, targetName]);

  useEffect(() => {
    if (reduced || !visible || !inView || photos.length < 2) return;
    const timer = window.setTimeout(() => {
      const index = photos.findIndex((photo) => photo.url === targetUrl);
      setSelectedUrl(photos[(index + 1) % photos.length].url);
    }, PHOTO_INTERVAL);
    return () => window.clearTimeout(timer);
  }, [photos, targetUrl, reduced, visible, inView]);
  return (
      <div ref={visualRef} className="dashboard-hero__visual camp-hero-gallery" aria-hidden="true">
        {previous && <img className="camp-hero-gallery__previous" src={previous.url} alt="" />}
        <img key={displayed.url} className="camp-hero-gallery__current" src={displayed.url} alt="" fetchPriority="high" />
      </div>
  );
}
