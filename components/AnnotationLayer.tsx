
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Annotation } from '../types';
import { Bold, Italic, Heading1, Heading2, List, Quote, Palette, Check, Plus, X, ArrowDown, AlignVerticalSpaceAround } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface AnnotationLayerProps {
  annotations: Annotation[];
  pageIndex: number;
  selectedId: string | null;
  scale: number; // Received scale factor
  onMouseDown: (e: React.MouseEvent | React.TouchEvent, id: string, type: 'move' | 'resize', handle?: string) => void;
  onChange: (id: string, newProps: Partial<Annotation>) => void;
  onTextClick?: (text: string) => void;
  isTTSActive?: boolean;
}

interface AnnotationItemProps {
    ann: Annotation;
    isSelected: boolean;
    onChange: (id: string, newProps: Partial<Annotation>) => void;
    onMouseDown: (e: React.MouseEvent | React.TouchEvent, id: string, type: 'move' | 'resize', handle?: string) => void;
    handleStart: (e: React.MouseEvent | React.TouchEvent, id: string, type: 'move' | 'resize', handle?: string) => void;
    scale: number;
}

// --- RICH TEXT EDITOR COMPONENT ---
const RichTextAnnotation: React.FC<AnnotationItemProps> = ({ 
    ann, isSelected, onChange, onMouseDown, handleStart, scale 
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const { t } = useLanguage();

    useEffect(() => {
        if (editorRef.current) {
            if (!isSelected && editorRef.current.innerHTML !== (ann.content || '')) {
                editorRef.current.innerHTML = ann.content || '';
            }
        }
    }, [ann.content, isSelected]);

    useEffect(() => {
        if (editorRef.current && !editorRef.current.innerHTML && ann.content) {
            editorRef.current.innerHTML = ann.content;
        }
    }, []);

    const execCmd = (command: string, value: string | undefined = undefined) => {
        if (editorRef.current) editorRef.current.focus();
        document.execCommand(command, false, value);
        if (editorRef.current) {
            onChange(ann.id, { content: editorRef.current.innerHTML });
        }
    };

    const handleInput = () => {
        if (editorRef.current) {
            onChange(ann.id, { content: editorRef.current.innerHTML });
        }
    };

    const toggleVertical = () => {
        onChange(ann.id, { vertical: !ann.vertical });
    };

    return (
        <div
            className={`pointer-events-auto group absolute flex flex-col p-2 ${isSelected ? 'z-50 ring-1 ring-brand-blue shadow-xl cursor-move' : 'z-20 cursor-pointer'}`}
            style={{
                left: `${ann.x}%`,
                top: `${ann.y}%`,
                width: `${ann.width}%`,
                height: `${ann.height}%`,
                backgroundColor: ann.fill || 'transparent',
            }}
            onMouseDown={(e) => handleStart(e, ann.id, 'move')}
            onTouchStart={(e) => handleStart(e, ann.id, 'move')}
        >
            <style>{`
                .rich-text-content h1 { font-size: 1.8em; font-weight: bold; margin: 0.5em 0; line-height: 1.2; }
                .rich-text-content h2 { font-size: 1.4em; font-weight: bold; margin: 0.4em 0; line-height: 1.2; }
                .rich-text-content ul { list-style-type: disc; margin-left: 1.2em; padding-left: 0; }
                .rich-text-content ol { list-style-type: decimal; margin-left: 1.2em; padding-left: 0; }
                .rich-text-content li { margin-bottom: 0.2em; }
                .rich-text-content blockquote { border-left: 3px solid rgba(255,255,255,0.3); padding-left: 0.5em; opacity: 0.8; font-style: italic; }
            `}</style>

            {isSelected && (
                <div 
                    className="absolute -top-10 left-0 bg-stone-800 border border-white/20 rounded-lg flex items-center gap-1 p-1 shadow-lg z-[60] cursor-default"
                    onMouseDown={(e) => e.stopPropagation()} 
                >
                    <button onClick={() => execCmd('bold')} className="p-1 hover:bg-white/10 rounded text-stone-300" title="Bold"><Bold size={14}/></button>
                    <button onClick={() => execCmd('italic')} className="p-1 hover:bg-white/10 rounded text-stone-300" title="Italic"><Italic size={14}/></button>
                    <button onClick={() => execCmd('formatBlock', 'H1')} className="p-1 hover:bg-white/10 rounded text-stone-300" title="H1"><Heading1 size={14}/></button>
                    <button onClick={() => execCmd('formatBlock', 'H2')} className="p-1 hover:bg-white/10 rounded text-stone-300" title="H2"><Heading2 size={14}/></button>
                    <button onClick={() => execCmd('insertUnorderedList')} className="p-1 hover:bg-white/10 rounded text-stone-300" title="List"><List size={14}/></button>
                    <button onClick={() => execCmd('formatBlock', 'BLOCKQUOTE')} className="p-1 hover:bg-white/10 rounded text-stone-300" title="Quote"><Quote size={14}/></button>
                    <div className="w-[1px] h-4 bg-white/20 mx-1"></div>
                    <button onClick={toggleVertical} className={`p-1 rounded text-stone-300 ${ann.vertical ? 'bg-brand-blue/30 text-brand-blue' : 'hover:bg-white/10'}`} title={t('verticalCJK')}>
                        <ArrowDown size={14}/>
                    </button>
                    <div className="w-[1px] h-4 bg-white/20 mx-1"></div>
                    <label className="p-1 hover:bg-white/10 rounded text-stone-300 cursor-pointer flex items-center">
                        <Palette size={14} style={{ color: ann.color }}/>
                        <input 
                            type="color" 
                            className="hidden" 
                            onChange={(e) => execCmd('foreColor', e.target.value)}
                        />
                    </label>
                </div>
            )}

            <div
                ref={editorRef}
                contentEditable={isSelected}
                suppressContentEditableWarning
                onInput={handleInput}
                onBlur={handleInput} 
                className={`w-full h-full overflow-hidden outline-none text-left rich-text-content ${isSelected ? 'cursor-text' : 'cursor-pointer'}`}
                style={{
                    color: ann.color, 
                    fontSize: `${(ann.fontSize || 16) * scale}px`, // SCALE APPLIED
                    opacity: ann.opacity || 1,
                    writingMode: ann.vertical ? 'vertical-rl' : 'horizontal-tb',
                    textOrientation: ann.vertical ? 'upright' : 'mixed',
                    lineHeight: 1.2
                }}
                onMouseDown={(e) => {
                    if (isSelected) e.stopPropagation(); 
                }}
            />

            {isSelected && (
                <>
                    {['nw', 'ne', 'sw', 'se'].map((handle) => (
                        <div
                            key={handle}
                            className={`absolute w-3 h-3 bg-brand-blue border border-white rounded-full z-[60] cursor-${handle}-resize`}
                            style={{
                                top: handle.includes('n') ? '-5px' : 'auto',
                                bottom: handle.includes('s') ? '-5px' : 'auto',
                                left: handle.includes('w') ? '-5px' : 'auto',
                                right: handle.includes('e') ? '-5px' : 'auto',
                            }}
                            onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, ann.id, 'resize', handle); }}
                        />
                    ))}
                </>
            )}
        </div>
    );
};

// --- MATH / LATEX EDITOR COMPONENT ---
const MathAnnotation: React.FC<AnnotationItemProps> = ({ 
    ann, isSelected, onChange, onMouseDown, handleStart, scale 
}) => {
    const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
    const [showSymbols, setShowSymbols] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { t } = useLanguage();

    useEffect(() => {
        let active = true;
        const checkInterval = 200;
        const timeout = 3000;
        let elapsed = 0;

        const checkKaTeX = () => {
            if (!active) return;
            if (window.katex) {
                setStatus('ready');
                return;
            }
            elapsed += checkInterval;
            if (elapsed >= timeout) {
                setStatus('fallback');
            } else {
                setTimeout(checkKaTeX, checkInterval);
            }
        };

        const injectTimer = setTimeout(() => {
            if (!window.katex && !document.getElementById('katex-injected')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
                document.head.appendChild(link);

                const script = document.createElement('script');
                script.id = 'katex-injected';
                script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
                script.crossOrigin = 'anonymous';
                script.onload = () => { if (active) setStatus('ready'); };
                script.onerror = () => { if (active) setStatus('fallback'); };
                document.head.appendChild(script);
            }
        }, 500);

        checkKaTeX();
        return () => { active = false; clearTimeout(injectTimer); };
    }, []);

    const previewHTML = useMemo(() => {
        const content = ann.content || "";
        const cleanContent = content
            .replace(/^\$\$/, '')
            .replace(/\$\$$/, '')
            .replace(/^\$/, '')
            .replace(/\$$/, '');

        if (status === 'ready' && window.katex) {
            try {
                return window.katex.renderToString(cleanContent, { 
                    throwOnError: false, 
                    displayMode: true, 
                    output: 'html',
                    strict: false,
                    trust: true
                });
            } catch (e) {
                return `<div class="text-red-500 font-mono text-xs p-2">Error: ${(e as Error).message}</div>`;
            }
        }
        return null;
    }, [ann.content, status]);

    const renderPreview = () => {
        const color = ann.color || "#000000";

        if (status === 'ready' && previewHTML) {
             return <div dangerouslySetInnerHTML={{ __html: previewHTML }} />;
        } 
        
        if (status === 'fallback') {
            const colorHex = color.replace('#', '');
            const encoded = encodeURIComponent(`\\color[HTML]{${colorHex}} ${ann.content}`);
            return (
                <div className="flex items-center justify-center w-full h-full">
                     <img 
                        src={`https://latex.codecogs.com/svg.latex?${encoded}`} 
                        alt="Math" 
                        className="max-w-full max-h-full"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                     />
                </div>
            );
        }
        return <div className="animate-pulse bg-white/10 w-full h-8 rounded" />;
    };

    const insertSymbol = (symbol: string) => {
        const textarea = textareaRef.current;
        const currentContent = ann.content || "";
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newContent = currentContent.substring(0, start) + symbol + currentContent.substring(end);
            onChange(ann.id, { content: newContent });
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + symbol.length, start + symbol.length);
            }, 0);
        } else {
            onChange(ann.id, { content: currentContent + symbol });
        }
    };

    const commonSymbols = [
        { label: 'α', val: '\\alpha ' }, { label: 'β', val: '\\beta ' }, { label: 'π', val: '\\pi ' },
        { label: '√', val: '\\sqrt{}' }, { label: '∫', val: '\\int ' }, { label: '∑', val: '\\sum ' },
        { label: 'frac', val: '\\frac{a}{b} ' }, { label: 'x²', val: '^{2} ' }, { label: 'xₙ', val: '_{n} ' },
        { label: '≤', val: '\\leq ' }, { label: '≥', val: '\\geq ' }, { label: '≈', val: '\\approx ' },
        { label: '→', val: '\\rightarrow ' }, { label: '∞', val: '\\infty ' }, { label: '·', val: '\\cdot ' }
    ];

    return (
        <div
            // Added p-2 padding for drag handle area
            className={`pointer-events-auto group absolute flex flex-col p-2 ${isSelected ? 'z-50 ring-1 ring-brand-green shadow-xl cursor-move' : 'z-20 cursor-pointer'}`}
            style={{
                left: `${ann.x}%`,
                top: `${ann.y}%`,
                width: `${ann.width}%`,
                height: `${ann.height}%`,
                backgroundColor: ann.fill || 'transparent',
            }}
            onMouseDown={(e) => handleStart(e, ann.id, 'move')}
            onTouchStart={(e) => handleStart(e, ann.id, 'move')}
        >
            <div 
                className={`w-full h-full overflow-hidden flex items-center justify-center select-none ${isSelected ? 'cursor-pointer' : ''}`}
                style={{ 
                    color: ann.color, 
                    fontSize: `${(ann.fontSize || 16) * scale}px` // SCALE APPLIED
                }}
            >
                {renderPreview()}
            </div>

            {isSelected && (
                <div 
                    className="absolute top-[102%] left-0 w-full min-w-[200px] border border-brand-green bg-stone-900 shadow-2xl z-[100] rounded-md flex flex-col cursor-default"
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                >
                    <div className="bg-brand-green/20 px-2 py-1 text-[10px] text-brand-green font-bold uppercase tracking-wider flex justify-between items-center rounded-t-md">
                        <span className="flex items-center gap-2">
                            {t('latexEditor')} 
                            <button 
                                onClick={() => setShowSymbols(!showSymbols)}
                                className={`p-0.5 rounded ${showSymbols ? 'bg-yellow-500 text-stone-900' : 'text-yellow-400 hover:bg-white/10'}`}
                                title={t('insertSymbols')}
                            >
                                {showSymbols ? <X size={12}/> : <Plus size={12}/>}
                            </button>
                        </span>
                        {status === 'ready' && <span className="text-green-400">● LOCAL</span>}
                        {status === 'fallback' && <span className="text-yellow-400">● REMOTE</span>}
                        {status === 'loading' && <span className="text-stone-400 animate-pulse">● LOAD</span>}
                    </div>

                    {showSymbols && (
                        <div className="bg-stone-800 p-1 grid grid-cols-5 gap-1 border-b border-white/10">
                            {commonSymbols.map((sym) => (
                                <button
                                    key={sym.label}
                                    onClick={() => insertSymbol(sym.val)}
                                    className="h-6 text-[10px] bg-stone-700 hover:bg-stone-600 text-stone-200 rounded flex items-center justify-center"
                                >
                                    {sym.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <textarea 
                        ref={textareaRef}
                        className="w-full h-24 bg-transparent text-stone-200 p-2 text-xs font-mono outline-none resize-y"
                        value={ann.content || ""}
                        onChange={(e) => onChange(ann.id, { content: e.target.value })}
                        placeholder="\sum_{i=0}^n x_i"
                        spellCheck={false}
                    />
                </div>
            )}

            {isSelected && (
                <>
                     {['nw', 'ne', 'sw', 'se'].map((handle) => (
                        <div
                            key={handle}
                            className={`absolute w-3 h-3 bg-brand-green border border-white rounded-full z-[60] cursor-${handle}-resize`}
                            style={{
                                top: handle.includes('n') ? '-5px' : 'auto',
                                bottom: handle.includes('s') ? '-5px' : 'auto',
                                left: handle.includes('w') ? '-5px' : 'auto',
                                right: handle.includes('e') ? '-5px' : 'auto',
                            }}
                            onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, ann.id, 'resize', handle); }}
                        />
                    ))}
                </>
            )}
        </div>
    );
};


export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({ 
  annotations, 
  pageIndex, 
  selectedId, 
  scale,
  onMouseDown,
  onChange,
  onTextClick,
  isTTSActive
}) => {
  const pageAnnotations = annotations.filter(a => a.pageIndex === pageIndex);

  const handleStart = (e: React.MouseEvent | React.TouchEvent, id: string, type: 'move' | 'resize', handle?: string) => {
      onMouseDown(e, id, type, handle);
  };

  const ResizeHandles = ({ id }: { id: string }) => (
    <>
      {['nw', 'ne', 'sw', 'se'].map((handle) => (
        <div
          key={handle}
          // Handles stay constant size (w-4 h-4) for usability regardless of zoom
          className={`absolute w-4 h-4 bg-white border border-brand-blue rounded-full z-50 cursor-${handle}-resize touch-none`}
          style={{
            top: handle.includes('n') ? '-8px' : 'auto',
            bottom: handle.includes('s') ? '-8px' : 'auto',
            left: handle.includes('w') ? '-8px' : 'auto',
            right: handle.includes('e') ? '-8px' : 'auto',
          }}
          onMouseDown={(e) => handleStart(e, id, 'resize', handle)}
          onTouchStart={(e) => handleStart(e, id, 'resize', handle)}
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
             // SCALED STROKE WIDTH (Pixels = Base * Scale)
             strokeWidth={(ann.strokeWidth || 4) * scale} 
             fill="none"
             strokeLinecap="round"
             strokeLinejoin="round"
             opacity={ann.opacity || 1}
             vectorEffect="non-scaling-stroke" // Ensures pixel-perfect thickness without SVG distortion
             className={`pointer-events-auto cursor-pointer hover:opacity-80 transition-opacity touch-none ${selectedId === ann.id ? 'filter drop-shadow-[0_0_2px_rgba(59,130,246,0.8)]' : ''}`}
             onMouseDown={(e) => handleStart(e, ann.id, 'move')}
             onTouchStart={(e) => handleStart(e, ann.id, 'move')}
           />
        ))}
      </svg>

      {/* HTML Layer */}
      {pageAnnotations.map((ann) => {
        if (ann.type === 'freehand') return null;

        if (ann.type === 'latex') {
            return (
                <MathAnnotation 
                    key={ann.id} 
                    ann={ann} 
                    isSelected={selectedId === ann.id} 
                    onChange={onChange} 
                    onMouseDown={onMouseDown} 
                    handleStart={handleStart} 
                    scale={scale}
                />
            );
        }

        if (ann.type === 'text') {
            return (
                <RichTextAnnotation 
                    key={ann.id} 
                    ann={ann} 
                    isSelected={selectedId === ann.id} 
                    onChange={onChange} 
                    onMouseDown={onMouseDown} 
                    handleStart={handleStart} 
                    scale={scale}
                />
            );
        }

        const isSelected = selectedId === ann.id;
        const baseStyle: React.CSSProperties = {
          left: `${ann.x}%`,
          top: `${ann.y}%`,
          width: `${ann.width}%`,
          height: `${ann.height}%`,
          position: 'absolute',
        };

        const selectionRing = isSelected ? 'ring-1 ring-brand-blue ring-offset-1 ring-offset-transparent shadow-xl' : '';
        const interactiveClass = "pointer-events-auto group cursor-move touch-none";

        if (ann.type === 'image' && ann.imageData) {
          return (
            <div
              key={ann.id}
              className={`${interactiveClass} ${selectionRing}`}
              style={baseStyle}
              onMouseDown={(e) => handleStart(e, ann.id, 'move')}
              onTouchStart={(e) => handleStart(e, ann.id, 'move')}
            >
              <img src={ann.imageData} alt="" className="w-full h-full object-contain pointer-events-none select-none" />
              {isSelected && <ResizeHandles id={ann.id} />}
            </div>
          );
        }

        // --- RECTANGLE / WHITEOUT ---
        if (ann.type === 'rect') {
          return (
            <div
              key={ann.id}
              className={`${interactiveClass} ${selectionRing}`}
              style={{
                ...baseStyle,
                borderColor: ann.color,
                // SCALED BORDER WIDTH
                borderWidth: ann.fill ? 0 : `${(ann.strokeWidth || 2) * scale}px`,
                borderStyle: 'solid',
                backgroundColor: ann.fill ? ann.fill : 'transparent'
              }}
              onMouseDown={(e) => handleStart(e, ann.id, 'move')}
              onTouchStart={(e) => handleStart(e, ann.id, 'move')}
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
              className={`${interactiveClass} mix-blend-multiply ${selectionRing}`}
              style={{
                ...baseStyle,
                backgroundColor: ann.color,
                opacity: ann.opacity || 0.4
              }}
              onMouseDown={(e) => handleStart(e, ann.id, 'move')}
              onTouchStart={(e) => handleStart(e, ann.id, 'move')}
            >
              {isSelected && <ResizeHandles id={ann.id} />}
            </div>
          );
        }

        // --- COMMENT ---
        if (ann.type === 'comment') {
           const iconSize = 32 * scale;
           return (
             <div
               key={ann.id}
               className={`${interactiveClass} absolute ${isSelected ? 'z-50' : 'z-20'}`}
               style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
               onMouseDown={(e) => handleStart(e, ann.id, 'move')}
               onTouchStart={(e) => handleStart(e, ann.id, 'move')}
             >
               <div 
                 className={`rounded-bl-none rounded-full shadow-lg flex items-center justify-center border-2 border-stone-800 transition-transform ${isSelected ? 'scale-110 ring-2 ring-white' : 'hover:scale-110'}`}
                 style={{ 
                     backgroundColor: ann.color,
                     width: `${iconSize}px`,
                     height: `${iconSize}px`,
                     borderWidth: `${2 * scale}px`
                 }}
               >
                   <span className="font-bold text-stone-900" style={{ fontSize: `${12 * scale}px` }}>!</span>
               </div>
               
               {isSelected && (
                  <div 
                    className="absolute left-0 bg-stone-800 border border-stone-600 rounded shadow-2xl z-50 p-1" 
                    style={{ top: `${iconSize}px`, width: `${250 * scale}px` }}
                    onMouseDown={(e) => e.stopPropagation()} 
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                     <textarea
                       autoFocus
                       value={ann.content}
                       onChange={(e) => onChange(ann.id, { content: e.target.value })}
                       className="w-full bg-stone-900 border border-stone-700 p-2 rounded text-stone-200 outline-none focus:border-brand-blue"
                       rows={4}
                       placeholder="Enter comment..."
                       style={{ fontSize: `${12 * scale}px` }}
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
