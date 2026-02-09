
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PDFPage } from './PDFPage';
import { Annotation, PDFPageData, AppMode } from '../types';
import { Highlighter, Type, Square, MessageSquare, Pen, Eraser, ZoomIn, ZoomOut, ScanText, Crop, Sigma, FileText, Camera, Save, Trash2, X, Palette, Maximize, Droplet, Minus, Plus, AlignVerticalSpaceAround, ArrowDown, Mic, StopCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { DB } from '../utils/db';
import { useTTS } from '../hooks/useTTS';

interface EditorProps {
  pdfDoc: any;
  pages: PDFPageData[];
  annotations: Annotation[];
  mode: AppMode;
  scale: number;
  setScale: (s: number) => void;
  onAnnotationChange: (id: string, newProps: Partial<Annotation>) => void;
  onAddAnnotation: (ann: Annotation) => void;
  onDeleteAnnotation: (id: string) => void;
  onScrollStateChange: (pageIndex: number, scrollX: number, scrollY: number) => void;
  onAutoSaveTrigger: () => void; // Trigger for OCR auto-save
  initialScrollState?: { scrollX: number, scrollY: number, pageIndex: number };
  isHighContrast: boolean;
}

export const Editor: React.FC<EditorProps> = ({
  pdfDoc, pages, annotations, mode,
  scale, setScale,
  onAnnotationChange, onAddAnnotation, onDeleteAnnotation,
  onScrollStateChange, onAutoSaveTrigger, initialScrollState, isHighContrast
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { t, language } = useLanguage();
  const { speak, stop, isSpeaking } = useTTS();
  
  // Tool State
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [interactionState, setInteractionState] = useState<any>({ type: 'idle' });
  const [currentPath, setCurrentPath] = useState<{x: number, y: number}[]>([]);
  const [processingMsg, setProcessingMsg] = useState<string | null>(null);
  
  // View Mode Selection State
  const [viewSelection, setViewSelection] = useState<{
      pageIndex: number;
      start: { x: number, y: number };
      end: { x: number, y: number };
      visible: boolean;
  } | null>(null);
  
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, visible: boolean } | null>(null);
  const longPressTimerRef = useRef<any>(null);

  // Restore scroll on mount
  useEffect(() => {
      if (initialScrollState && scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = initialScrollState.scrollY;
          scrollContainerRef.current.scrollLeft = initialScrollState.scrollX;
          const el = document.getElementById(`page-${initialScrollState.pageIndex}`);
          if (el) el.scrollIntoView({ block: 'center' });
      }
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    
    // Hide context menu on scroll
    if (contextMenu?.visible) setContextMenu(null);

    const pageElements = container.querySelectorAll('[id^="page-"]');
    let activeIdx = 0;
    for (let i = 0; i < pageElements.length; i++) {
        const rect = pageElements[i].getBoundingClientRect();
        if (rect.bottom > 100 && rect.top < window.innerHeight - 100) {
            activeIdx = i;
            break;
        }
    }
    
    onScrollStateChange(activeIdx, container.scrollLeft, container.scrollTop);
  }, [onScrollStateChange, contextMenu]);

  // --- OCR HELPER FUNCTIONS ---
  const performOCR = async (blob: Blob, type: 'text' | 'math' | 'tts', rect: {x: number, y: number, w: number, h: number}, pageIdx: number) => {
      if (!window.Tesseract) return;
      
      const isTTS = type === 'tts';
      setProcessingMsg(type === 'math' ? t('solvingMath') : (isTTS ? t('reading') : t('scanningText')));
      
      try {
          // Use language from context if possible, default to English
          const tessLang = language.startsWith('it') ? 'ita' : 'eng';
          const worker = await window.Tesseract.createWorker(tessLang, 1);
          
          const { data: { text } } = await worker.recognize(blob);
          await worker.terminate();

          const cleanText = text.trim();
          if (!cleanText) {
              if (isTTS) alert(t('noTextFound'));
              return;
          }

          if (isTTS) {
              // DIRECT TEXT TO SPEECH
              speak(cleanText, language);
          } else {
              // CREATE ANNOTATION
              const newId = Date.now().toString();
              if (type === 'math') {
                  onAddAnnotation({
                      id: newId, pageIndex: pageIdx, type: 'latex',
                      x: rect.x, y: rect.y, width: rect.w, height: rect.h,
                      content: cleanText, 
                      color: '#000000',
                      fill: 'transparent'
                  });
              } else {
                  onAddAnnotation({
                      id: newId, pageIndex: pageIdx, type: 'text',
                      x: rect.x, y: rect.y, width: rect.w, height: rect.h,
                      content: `<p>${cleanText.replace(/\n/g, '<br>')}</p>`,
                      color: '#000000', 
                      fontSize: 16,
                      fill: 'transparent'
                  });
              }
              onAutoSaveTrigger();
          }

      } catch (e) {
          console.error("OCR Error", e);
          alert(t('ocrFailed'));
      } finally {
          setProcessingMsg(null);
      }
  };

  const captureAreaAndOCR = async (pageIdx: number, start: {x: number, y: number}, end: {x: number, y: number}, type: 'text' | 'math' | 'tts') => {
      const pageEl = document.getElementById(`page-${pageIdx}`);
      if (!pageEl) return;
      
      const canvas = pageEl.querySelector('canvas');
      if (!canvas) return;

      const x = Math.min(start.x, end.x) / 100 * canvas.width;
      const y = Math.min(start.y, end.y) / 100 * canvas.height;
      const w = Math.abs(end.x - start.x) / 100 * canvas.width;
      const h = Math.abs(end.y - start.y) / 100 * canvas.height;

      if (w < 10 || h < 10) return;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = w;
      tempCanvas.height = h;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

      tempCanvas.toBlob(blob => {
          if (blob) performOCR(blob, type, { 
              x: Math.min(start.x, end.x), 
              y: Math.min(start.y, end.y), 
              w: Math.abs(end.x - start.x), 
              h: Math.abs(end.y - start.y) 
          }, pageIdx);
      });
  };

  // --- VIEW MODE HELPERS ---
  const handleSnapshot = async () => {
    if (!viewSelection) return;
    setProcessingMsg(t('processing'));
      setContextMenu(null);

      try {
          const page = await pdfDoc.getPage(pages[viewSelection.pageIndex].originalIndex);
          // High Res Scale (300 DPI approx is 4.166 * 72)
          const highResScale = 4.16; 
          const viewport = page.getViewport({ scale: highResScale, rotation: pages[viewSelection.pageIndex].rotation });
          
          const startX = Math.min(viewSelection.start.x, viewSelection.end.x);
          const startY = Math.min(viewSelection.start.y, viewSelection.end.y);
          const selW = Math.abs(viewSelection.end.x - viewSelection.start.x);
          const selH = Math.abs(viewSelection.end.y - viewSelection.start.y);

          // Canvas dimensions based on selection
          const canvas = document.createElement('canvas');
          canvas.width = (selW / 100) * viewport.width;
          canvas.height = (selH / 100) * viewport.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // Translate context to shift the page so only selection renders on canvas
          const shiftX = -(startX / 100) * viewport.width;
          const shiftY = -(startY / 100) * viewport.height;
          
          ctx.translate(shiftX, shiftY);

          await page.render({ canvasContext: ctx, viewport }).promise;

          canvas.toBlob(async (blob) => {
              if (blob) {
                  try {
                      await navigator.clipboard.write([
                          new ClipboardItem({ 'image/png': blob })
                      ]);
                      alert(t('copySuccess'));
                  } catch (err) {
                      console.error('Clipboard write failed', err);
                      // Fallback: Download
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = `snapshot_${Date.now()}.png`;
                      link.click();
                  }
              }
              setProcessingMsg(null);
              setViewSelection(null);
          });
      } catch (e) {
          console.error(e);
          setProcessingMsg(null);
      }
  };

  const handleSaveSelectionPDF = async () => {
      if (!viewSelection || !window.PDFLib) return;
      setProcessingMsg(t('processing'));
      setContextMenu(null);

      try {
        const { PDFDocument, degrees } = window.PDFLib;
        const fileData = await pdfDoc.getData(); 
        const originalPdf = await PDFDocument.load(fileData);
        const newPdf = await PDFDocument.create();

        const pageIdx = pages[viewSelection.pageIndex].originalIndex - 1;
        const [copiedPage] = await newPdf.copyPages(originalPdf, [pageIdx]);
        
        copiedPage.setRotation(degrees(pages[viewSelection.pageIndex].rotation));
        
        const { width, height } = copiedPage.getSize();
        
        const startX = Math.min(viewSelection.start.x, viewSelection.end.x);
        const startY = Math.min(viewSelection.start.y, viewSelection.end.y);
        const selW = Math.abs(viewSelection.end.x - viewSelection.start.x);
        const selH = Math.abs(viewSelection.end.y - viewSelection.start.y);

        const cropX = (startX / 100) * width;
        const cropW = (selW / 100) * width;
        const cropH = (selH / 100) * height;
        const cropY = height - ((startY / 100) * height) - cropH;

        copiedPage.setCropBox(cropX, cropY, cropW, cropH);
        copiedPage.setMediaBox(cropX, cropY, cropW, cropH);

        newPdf.addPage(copiedPage);
        const pdfBytes = await newPdf.save();

        const newId = `pdf-${Date.now()}`;
        const newName = `Selection_${Date.now()}.pdf`;
        
        const loadingTask = window.pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
        const tempPdf = await loadingTask.promise;
        const tempPage = await tempPdf.getPage(1);
        const vp = tempPage.getViewport({ scale: 0.3 });
        const cvs = document.createElement('canvas');
        cvs.width = vp.width; cvs.height = vp.height;
        await tempPage.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
        const preview = cvs.toDataURL('image/jpeg', 0.5);

        await DB.saveFile({
            id: newId, name: newName, file: pdfBytes, preview, 
            pages: [{ id: `p-${Date.now()}`, originalIndex: 1, rotation: 0 }],
            annotations: [], lastPage: 0, scrollX: 0, scrollY: 0, lastModified: Date.now()
        });
        
        alert(`${t('savedToLibrary')}: ${newName}`);

      } catch (e) {
          console.error(e);
          alert(t('errorSavingPDF'));
      } finally {
          setProcessingMsg(null);
          setViewSelection(null);
      }
  };

  const handleOCRSelection = () => {
      if (!viewSelection) return;
      setContextMenu(null);
      captureAreaAndOCR(viewSelection.pageIndex, viewSelection.start, viewSelection.end, 'text');
      setViewSelection(null);
  };


  // --- INTERACTION HANDLERS ---
  const handlePageMouseDown = (e: React.MouseEvent | React.TouchEvent, pageIndex: number, coords: {x: number, y: number}, targetId?: string, type?: 'move' | 'resize', handle?: string) => {
    
    // VIEW MODE LOGIC
    if (mode === AppMode.VIEW) {
        const target = e.target as HTMLElement;
        const isTextLayer = target.closest('.textLayer');
        const isAnnotation = target.closest('.pointer-events-auto'); 

        if (!isTextLayer && !isAnnotation) {
             if (e.type === 'touchstart') {
                 longPressTimerRef.current = setTimeout(() => {
                     if (navigator.vibrate) navigator.vibrate(50);
                     setViewSelection({ pageIndex, start: coords, end: coords, visible: true });
                 }, 500);
             } else {
                 setViewSelection({ pageIndex, start: coords, end: coords, visible: true });
                 setContextMenu(null);
             }
        }
        return;
    }

    // EDIT/OCR MODE LOGIC
    if (targetId && type) {
        e.stopPropagation();
        setSelectedAnnotationId(targetId);
        const ann = annotations.find(a => a.id === targetId);
        if (ann) {
             setInteractionState({
                type: type === 'move' ? 'moving' : 'resizing',
                pageIndex,
                startCoords: coords,
                targetId,
                handle,
                initialRect: { x: ann.x, y: ann.y, w: ann.width || 0, h: ann.height || 0 }
             });
        }
        return;
    }

    if (activeTool) {
        if (activeTool === 'freehand') {
            setInteractionState({ type: 'drawing', pageIndex });
            setCurrentPath([coords]);
        } 
        else if (activeTool === 'ocr_area' || activeTool === 'ocr_math' || activeTool === 'ocr_tts') {
            setInteractionState({ 
                type: 'selecting_area', 
                toolType: activeTool,
                pageIndex, 
                startCoords: coords,
                currentCoords: coords 
            });
        }
        else if (activeTool === 'ocr_full') {
            const pageEl = document.getElementById(`page-${pageIndex}`);
            const canvas = pageEl?.querySelector('canvas');
            if (canvas) canvas.toBlob(blob => blob && performOCR(blob, 'text', { x: 5, y: 5, w: 90, h: 90 }, pageIndex));
            setActiveTool(null);
        }
        else {
            const newId = Date.now().toString();
            // Default sizes
            let defaultWidth = activeTool === 'text' ? 25 : (activeTool === 'comment' ? 0 : 0);
            let defaultHeight = activeTool === 'text' ? 10 : (activeTool === 'comment' ? 0 : 0);
            
            // MATH / LATEX Defaults
            if (activeTool === 'latex') {
                defaultWidth = 30;
                defaultHeight = 15;
            }

            let newAnn: Annotation = {
                id: newId, pageIndex, type: activeTool === 'whiteout' ? 'rect' : activeTool as any,
                x: coords.x, y: coords.y, 
                width: defaultWidth, 
                height: defaultHeight,
                color: activeTool === 'highlight' ? '#FFFF00' : '#000000',
                opacity: activeTool === 'highlight' ? 0.4 : 1,
                fill: activeTool === 'text' ? '#ffffff' : undefined // Manual text box gets white background by default
            };
            
            if (activeTool === 'whiteout') {
                newAnn.fill = '#FFFFFF';
                newAnn.color = '#FFFFFF';
            }
            if (activeTool === 'latex') {
                newAnn.content = '\\sum_{i=0}^n x_i'; // Default placeholder
                newAnn.color = '#000000';
                newAnn.fill = 'transparent';
                newAnn.fontSize = 20;
            }
            
            onAddAnnotation(newAnn);
            setSelectedAnnotationId(newId);
            if (defaultWidth > 0) {
                 setInteractionState({ type: 'idle' });
            } else {
                 setInteractionState({ type: 'creating', pageIndex, startCoords: coords, targetId: newId });
            }
        }
    } else {
        setSelectedAnnotationId(null);
    }
  };

  const handlePageMouseMove = (e: React.MouseEvent | React.TouchEvent, pageIndex: number, coords: {x: number, y: number}) => {
       if (longPressTimerRef.current && !viewSelection) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
      }

      if (viewSelection && viewSelection.pageIndex === pageIndex) {
          setViewSelection(prev => prev ? ({ ...prev, end: coords }) : null);
          return;
      }

      if (interactionState.type === 'idle' || interactionState.pageIndex !== pageIndex) return;

      if (interactionState.type === 'drawing') {
          setCurrentPath(prev => [...prev, coords]);
      }
      else if (interactionState.type === 'selecting_area') {
           setInteractionState(prev => ({ ...prev, currentCoords: coords }));
      }
      else if (interactionState.type === 'creating') {
          const start = interactionState.startCoords;
          const w = Math.abs(coords.x - start.x);
          const h = Math.abs(coords.y - start.y);
          const x = Math.min(coords.x, start.x);
          const y = Math.min(coords.y, start.y);
          onAnnotationChange(interactionState.targetId, { x, y, width: w, height: h });
      }
      else if (interactionState.type === 'moving') {
          const dx = coords.x - interactionState.startCoords.x;
          const dy = coords.y - interactionState.startCoords.y;
          onAnnotationChange(interactionState.targetId, { 
              x: interactionState.initialRect.x + dx, 
              y: interactionState.initialRect.y + dy 
          });
      }
      else if (interactionState.type === 'resizing') {
          const dx = coords.x - interactionState.startCoords.x;
          const dy = coords.y - interactionState.startCoords.y;
          const ir = interactionState.initialRect;
          const handle = interactionState.handle;

          let newX = ir.x;
          let newY = ir.y;
          let newW = ir.w;
          let newH = ir.h;

          if (handle.includes('w')) { newX = ir.x + dx; newW = ir.w - dx; } else if (handle.includes('e')) { newW = ir.w + dx; }
          if (handle.includes('n')) { newY = ir.y + dy; newH = ir.h - dy; } else if (handle.includes('s')) { newH = ir.h + dy; }

          if (newW > 1) onAnnotationChange(interactionState.targetId, { x: newX, width: newW });
          if (newH > 1) onAnnotationChange(interactionState.targetId, { y: newY, height: newH });
      }
  };

  const handleGlobalMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
       if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
      }

      if (viewSelection) {
          const clientX = (e as any).clientX || (e as any).changedTouches?.[0]?.clientX;
          const clientY = (e as any).clientY || (e as any).changedTouches?.[0]?.clientY;
          
          if (clientX && clientY) {
              setContextMenu({ x: clientX, y: clientY, visible: true });
          }
          return; 
      }

      if (interactionState.type === 'drawing' && currentPath.length > 2) {
          onAddAnnotation({
              id: Date.now().toString(),
              pageIndex: interactionState.pageIndex,
              type: 'freehand',
              x: 0, y: 0,
              points: currentPath,
              color: '#000000',
              strokeWidth: 4
          });
      }
      else if (interactionState.type === 'selecting_area') {
          const typeMap: Record<string, 'text' | 'math' | 'tts'> = {
              'ocr_math': 'math',
              'ocr_tts': 'tts',
              'ocr_area': 'text'
          };

          captureAreaAndOCR(
              interactionState.pageIndex, 
              interactionState.startCoords, 
              interactionState.currentCoords, 
              typeMap[interactionState.toolType] || 'text'
          );
          setActiveTool(null);
      }

      setInteractionState({ type: 'idle' });
      setCurrentPath([]);
  };

  const editTools = [
      { id: 'highlight', icon: Highlighter, color: 'text-yellow-400' },
      { id: 'freehand', icon: Pen, color: 'text-stone-200' },
      { id: 'text', icon: Type, color: 'text-stone-200' },
      { id: 'latex', icon: Sigma, color: 'text-brand-green' },
      { id: 'rect', icon: Square, color: 'text-brand-purple' },
      { id: 'whiteout', icon: Eraser, color: 'text-white' },
      { id: 'comment', icon: MessageSquare, color: 'text-brand-yellow' },
  ];

  const ocrTools = [
      { id: 'ocr_full', icon: FileText, label: t('fullPage'), color: 'text-brand-blue' },
      { id: 'ocr_area', icon: Crop, label: t('selectArea'), color: 'text-stone-200' },
      { id: 'ocr_math', icon: Sigma, label: t('mathArea'), color: 'text-brand-green' },
      { id: 'ocr_tts', icon: Mic, label: t('readArea'), color: 'text-red-400' },
  ];

  const selectedAnnotation = annotations.find(a => a.id === selectedAnnotationId);

  return (
    <div 
        className="flex-1 relative flex flex-col h-full bg-stone-900/30" 
        onMouseUp={handleGlobalMouseUp} 
        onTouchEnd={handleGlobalMouseUp}
    >
        {/* Processing Indicator */}
        {processingMsg && (
            <div className="absolute top-32 left-1/2 -translate-x-1/2 z-[100] bg-brand-blue/90 text-stone-900 px-4 py-2 rounded-full font-bold text-sm shadow-xl flex items-center gap-2 animate-bounce">
                <ScanText className="animate-pulse" size={16} /> {processingMsg}
            </div>
        )}

        {/* TTS Stop Button */}
        {isSpeaking && (
            <div className="absolute top-44 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4">
                <button 
                    onClick={stop}
                    className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-full font-bold shadow-xl flex items-center gap-2 transition-all hover:scale-105"
                >
                    <StopCircle size={20} className="animate-pulse" /> {t('stopReading')}
                </button>
            </div>
        )}

        {/* Floating Toolbars - EDIT MODE (Horizontal Top) */}
        {mode === AppMode.EDIT && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-stone-800/90 backdrop-blur border border-white/10 p-2 rounded-full shadow-xl overflow-x-auto max-w-[95vw]">
                {editTools.map(t => (
                    <button
                        key={t.id}
                        onClick={() => { setActiveTool(activeTool === t.id ? null : t.id); setSelectedAnnotationId(null); }}
                        className={`p-3 rounded-full hover:bg-white/10 transition-all ${activeTool === t.id ? 'bg-white/20 ring-1 ring-white/30' : ''}`}
                        title={t.id}
                    >
                        <t.icon size={20} className={t.color} />
                    </button>
                ))}
            </div>
        )}

        {/* Floating Toolbars - OCR MODE (Horizontal Top) - REVERTED TO HORIZONTAL */}
        {mode === AppMode.OCR && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-stone-800/90 backdrop-blur border border-white/10 p-2 rounded-full shadow-xl overflow-x-auto max-w-[95vw]">
                 {ocrTools.map(t => (
                    <button
                        key={t.id}
                        onClick={() => { setActiveTool(activeTool === t.id ? null : t.id); setSelectedAnnotationId(null); }}
                        className={`px-4 py-2 rounded-full hover:bg-white/10 transition-all flex items-center gap-2 ${activeTool === t.id ? 'bg-white/20 ring-1 ring-white/30' : ''}`}
                        title={t.label}
                    >
                        <t.icon size={18} className={t.color} />
                        <span className={`text-xs font-bold ${t.color} whitespace-nowrap`}>{t.label}</span>
                    </button>
                ))}
            </div>
        )}

        {/* PROPERTIES EDITOR PANEL */}
        {selectedAnnotation && (mode === AppMode.EDIT || mode === AppMode.OCR) && (
            <div className="fixed right-6 top-32 w-72 bg-stone-900/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl z-[60] p-4 animate-in slide-in-from-right-10 flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-400">{t('properties')}</span>
                    <button onClick={() => setSelectedAnnotationId(null)} className="text-stone-500 hover:text-white transition-colors">
                        <X size={14} />
                    </button>
                </div>

                {/* Color Pickers */}
                {(selectedAnnotation.type === 'text' || selectedAnnotation.type === 'freehand' || selectedAnnotation.type === 'rect' || selectedAnnotation.type === 'highlight' || selectedAnnotation.type === 'latex') && (
                    <div className="space-y-2">
                        <label className="text-xs text-stone-500 font-bold flex items-center gap-2"><Palette size={12}/> {t('color')}</label>
                        <div className="flex gap-2 flex-wrap">
                            {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FFFFFF'].map(c => (
                                <button 
                                    key={c}
                                    onClick={() => onAnnotationChange(selectedAnnotation.id, { color: c })}
                                    className={`w-6 h-6 rounded-full border border-white/20 ${selectedAnnotation.color === c ? 'ring-2 ring-brand-blue' : ''}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                            <input 
                                type="color" 
                                value={selectedAnnotation.color || '#000000'}
                                onChange={(e) => onAnnotationChange(selectedAnnotation.id, { color: e.target.value })}
                                className="w-6 h-6 rounded-full overflow-hidden p-0 border-0"
                            />
                        </div>
                    </div>
                )}

                {/* Fill Color for Rect/Text/Latex */}
                {(selectedAnnotation.type === 'rect' || selectedAnnotation.type === 'text' || selectedAnnotation.type === 'latex') && (
                    <div className="space-y-2">
                         <label className="text-xs text-stone-500 font-bold flex items-center gap-2"><Droplet size={12}/> {t('fill')}</label>
                         <div className="flex gap-2 flex-wrap">
                            <button 
                                onClick={() => onAnnotationChange(selectedAnnotation.id, { fill: undefined })}
                                className={`w-6 h-6 rounded-full border border-white/20 flex items-center justify-center bg-transparent ${!selectedAnnotation.fill ? 'ring-2 ring-brand-blue' : ''}`}
                                title={t('transparent')}
                            >
                                <X size={12} className="text-red-500"/>
                            </button>
                            {['#FFFFFF', '#FFFF00', '#000000', '#1c1917'].map(c => (
                                <button 
                                    key={c}
                                    onClick={() => onAnnotationChange(selectedAnnotation.id, { fill: c })}
                                    className={`w-6 h-6 rounded-full border border-white/20 ${selectedAnnotation.fill === c ? 'ring-2 ring-brand-blue' : ''}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                            <input 
                                type="color" 
                                value={selectedAnnotation.fill || '#ffffff'}
                                onChange={(e) => onAnnotationChange(selectedAnnotation.id, { fill: e.target.value })}
                                className="w-6 h-6 rounded-full overflow-hidden p-0 border-0"
                            />
                        </div>
                    </div>
                )}

                {/* Vertical Text Toggle (For CJK Support) */}
                {selectedAnnotation.type === 'text' && (
                     <div className="space-y-2">
                        <label className="text-xs text-stone-500 font-bold flex items-center gap-2"><AlignVerticalSpaceAround size={12}/> {t('textOrientation')}</label>
                        <button 
                            onClick={() => onAnnotationChange(selectedAnnotation.id, { vertical: !selectedAnnotation.vertical })}
                            className={`w-full py-2 rounded-lg border flex items-center justify-center gap-2 text-xs font-bold transition-all ${selectedAnnotation.vertical ? 'bg-brand-blue text-stone-900 border-brand-blue' : 'bg-stone-800 border-stone-700 text-stone-400'}`}
                        >
                            {selectedAnnotation.vertical ? <ArrowDown size={14}/> : <Type size={14}/>}
                            {selectedAnnotation.vertical ? t('verticalCJK') : t('horizontal')}
                        </button>
                     </div>
                )}

                {/* Font Size */}
                {(selectedAnnotation.type === 'text' || selectedAnnotation.type === 'latex') && (
                    <div className="space-y-2">
                        <label className="text-xs text-stone-500 font-bold flex items-center gap-2"><Type size={12}/> {t('size')}</label>
                        <input 
                            type="range" min="8" max="72" step="1"
                            value={selectedAnnotation.fontSize || 16}
                            onChange={(e) => onAnnotationChange(selectedAnnotation.id, { fontSize: parseInt(e.target.value) })}
                            className="w-full accent-brand-blue h-2 bg-stone-700 rounded-lg appearance-none"
                        />
                    </div>
                )}

                {/* Stroke Width */}
                {(selectedAnnotation.type === 'freehand' || selectedAnnotation.type === 'rect') && (
                    <div className="space-y-2">
                        <label className="text-xs text-stone-500 font-bold flex items-center gap-2"><Maximize size={12}/> {t('stroke')}</label>
                        <div className="flex items-center gap-2">
                            <button onClick={() => onAnnotationChange(selectedAnnotation.id, { strokeWidth: Math.max(1, (selectedAnnotation.strokeWidth || 2) - 1) })} className="p-1 hover:bg-white/10 rounded"><Minus size={12}/></button>
                            <span className="text-xs font-mono w-4 text-center">{selectedAnnotation.strokeWidth || 2}</span>
                            <button onClick={() => onAnnotationChange(selectedAnnotation.id, { strokeWidth: (selectedAnnotation.strokeWidth || 2) + 1 })} className="p-1 hover:bg-white/10 rounded"><Plus size={12}/></button>
                            <input 
                                type="range" min="1" max="20" step="1"
                                value={selectedAnnotation.strokeWidth || 2}
                                onChange={(e) => onAnnotationChange(selectedAnnotation.id, { strokeWidth: parseInt(e.target.value) })}
                                className="flex-1 accent-brand-blue h-2 bg-stone-700 rounded-lg appearance-none"
                            />
                        </div>
                    </div>
                )}

                {/* Opacity */}
                <div className="space-y-2">
                     <label className="text-xs text-stone-500 font-bold flex items-center gap-2">{t('opacity')}</label>
                     <input 
                        type="range" min="0.1" max="1" step="0.1"
                        value={selectedAnnotation.opacity ?? 1}
                        onChange={(e) => onAnnotationChange(selectedAnnotation.id, { opacity: parseFloat(e.target.value) })}
                        className="w-full accent-brand-blue h-2 bg-stone-700 rounded-lg appearance-none"
                     />
                </div>

                <div className="h-[1px] bg-white/10 my-2" />
                
                <button 
                    onClick={() => { onDeleteAnnotation(selectedAnnotation.id); setSelectedAnnotationId(null); }}
                    className="w-full py-2 bg-red-900/30 text-red-400 border border-red-900/50 rounded-lg hover:bg-red-900/50 transition-colors flex items-center justify-center gap-2 text-xs font-bold uppercase"
                >
                    <Trash2 size={14} /> {t('delete')}
                </button>
            </div>
        )}

        {/* Context Menu for Quick Selection */}
        {contextMenu && viewSelection && (
            <div 
                className="fixed z-[99] bg-stone-800/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[200px] animate-in fade-in zoom-in-95 duration-100"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                onMouseDown={(e) => e.stopPropagation()} // Prevent closing immediately
            >
                <div className="p-1">
                    <button onClick={handleSnapshot} className="w-full flex items-center gap-3 px-3 py-2 text-stone-200 hover:bg-white/10 rounded-lg text-sm transition-colors text-left">
                        <Camera size={16} className="text-brand-purple" />
                        {t('snapshot')}
                    </button>
                    <button onClick={handleSaveSelectionPDF} className="w-full flex items-center gap-3 px-3 py-2 text-stone-200 hover:bg-white/10 rounded-lg text-sm transition-colors text-left">
                        <Save size={16} className="text-brand-green" />
                        {t('saveSelection')}
                    </button>
                    <button onClick={handleOCRSelection} className="w-full flex items-center gap-3 px-3 py-2 text-stone-200 hover:bg-white/10 rounded-lg text-sm transition-colors text-left">
                        <ScanText size={16} className="text-brand-blue" />
                        {t('ocrSelection')}
                    </button>
                    <div className="h-[1px] bg-white/10 my-1" />
                    <button onClick={() => { setViewSelection(null); setContextMenu(null); }} className="w-full text-center py-1 text-xs text-stone-500 hover:text-stone-300">
                        {t('cancel')}
                    </button>
                </div>
            </div>
        )}

        {/* Scroll Container */}
        <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto custom-scrollbar flex justify-center relative pt-20 pb-24 md:pb-20"
            // Click background to close context menu
            onClick={() => contextMenu && setContextMenu(null)}
        >
            <div className="w-full max-w-4xl px-4">
                {pages.map((page, idx) => (
                    <div key={page.id} id={`page-${idx}`}>
                        <PDFPage 
                            pdfDoc={pdfDoc}
                            pageNumber={page.originalIndex}
                            visualIndex={idx}
                            rotation={page.rotation}
                            scale={scale}
                            annotations={annotations.filter(a => a.pageIndex === idx)}
                            selectedAnnotationId={selectedAnnotationId}
                            onMouseDown={handlePageMouseDown}
                            onMouseMove={handlePageMouseMove}
                            onAnnotationChange={onAnnotationChange}
                            isToolActive={!!activeTool}
                            isHighContrast={isHighContrast}
                        />
                         {/* Overlays */}
                        {interactionState.pageIndex === idx && (
                            <div className="absolute inset-0 pointer-events-none z-50" style={{ top: document.getElementById(`page-${idx}`)?.offsetTop, height: document.getElementById(`page-${idx}`)?.offsetHeight, width: document.getElementById(`page-${idx}`)?.offsetWidth, left: document.getElementById(`page-${idx}`)?.offsetLeft }}>
                                {interactionState.type === 'drawing' && (
                                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                        <path d={`M ${currentPath.map(p => `${p.x} ${p.y}`).join(' L ')}`} stroke="#000000" strokeWidth={0.4} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
                                    </svg>
                                )}
                                {interactionState.type === 'selecting_area' && (
                                    <div 
                                        className="absolute border-2 border-brand-blue bg-brand-blue/20"
                                        style={{
                                            left: `${Math.min(interactionState.startCoords.x, interactionState.currentCoords.x)}%`,
                                            top: `${Math.min(interactionState.startCoords.y, interactionState.currentCoords.y)}%`,
                                            width: `${Math.abs(interactionState.currentCoords.x - interactionState.startCoords.x)}%`,
                                            height: `${Math.abs(interactionState.currentCoords.y - interactionState.startCoords.y)}%`
                                        }}
                                    />
                                )}
                            </div>
                        )}
                        {/* Quick Selection Overlay (View Mode) */}
                        {viewSelection && viewSelection.pageIndex === idx && (
                            <div className="absolute inset-0 pointer-events-none z-50" style={{ top: document.getElementById(`page-${idx}`)?.offsetTop, height: document.getElementById(`page-${idx}`)?.offsetHeight, width: document.getElementById(`page-${idx}`)?.offsetWidth, left: document.getElementById(`page-${idx}`)?.offsetLeft }}>
                                <div 
                                    className="absolute border-2 border-brand-blue bg-brand-blue/20"
                                    style={{
                                        left: `${Math.min(viewSelection.start.x, viewSelection.end.x)}%`,
                                        top: `${Math.min(viewSelection.start.y, viewSelection.end.y)}%`,
                                        width: `${Math.abs(viewSelection.end.x - viewSelection.start.x)}%`,
                                        height: `${Math.abs(viewSelection.end.y - viewSelection.start.y)}%`
                                    }}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>

        {/* Zoom Controls */}
        <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-[80] flex gap-2 bg-stone-800 p-2 rounded-full shadow-2xl border border-white/10 animate-in slide-in-from-bottom-6">
             <button onClick={() => setScale(Math.max(0.5, scale - 0.25))} className="p-2 hover:bg-white/10 rounded-full text-stone-300"><ZoomOut size={20}/></button>
             <span className="flex items-center text-xs font-mono px-2 text-stone-400 min-w-[3rem] justify-center">{Math.round(scale*100)}%</span>
             <button onClick={() => setScale(Math.min(4, scale + 0.25))} className="p-2 hover:bg-white/10 rounded-full text-stone-300"><ZoomIn size={20}/></button>
        </div>
    </div>
  );
};
