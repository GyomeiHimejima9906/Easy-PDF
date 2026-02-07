import React, { useEffect, useRef, useState } from 'react';
import { AnnotationLayer } from './AnnotationLayer';
import { Annotation } from '../types';

interface PDFPageProps {
  pdfDoc: any;
  pageNumber: number; // Original PDF page index (1-based)
  visualIndex: number; // Current visual index in the editor (0-based)
  rotation: number;
  scale: number;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  onMouseDown: (e: React.MouseEvent, pageIndex: number, coords: { x: number, y: number }, targetId?: string, type?: 'move' | 'resize', handle?: string) => void;
  onMouseMove: (e: React.MouseEvent, pageIndex: number, coords: { x: number, y: number }) => void;
  onAnnotationChange: (id: string, newProps: Partial<Annotation>) => void;
  isToolActive: boolean;
}

export const PDFPage: React.FC<PDFPageProps> = ({
  pdfDoc,
  pageNumber,
  visualIndex,
  rotation,
  scale,
  annotations,
  selectedAnnotationId,
  onMouseDown,
  onMouseMove,
  onAnnotationChange,
  isToolActive
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Render Page (Canvas + Text Layer)
  useEffect(() => {
    let isCancelled = false;

    const render = async () => {
      if (!pdfDoc || !canvasRef.current || !textLayerRef.current) return;

      try {
        const page = await pdfDoc.getPage(pageNumber);
        
        if (isCancelled) return;

        const viewport = page.getViewport({ scale, rotation });

        setDimensions({ width: viewport.width, height: viewport.height });

        // 1. Render Canvas
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        
        await page.render(renderContext).promise;
        
        if (isCancelled) return;

        // 2. Render Text Layer (allows text selection)
        if (textLayerRef.current) {
          const textContent = await page.getTextContent();
          
          if (isCancelled || !textLayerRef.current) return; 

          textLayerRef.current.innerHTML = ''; 
          
          if (window.pdfjsLib) {
             window.pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayerRef.current,
                viewport: viewport,
                textDivs: []
             });
          }
        }

      } catch (err) {
        if (!isCancelled) {
          console.error(`Error rendering page ${pageNumber}`, err);
        }
      }
    };

    render();

    return () => { isCancelled = true; };
  }, [pdfDoc, pageNumber, rotation, scale]);

  // Handle local coordinates
  const getLocalCoords = (e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    };
  };

  const handleMouseDownWrapper = (e: React.MouseEvent, targetId?: string, type?: 'move' | 'resize', handle?: string) => {
    const coords = getLocalCoords(e);
    // CRITICAL FIX: Use visualIndex instead of pageNumber derived index
    onMouseDown(e, visualIndex, coords, targetId, type, handle);
  };

  const handleMouseMoveWrapper = (e: React.MouseEvent) => {
    const coords = getLocalCoords(e);
    // CRITICAL FIX: Use visualIndex instead of pageNumber derived index
    onMouseMove(e, visualIndex, coords);
  };

  return (
    <div 
      ref={containerRef}
      className="relative mb-8 shadow-2xl transition-all bg-white mx-auto"
      style={{ width: dimensions.width || 'auto', height: dimensions.height || 'auto' }}
      onMouseMove={handleMouseMoveWrapper}
    >
      {/* 1. Canvas Layer (Bottom) */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* 2. Text Layer (Middle - for selection) */}
      <div 
        ref={textLayerRef} 
        className="textLayer absolute inset-0 leading-none z-10 mix-blend-multiply"
        style={{ '--scale-factor': scale } as React.CSSProperties}
      />

      {/* 3. Interaction Layer (Create New) */}
      {isToolActive && (
        <div 
          className="absolute inset-0 z-20 cursor-crosshair"
          onMouseDown={(e) => handleMouseDownWrapper(e)}
        />
      )}

      {/* 4. Annotation Layer (Top) */}
      <div className="absolute inset-0 z-30 pointer-events-none">
          <AnnotationLayer 
            annotations={annotations} 
            pageIndex={visualIndex} // CRITICAL FIX: Pass visual index so filter matches
            selectedId={selectedAnnotationId}
            onMouseDown={handleMouseDownWrapper}
            onChange={onAnnotationChange}
          />
      </div>
    </div>
  );
};