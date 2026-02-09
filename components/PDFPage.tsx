
import React, { useEffect, useRef, useState } from 'react';
import { AnnotationLayer } from './AnnotationLayer';
import { Annotation } from '../types';

interface PDFPageProps {
  pdfDoc: any;
  pageNumber: number;
  visualIndex: number;
  rotation: number;
  scale: number;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  onMouseDown: (e: React.MouseEvent | React.TouchEvent, pageIndex: number, coords: { x: number, y: number }, targetId?: string, type?: 'move' | 'resize', handle?: string) => void;
  onMouseMove: (e: React.MouseEvent | React.TouchEvent, pageIndex: number, coords: { x: number, y: number }) => void;
  onAnnotationChange: (id: string, newProps: Partial<Annotation>) => void;
  isToolActive: boolean;
  isHighContrast?: boolean;
  isTTSActive?: boolean;
  onTextClick?: (text: string) => void;
  onEmptyPageFound?: () => void;
}

interface TextBlock {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PDFPage: React.FC<PDFPageProps> = ({
  pdfDoc, pageNumber, visualIndex, rotation, scale,
  annotations, selectedAnnotationId, onMouseDown, onMouseMove,
  onAnnotationChange, isToolActive, isHighContrast = false,
  isTTSActive = false, onTextClick, onEmptyPageFound
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [paragraphBlocks, setParagraphBlocks] = useState<TextBlock[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);

  // Intersection Observer to detect visibility
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { rootMargin: '600px 0px', threshold: 0.01 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Pre-fetch basic dimensions if not yet visible (to maintain scroll height)
  useEffect(() => {
    if (!pdfDoc) return;
    const fetchDim = async () => {
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale, rotation });
      setDimensions({ width: viewport.width, height: viewport.height });
    };
    fetchDim();
  }, [pdfDoc, pageNumber, rotation, scale]);

  // Main Render Logic - only when visible
  useEffect(() => {
    if (!isVisible || !pdfDoc || !canvasRef.current) {
      if (!isVisible) setIsRendered(false);
      return;
    }

    let renderTask: any = null;
    let isCancelled = false;

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (isCancelled) return;
        const viewport = page.getViewport({ scale, rotation });
        
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d');
        if (!context) return;
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
        
        if (isCancelled) return;

        const textContent = await page.getTextContent();
        if (textContent.items.length === 0 && onEmptyPageFound) onEmptyPageFound();
        
        if (isCancelled) return;

        setIsRendered(true);

        if (textLayerRef.current && window.pdfjsLib) {
          textLayerRef.current.innerHTML = ''; 
          window.pdfjsLib.renderTextLayer({
            textContentSource: textContent,
            container: textLayerRef.current,
            viewport,
            textDivs: []
          });
        }
      } catch (err) {
        if (!isCancelled) console.error("Render failed", err);
      }
    };

    render();
    return () => { isCancelled = true; if (renderTask) renderTask.cancel(); };
  }, [isVisible, pdfDoc, pageNumber, rotation, scale]);

  const getLocalCoords = (e: any) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Ensure we are strictly within 0-100% relative to the visual element width/height
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
    };
  };

  const style: React.CSSProperties = {
    width: dimensions.width || '100%',
    height: dimensions.height || '800px',
  };

  return (
    <div 
      ref={containerRef}
      className={`relative mb-8 transition-all mx-auto overflow-hidden ${isHighContrast ? 'bg-stone-900' : 'bg-white'} ${!isRendered ? 'animate-pulse bg-stone-800/20' : 'shadow-2xl'}`}
      style={style}
      onMouseMove={(e) => isRendered && onMouseMove(e, visualIndex, getLocalCoords(e))}
      onTouchMove={(e) => isRendered && onMouseMove(e, visualIndex, getLocalCoords(e))}
    >
      {!isRendered && (
        <div className="absolute inset-0 flex items-center justify-center text-stone-500 font-bold text-4xl opacity-20">
          PAGE {pageNumber}
        </div>
      )}
      
      {isVisible && (
        <>
          <canvas 
            ref={canvasRef} 
            className="absolute inset-0 pointer-events-none z-0 transition-opacity duration-500" 
            style={{ opacity: isRendered ? 1 : 0, filter: isHighContrast ? 'invert(1) hue-rotate(180deg)' : 'none' }}
          />
          <div 
            ref={textLayerRef} 
            className={`textLayer absolute inset-0 z-10 ${isHighContrast ? 'mix-blend-screen' : 'mix-blend-multiply'}`}
            style={{ 
                filter: isHighContrast ? 'invert(1) hue-rotate(180deg)' : 'none', 
                pointerEvents: isTTSActive ? 'none' : 'auto',
                '--scale-factor': scale
            } as React.CSSProperties}
          />
          {isToolActive && !isTTSActive && (
            <div 
              className="absolute inset-0 z-20 cursor-crosshair touch-none"
              style={{ touchAction: 'none' }}
              onMouseDown={(e) => onMouseDown(e, visualIndex, getLocalCoords(e))}
              onTouchStart={(e) => onMouseDown(e, visualIndex, getLocalCoords(e))}
            />
          )}
          <div className="absolute inset-0 z-30 pointer-events-none" style={{ filter: isHighContrast ? 'invert(1) hue-rotate(180deg)' : 'none' }}>
            <AnnotationLayer 
              annotations={annotations} pageIndex={visualIndex} selectedId={selectedAnnotationId}
              scale={scale} // PASSING SCALE
              onMouseDown={(e, id, type, handle) => onMouseDown(e, visualIndex, getLocalCoords(e), id, type, handle)}
              onChange={onAnnotationChange} onTextClick={onTextClick} isTTSActive={isTTSActive}
            />
          </div>
        </>
      )}
    </div>
  );
};
