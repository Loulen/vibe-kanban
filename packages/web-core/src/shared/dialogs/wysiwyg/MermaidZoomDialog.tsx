import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@vibe/ui/components/KeyboardDialog';
import { Button } from '@vibe/ui/components/Button';
import { create, useModal } from '@ebay/nice-modal-react';
import { defineModal } from '@/shared/lib/modals';
import { renderMermaidToSvg } from '@vibe/ui/lib/mermaid';
import { writeClipboardViaBridge } from '@/shared/lib/clipboard';
import { Check, ClipboardCopy, Image } from 'lucide-react';

const MIN_SCALE = 0.02;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.2;

type Transform = {
  scale: number;
  x: number;
  y: number;
};

export interface MermaidZoomDialogProps {
  code: string;
}

const MermaidZoomDialogImpl = create<MermaidZoomDialogProps>((props) => {
  const modal = useModal();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transform, setTransform] = useState<Transform>({
    scale: 1,
    x: 0,
    y: 0,
  });

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTransform: Transform;
  } | null>(null);
  const initialTransformRef = useRef<Transform>({ scale: 1, x: 0, y: 0 });

  const handleClose = useCallback(() => {
    modal.hide();
  }, [modal]);

  useEffect(() => {
    let isMounted = true;
    setSvg(null);
    setError(null);

    renderMermaidToSvg(props.code)
      .then((nextSvg) => {
        if (!isMounted) return;
        setSvg(nextSvg);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : String(err ?? '');
        setError(message || 'Unable to render Mermaid diagram');
      });

    return () => {
      isMounted = false;
    };
  }, [props.code]);

  const applyFitToViewport = useCallback((): boolean => {
    const viewport = viewportRef.current;
    if (!viewport) return false;

    const svgElement = viewport.querySelector('svg');
    if (!svgElement) return false;

    const viewportRect = viewport.getBoundingClientRect();
    const contentBox = svgElement.getBBox();
    const hasContentBox = contentBox.width > 0 && contentBox.height > 0;

    const svgRect = svgElement.getBoundingClientRect();
    const fallbackWidth = svgRect.width;
    const fallbackHeight = svgRect.height;

    const diagramWidth = hasContentBox ? contentBox.width : fallbackWidth;
    const diagramHeight = hasContentBox ? contentBox.height : fallbackHeight;
    const diagramMinX = hasContentBox ? contentBox.x : 0;
    const diagramMinY = hasContentBox ? contentBox.y : 0;

    if (
      !diagramWidth ||
      !diagramHeight ||
      !viewportRect.width ||
      !viewportRect.height
    ) {
      return false;
    }

    const padding = 16;
    const scaleX = (viewportRect.width - padding * 2) / diagramWidth;
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scaleX));

    const x = padding - diagramMinX * scale;
    const renderedHeight = diagramHeight * scale;
    const y =
      renderedHeight <= viewportRect.height - padding * 2
        ? (viewportRect.height - renderedHeight) / 2 - diagramMinY * scale
        : padding - diagramMinY * scale;

    const nextTransform = { scale, x, y };
    initialTransformRef.current = nextTransform;
    setTransform(nextTransform);
    return true;
  }, []);

  useEffect(() => {
    if (!svg || !modal.visible) return;

    let frameId = 0;
    setTransform({ scale: 1, x: 0, y: 0 });

    const tryFit = () => {
      const didFit = applyFitToViewport();
      if (didFit) return;
      frameId = window.requestAnimationFrame(tryFit);
    };

    frameId = window.requestAnimationFrame(tryFit);
    return () => window.cancelAnimationFrame(frameId);
  }, [svg, modal.visible, applyFitToViewport]);

  useEffect(() => {
    const onResize = () => {
      applyFitToViewport();
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [applyFitToViewport]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const blockBrowserWheelDefault = (event: WheelEvent) => {
      event.preventDefault();
    };

    viewport.addEventListener('wheel', blockBrowserWheelDefault, {
      passive: false,
    });

    return () => {
      viewport.removeEventListener('wheel', blockBrowserWheelDefault);
    };
  }, []);

  const zoomAtPoint = useCallback(
    (factor: number, pointX: number, pointY: number) => {
      setTransform((current) => {
        const nextScale = Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, current.scale * factor)
        );

        if (nextScale === current.scale) return current;

        const worldX = (pointX - current.x) / current.scale;
        const worldY = (pointY - current.y) / current.scale;

        return {
          scale: nextScale,
          x: pointX - worldX * nextScale,
          y: pointY - worldY * nextScale,
        };
      });
    },
    []
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.stopPropagation();

      const viewport = viewportRef.current;
      if (!viewport) return;

      const rect = viewport.getBoundingClientRect();
      const pointX = event.clientX - rect.left;
      const pointY = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;

      zoomAtPoint(factor, pointX, pointY);
    },
    [zoomAtPoint]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      viewport.setPointerCapture(event.pointerId);
      panRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTransform: transform,
      };
    },
    [transform]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const activePan = panRef.current;
      if (!activePan || activePan.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - activePan.startX;
      const deltaY = event.clientY - activePan.startY;

      setTransform({
        ...activePan.startTransform,
        x: activePan.startTransform.x + deltaX,
        y: activePan.startTransform.y + deltaY,
      });
    },
    []
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const activePan = panRef.current;
      if (!activePan || activePan.pointerId !== event.pointerId) return;

      panRef.current = null;
    },
    []
  );

  const handleZoomIn = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    zoomAtPoint(ZOOM_STEP, viewport.clientWidth / 2, viewport.clientHeight / 2);
  }, [zoomAtPoint]);

  const handleZoomOut = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    zoomAtPoint(
      1 / ZOOM_STEP,
      viewport.clientWidth / 2,
      viewport.clientHeight / 2
    );
  }, [zoomAtPoint]);

  const handleReset = useCallback(() => {
    setTransform(initialTransformRef.current);
  }, []);

  const [codeCopied, setCodeCopied] = useState(false);
  const [pngCopied, setPngCopied] = useState(false);

  const handleCopyCode = useCallback(async () => {
    await writeClipboardViaBridge(props.code);
    setCodeCopied(true);
    window.setTimeout(() => setCodeCopied(false), 1500);
  }, [props.code]);

  const handleCopyPng = useCallback(async () => {
    if (!svg) return;

    const svgEl = viewportRef.current?.querySelector('svg');
    if (!svgEl) return;

    const bbox = svgEl.getBBox();
    const width = bbox.width > 0 ? bbox.width : svgEl.clientWidth;
    const height = bbox.height > 0 ? bbox.height : svgEl.clientHeight;
    const dpr = 2;

    const canvas = document.createElement('canvas');
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    const svgClone = svgEl.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute('width', String(width));
    svgClone.setAttribute('height', String(height));
    svgClone.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${width} ${height}`);

    const svgData = new XMLSerializer().serializeToString(svgClone);
    // Use a data URL instead of a blob URL to avoid tainting the canvas
    const dataUrl =
      'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);

    const img = new window.Image();
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(async (pngBlob) => {
        if (!pngBlob) return;

        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob }),
          ]);
          setPngCopied(true);
          window.setTimeout(() => setPngCopied(false), 1500);
        } catch {
          // Fallback: download the PNG
          const a = document.createElement('a');
          a.href = URL.createObjectURL(pngBlob);
          a.download = 'mermaid-diagram.png';
          a.click();
          URL.revokeObjectURL(a.href);
          setPngCopied(true);
          window.setTimeout(() => setPngCopied(false), 1500);
        }
      }, 'image/png');
    };
    img.src = dataUrl;
  }, [svg]);

  const transformStyle = useMemo(
    () => ({
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
      transformOrigin: '0 0',
    }),
    [transform]
  );

  return (
    <Dialog
      open={modal.visible}
      onOpenChange={handleClose}
      fixedViewport
      className="max-w-none w-full h-full my-0 p-0 gap-0 overflow-hidden"
      style={{
        width: '98vw',
        maxWidth: '98vw',
        height: '95vh',
        maxHeight: '95vh',
      }}
    >
      <DialogContent className="flex h-full w-full flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>Mermaid diagram</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Zoom in"
            onClick={handleZoomIn}
          >
            +
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Zoom out"
            onClick={handleZoomOut}
          >
            -
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Reset zoom"
            onClick={handleReset}
          >
            Reset
          </Button>
          <p className="text-xs text-muted-foreground ml-2">
            {Math.round(transform.scale * 100)}%
          </p>

          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Copy Mermaid code"
              onClick={handleCopyCode}
            >
              {codeCopied ? (
                <Check className="size-3.5 text-green-500" />
              ) : (
                <ClipboardCopy className="size-3.5" />
              )}
              <span className="ml-1.5">
                {codeCopied ? 'Copied!' : 'Copy code'}
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Copy as PNG"
              disabled={!svg}
              onClick={handleCopyPng}
            >
              {pngCopied ? (
                <Check className="size-3.5 text-green-500" />
              ) : (
                <Image className="size-3.5" />
              )}
              <span className="ml-1.5">
                {pngCopied ? 'Copied!' : 'Copy PNG'}
              </span>
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 space-y-3 overflow-auto border-b">
            <p className="text-sm font-medium text-error">
              Unable to render Mermaid diagram
            </p>
            <pre className="rounded bg-error/10 p-3 text-xs text-error overflow-auto max-h-24 whitespace-pre-wrap">
              {error}
            </pre>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">
                Show source code
              </summary>
              <pre className="mt-2 rounded bg-secondary p-3 overflow-auto max-h-48 whitespace-pre-wrap">
                {props.code}
              </pre>
            </details>
          </div>
        )}

        <div
          ref={viewportRef}
          className="relative min-h-0 flex-1 overflow-hidden bg-secondary cursor-grab active:cursor-grabbing touch-none overscroll-none"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {!error && !svg && (
            <p className="p-4 text-xs text-muted-foreground">
              Rendering Mermaid diagram...
            </p>
          )}
          {svg && (
            <div
              className="absolute left-0 top-0 w-full"
              style={transformStyle}
            >
              <div
                className="w-full select-none [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-none [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

export const MermaidZoomDialog = defineModal<MermaidZoomDialogProps, void>(
  MermaidZoomDialogImpl
);
