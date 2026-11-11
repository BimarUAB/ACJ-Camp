import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function ImageViewer({ src, alt, onClose }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog ref={dialogRef} className="camp-image-viewer" aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="camp-image-viewer__toolbar">
        <h2 id={titleId}>{alt}</h2>
        <button type="button" autoFocus onClick={onClose} aria-label="Cerrar imagen" title="Cerrar imagen">
          <X size={24} aria-hidden="true" />
        </button>
      </div>
      {failed ? <p role="alert" className="camp-image-viewer__error">No se pudo cargar la imagen. Ciérrala e intenta nuevamente.</p> : (
        <img src={src} alt={alt} onError={() => setFailed(true)} />
      )}
    </dialog>,
    document.body
  );
}
