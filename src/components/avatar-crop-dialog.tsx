'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';

type AvatarCropDialogProps = {
  file: File;
  title: string;
  help: string;
  zoomLabel: string;
  cancelLabel: string;
  useImageLabel: string;
  busy: boolean;
  onCancel: () => void;
  onComplete: (image: Blob) => void;
};

export function AvatarCropDialog({
  file,
  title,
  help,
  zoomLabel,
  cancelLabel,
  useImageLabel,
  busy,
  onCancel,
  onComplete,
}: AvatarCropDialogProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, size: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ left: 0, top: 0 });

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const url = URL.createObjectURL(file);
    image.src = url;
    return () => {
      image.removeAttribute('src');
      URL.revokeObjectURL(url);
    };
  }, [file]);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onCancel]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const fitScale =
    dimensions.width && dimensions.height && dimensions.size
      ? dimensions.size / Math.min(dimensions.width, dimensions.height)
      : 0;
  const scale = fitScale * zoom;
  const imageWidth = dimensions.width * scale;
  const imageHeight = dimensions.height * scale;
  const boundedOffset = {
    left: Math.min(0, Math.max(dimensions.size - imageWidth, offset.left)),
    top: Math.min(0, Math.max(dimensions.size - imageHeight, offset.top)),
  };

  const startCrop = useCallback(() => {
    const image = imageRef.current;
    const viewport = viewportRef.current;
    if (!image || !viewport) return;
    const size = viewport.getBoundingClientRect().width;
    if (!image.naturalWidth || !image.naturalHeight || !size) return;
    const fit = size / Math.min(image.naturalWidth, image.naturalHeight);
    setDimensions({ width: image.naturalWidth, height: image.naturalHeight, size });
    setOffset({
      left: (size - image.naturalWidth * fit) / 2,
      top: (size - image.naturalHeight * fit) / 2,
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(startCrop);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [startCrop]);

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dimensions.size) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: boundedOffset.left,
      top: boundedOffset.top,
    };
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const drag = dragRef.current;
    setOffset({ left: drag.left + event.clientX - drag.x, top: drag.top + event.clientY - drag.y });
  }

  function endDrag() {
    dragRef.current = null;
  }

  function applyCrop() {
    const image = imageRef.current;
    if (!image || !dimensions.size || !scale) return;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) return;
    const sourceX = -boundedOffset.left / scale;
    const sourceY = -boundedOffset.top / scale;
    const sourceSize = dimensions.size / scale;
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    canvas.toBlob(
      (blob) => {
        if (blob) onComplete(blob);
      },
      'image/jpeg',
      0.84,
    );
  }

  return (
    <div
      className="avatar-crop-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="avatar-crop-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
      >
        <h3 id="avatar-crop-title">{title}</h3>
        <p className="avatar-crop-help">{help}</p>
        <div
          ref={viewportRef}
          className={`avatar-crop-viewport${dimensions.size ? ' ready' : ''}`}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <img
            ref={imageRef}
            alt=""
            draggable={false}
            onLoad={startCrop}
            style={
              dimensions.size
                ? {
                    width: imageWidth,
                    height: imageHeight,
                    left: boundedOffset.left,
                    top: boundedOffset.top,
                  }
                : undefined
            }
          />
          <span className="avatar-crop-guide" aria-hidden="true" />
        </div>
        <label className="avatar-crop-zoom">
          {zoomLabel}
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        <div className="avatar-crop-actions">
          <button type="button" className="button ghost" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="button primary"
            disabled={busy || !dimensions.size}
            onClick={applyCrop}
          >
            {useImageLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
