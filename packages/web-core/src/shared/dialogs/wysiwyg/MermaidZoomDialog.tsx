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
      .catch(() => {
        if (!isMounted) return;
        setError('Unable to render Mermaid diagram');
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
        </div>

        <div
          ref={viewportRef}
          className="relative min-h-0 flex-1 overflow-hidden bg-secondary cursor-grab active:cursor-grabbing touch-none overscroll-none"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {error && <p className="p-4 text-xs text-error">{error}</p>}
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
