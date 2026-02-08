import React from 'react';
import { Annotation } from '../types';

interface AnnotationLayerProps {
  annotations: Annotation[];
  pageIndex: number;
  selectedId: string | null;
  onMouseDown: (e: React.MouseEvent, id: string, type: 'move' | 'resize', handle?: string) => void;
  onChange: (id: string, newProps: Partial<Annotation>) => void;
}

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({ 
  annotations, 
  pageIndex, 
  selectedId, 
  onMouseDown,
  onChange 
}) => {
  const pageAnnotations = annotations.filter(a => a.pageIndex === pageIndex);

  // Resize Handles Component
  const ResizeHandles = ({ id }: { id: string }) => (
    <>
      {['nw', 'ne', 'sw', 'se'].map((handle) => (
        <div
          key={handle}
          className={`absolute w-3 h-3 bg-white border border-brand-blue rounded-full z-50 cursor-${handle}-resize`}
          style={{
            top: handle.includes('n') ? '-6px' : 'auto',
            bottom: handle.includes('s') ? '-6px' : 'auto',
            left: handle.includes('w') ? '-6px' : 'auto',
            right: handle.includes('e') ? '-6px' : 'auto',
          }}
          onMouseDown={(e) => onMouseDown(e, id, 'resize', handle)}
        />
      ))}
    </>
  );

  return (
    <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
      {/* SVG Layer for Freehand Drawing */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {pageAnnotations.filter(a => a.type === 'freehand').map(ann => (
           <path
             key={ann.id}
             d={`M ${ann.points?.map(p => `${p.x} ${p.y}`).join(' L ')}`}
             stroke={ann.color}
             strokeWidth={ann.strokeWidth ? ann.strokeWidth / 10 : 0.4} // Scale visual stroke
             fill="none"
             strokeLinecap="round"
             strokeLinejoin="round"
             opacity={ann.opacity || 1}
             vectorEffect="non-scaling-stroke"
             className={`pointer-events-auto cursor-pointer hover:opacity-80 transition-opacity ${selectedId === ann.id ? 'filter drop-shadow-[0_0_2px_rgba(59,130,246,0.8)]' : ''}`}
             onMouseDown={(e) => onMouseDown(e, ann.id, 'move')}
           />
        ))}
      </svg>

      {/* HTML Layer for Shapes, Images and Text */}
      {pageAnnotations.map((ann) => {
        if (ann.type === 'freehand') return null;

        const isSelected = selectedId === ann.id;
        const baseStyle: React.CSSProperties = {
          left: `${ann.x}%`,
          top: `${ann.y}%`,
          width: `${ann.width}%`,
          height: `${ann.height}%`,
          position: 'absolute',
        };

        // Common selection outline
        const selectionRing = isSelected ? 'ring-1 ring-brand-blue ring-offset-1 ring-offset-transparent shadow-xl' : '';

        // --- IMAGE ANNOTATION ---
        if (ann.type === 'image' && ann.imageData) {
          return (
            <div
              key={ann.id}
              className={`pointer-events-auto group cursor-move ${selectionRing}`}
              style={baseStyle}
              onMouseDown={(e) => onMouseDown(e, ann.id, 'move')}
            >
              <img 
                src={ann.imageData} 
                alt="annotation" 
                className="w-full h-full object-contain pointer-events-none select-none"
              />
              {isSelected && <ResizeHandles id={ann.id} />}
            </div>
          );
        }

        // --- RECTANGLE / WHITEOUT ---
        if (ann.type === 'rect') {
          return (
            <div
              key={ann.id}
              className={`pointer-events-auto group cursor-move ${selectionRing}`}
              style={{
                ...baseStyle,
                borderColor: ann.color,
                borderWidth: ann.fill ? 0 : `${ann.strokeWidth || 2}px`, // No border if filled (Whiteout)
                borderStyle: 'solid',
                backgroundColor: ann.fill ? ann.fill : 'transparent'
              }}
              onMouseDown={(e) => onMouseDown(e, ann.id, 'move')}
            >
              {isSelected && <ResizeHandles id={ann.id} />}
            </div>
          );
        }

        // --- HIGHLIGHT ---
        if (ann.type === 'highlight') {
          return (
            <div
              key={ann.id}
              className={`pointer-events-auto group cursor-move mix-blend-multiply ${selectionRing}`}
              style={{
                ...baseStyle,
                backgroundColor: ann.color,
                opacity: ann.opacity || 0.4
              }}
              onMouseDown={(e) => onMouseDown(e, ann.id, 'move')}
            >
              {isSelected && <ResizeHandles id={ann.id} />}
            </div>
          );
        }

        // --- OCR TEXT (Invisible Layer) ---
        if (ann.type === 'ocr_text') {
           return (
             <div
                key={ann.id}
                className="absolute flex items-center justify-center leading-none overflow-hidden select-text pointer-events-auto"
                style={{
                    ...baseStyle,
                    fontSize: `${ann.fontSize}px`,
                    color: 'transparent',
                    userSelect: 'text',
                    cursor: 'text',
                    whiteSpace: 'nowrap'
                }}
                title={ann.content}
             >
                <span className="bg-brand-blue/20 text-transparent selection:bg-brand-blue/30 selection:text-brand-blue w-full h-full block">
                    {ann.content}
                </span>
             </div>
           );
        }

        // --- TEXT ---
        if (ann.type === 'text') {
          return (
            <div
              key={ann.id}
              className={`pointer-events-auto group flex items-start ${selectionRing} ${isSelected ? 'cursor-move bg-white' : 'cursor-move'}`}
              style={{
                ...baseStyle,
                fontSize: `${ann.fontSize || 16}px`,
                width: ann.width ? `${ann.width}%` : 'auto',
                height: ann.height ? `${ann.height}%` : 'auto',
                minWidth: '20px',
                minHeight: '20px',
                padding: isSelected ? '8px' : '0px',
              }}
              onMouseDown={(e) => onMouseDown(e, ann.id, 'move')}
            >
              {isSelected ? (
                <>
                  <textarea
                    autoFocus
                    value={ann.content}
                    onChange={(e) => onChange(ann.id, { content: e.target.value })}
                    className="w-full h-full bg-transparent text-black p-0 resize-none outline-none border-none overflow-hidden leading-tight"
                    style={{ 
                      color: '#000000',
                      fontSize: `${ann.fontSize || 16}px`,
                      cursor: 'text'
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  <ResizeHandles id={ann.id} />
                </>
              ) : (
                <div 
                  className="whitespace-pre-wrap leading-tight w-full h-full overflow-hidden"
                  style={{ color: ann.color, fontSize: `${ann.fontSize || 16}px` }}
                >
                  {ann.content || "Double click to edit"}
                </div>
              )}
            </div>
          );
        }

        // --- COMMENT ---
        if (ann.type === 'comment') {
           return (
             <div
               key={ann.id}
               className={`pointer-events-auto group cursor-move absolute ${isSelected ? 'z-50' : 'z-20'}`}
               style={{
                 left: `${ann.x}%`,
                 top: `${ann.y}%`,
               }}
               onMouseDown={(e) => onMouseDown(e, ann.id, 'move')}
             >
               <div 
                 className={`w-8 h-8 rounded-bl-none rounded-full shadow-lg flex items-center justify-center border-2 border-stone-800 transition-transform ${isSelected ? 'scale-110 ring-2 ring-white' : 'hover:scale-110'}`}
                 style={{ backgroundColor: ann.color }}
               >
                   <span className="text-xs font-bold text-stone-900">!</span>
               </div>
               
               {isSelected && (
                  <div className="absolute top-8 left-0 w-64 bg-stone-800 border border-stone-600 rounded shadow-2xl z-50 p-1" onMouseDown={(e) => e.stopPropagation()}>
                     <textarea
                       autoFocus
                       value={ann.content}
                       onChange={(e) => onChange(ann.id, { content: e.target.value })}
                       className="w-full bg-stone-900 border border-stone-700 p-2 rounded text-xs text-stone-200 outline-none focus:border-brand-blue"
                       rows={4}
                       placeholder="Enter comment..."
                     />
                  </div>
               )}
             </div>
           );
        }

        return null;
      })}
    </div>
  );
};