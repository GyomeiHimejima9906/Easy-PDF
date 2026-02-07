import React, { useEffect, useRef } from 'react';

interface PageThumbnailProps {
  pdfDoc: any;
  pageNumber: number;
  rotation: number;
  onClick: () => void;
  isSelected: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export const PageThumbnail: React.FC<PageThumbnailProps> = ({ 
  pdfDoc, 
  pageNumber, 
  rotation, 
  onClick, 
  isSelected,
  onDragStart,
  onDragOver,
  onDrop
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let active = true;
    const renderThumb = async () => {
      if (!pdfDoc || !canvasRef.current) return;
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 0.3, rotation });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (active) {
            await page.render({ canvasContext: context, viewport }).promise;
        }
      } catch (err) {
        console.error("Error rendering thumbnail", err);
      }
    };
    renderThumb();
    return () => { active = false; };
  }, [pdfDoc, pageNumber, rotation]);

  return (
    <div 
      className={`
        relative group cursor-pointer transition-all duration-200
        ${isSelected ? 'ring-2 ring-brand-yellow scale-105 shadow-xl shadow-black/40' : 'hover:scale-105 hover:shadow-lg hover:shadow-black/20'}
      `}
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
        <div className="bg-stone-800 p-2 rounded-lg shadow-sm border border-white/5">
            <canvas ref={canvasRef} className="rounded-sm max-w-full h-auto mx-auto bg-white" />
        </div>
        <div className="mt-2 text-center text-xs font-medium text-stone-500 group-hover:text-stone-300 transition-colors">
            Page {pageNumber}
        </div>
    </div>
  );
};