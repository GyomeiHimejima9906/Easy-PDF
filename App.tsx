import React, { useState, useEffect, useRef } from 'react';
import { setupPDFWorker } from './utils/pdfWorker';
import { TopBar } from './components/TopBar';
import { SideBar } from './components/SideBar';
import { PDFPage } from './components/PDFPage';
import { PageThumbnail } from './components/PageThumbnail';
import { AppMode, Annotation, PDFPageData } from './types';
import { 
  Highlighter, Type, Square, MessageSquare, Trash2, 
  Download, ScanText, Pen, Palette, X, ZoomIn, ZoomOut, Loader2,
  RotateCw, RotateCcw, FilePlus, Split, Move
} from 'lucide-react';

// Initialize PDF Worker
setupPDFWorker();

// Helper to convert hex color to RGB (0-1)
const hexToRgb = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
};

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.VIEW);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pages, setPages] = useState<PDFPageData[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  
  // Editor State
  const [activeTool, setActiveTool] = useState<'text' | 'rect' | 'highlight' | 'comment' | 'freehand' | null>(null);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  
  // Page Management State
  const [draggedPageIndex, setDraggedPageIndex] = useState<number | null>(null);

  // View State
  const [scale, setScale] = useState(1.5);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Interaction State
  const [interactionState, setInteractionState] = useState<{
    type: 'idle' | 'drawing' | 'creating' | 'moving' | 'resizing';
    pageIndex: number;
    startCoords: { x: number, y: number }; 
    currentCoords: { x: number, y: number };
    targetId: string | null;
    resizeHandle?: string;
    initialRect?: { x: number, y: number, w: number, h: number };
  }>({
    type: 'idle',
    pageIndex: -1,
    startCoords: { x: 0, y: 0 },
    currentCoords: { x: 0, y: 0 },
    targetId: null
  });

  const [currentPath, setCurrentPath] = useState<{x: number, y: number}[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [compressionLevel, setCompressionLevel] = useState(5); // 1-10

  // Load PDF
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    const fileReader = new FileReader();
    fileReader.onload = async function() {
      const typedarray = new Uint8Array(this.result as ArrayBuffer);
      loadPDF(typedarray);
    };
    fileReader.readAsArrayBuffer(file);
  };

  const loadPDF = async (typedarray: Uint8Array) => {
      try {
        const loadingTask = window.pdfjsLib.getDocument(typedarray);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        // Reset pages with IDs
        const newPages = Array.from({ length: pdf.numPages }, (_, i) => ({ 
            id: `page-${Date.now()}-${i}`,
            originalIndex: i + 1, 
            rotation: 0 
        }));
        setPages(newPages);
        setSelectedPageIndex(0);
        // If we reloaded content, we might want to clear annotations or keep them if it's the same file.
        // For simplicity in this "Insert/Edit" flow, we keep annotations but they might be misaligned if file changed completely.
      } catch (error) {
        console.error(error);
        alert("Error loading PDF");
      }
  }

  const updateAnnotation = (id: string, newProps: Partial<Annotation>) => {
    setAnnotations(prev => prev.map(ann => ann.id === id ? { ...ann, ...newProps } : ann));
  };

  // --- PAGE MANAGEMENT LOGIC ---

  const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggedPageIndex(index);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (draggedPageIndex === null || draggedPageIndex === targetIndex) return;

      const newPages = [...pages];
      const [movedPage] = newPages.splice(draggedPageIndex, 1);
      newPages.splice(targetIndex, 0, movedPage);
      setPages(newPages);
      
      // Update Selection
      setSelectedPageIndex(targetIndex);

      // IMPORTANT: Shift Annotations
      const newAnnotations = annotations.map(ann => {
          let newIndex = ann.pageIndex;
          
          if (ann.pageIndex === draggedPageIndex) {
              newIndex = targetIndex;
          } else if (draggedPageIndex < targetIndex) {
              // Moved down: items in between shift up
              if (ann.pageIndex > draggedPageIndex && ann.pageIndex <= targetIndex) {
                  newIndex = ann.pageIndex - 1;
              }
          } else if (draggedPageIndex > targetIndex) {
              // Moved up: items in between shift down
              if (ann.pageIndex >= targetIndex && ann.pageIndex < draggedPageIndex) {
                  newIndex = ann.pageIndex + 1;
              }
          }
          return { ...ann, pageIndex: newIndex };
      });
      
      setAnnotations(newAnnotations);
      setDraggedPageIndex(null);
  };

  const handleRotatePage = (direction: 'left' | 'right') => {
      setPages(prev => prev.map((p, idx) => {
          if (idx !== selectedPageIndex) return p;
          const delta = direction === 'left' ? -90 : 90;
          let newRot = (p.rotation + delta) % 360;
          if (newRot < 0) newRot += 360;
          return { ...p, rotation: newRot };
      }));
  };

  const handleDeletePage = () => {
      if (pages.length <= 1) {
          alert("Cannot delete the last page.");
          return;
      }
      if (!confirm("Are you sure you want to delete this page?")) return;

      const deleteIndex = selectedPageIndex;
      
      // Remove page
      const newPages = pages.filter((_, idx) => idx !== deleteIndex);
      setPages(newPages);
      
      // Remove annotations for this page and shift others
      const newAnnotations = annotations
          .filter(a => a.pageIndex !== deleteIndex)
          .map(a => ({
              ...a,
              pageIndex: a.pageIndex > deleteIndex ? a.pageIndex - 1 : a.pageIndex
          }));
      setAnnotations(newAnnotations);

      setSelectedPageIndex(Math.max(0, deleteIndex - 1));
  };

  const handleExtractPage = async () => {
      if (!pdfFile || !window.PDFLib) return;
      setIsProcessing(true);
      setProcessingMessage('Extracting page...');
      
      try {
          const { PDFDocument, degrees } = window.PDFLib;
          const existingPdfBytes = await pdfFile.arrayBuffer();
          const srcDoc = await PDFDocument.load(existingPdfBytes);
          const newDoc = await PDFDocument.create();

          const pageData = pages[selectedPageIndex];
          const [copiedPage] = await newDoc.copyPages(srcDoc, [pageData.originalIndex - 1]);
          copiedPage.setRotation(degrees(pageData.rotation)); 
          newDoc.addPage(copiedPage);

          const pdfBytes = await newDoc.save();
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `page_${selectedPageIndex + 1}_${pdfFile.name}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (err) {
          console.error(err);
          alert("Extraction failed.");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleInsertFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !window.PDFLib || !pdfFile) return;
      
      setIsProcessing(true);
      setProcessingMessage('Merging file...');

      try {
          const { PDFDocument, degrees } = window.PDFLib;
          
          const currentPdfBytes = await pdfFile.arrayBuffer();
          const incomingPdfBytes = await file.arrayBuffer();
          
          const srcDoc = await PDFDocument.load(currentPdfBytes);
          const incomingDoc = await PDFDocument.load(incomingPdfBytes);
          const newDoc = await PDFDocument.create();

          // 1. Add pages from current state
          const copiedIndices = pages.map(p => p.originalIndex - 1);
          const currentPages = await newDoc.copyPages(srcDoc, copiedIndices);
          
          currentPages.forEach((page, idx) => {
              page.setRotation(degrees(pages[idx].rotation));
              newDoc.addPage(page);
          });

          // 2. Add pages from new file
          const incomingIndices = incomingDoc.getPageIndices();
          const newIncomingPages = await newDoc.copyPages(incomingDoc, incomingIndices);
          
          newIncomingPages.forEach(page => newDoc.addPage(page));

          // 3. Save and Reload
          const mergedBytes = await newDoc.save();
          
          const newFileName = `merged_${pdfFile.name}`;
          const newFile = new File([mergedBytes], newFileName, { type: 'application/pdf' });
          setPdfFile(newFile);
          loadPDF(mergedBytes);
          
          alert("File inserted successfully at the end.");

      } catch (err) {
          console.error(err);
          alert("Failed to insert file.");
      } finally {
          setIsProcessing(false);
      }
  };

  // --- OCR LOGIC ---
  const handleRunOCR = async () => {
      if (!pdfDoc || !window.Tesseract) return;
      
      const pageIdx = selectedPageIndex; 
      const pageNum = pages[pageIdx].originalIndex; 

      setIsProcessing(true);
      setProcessingMessage(`Scanning page ${pageIdx + 1}...`);

      try {
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 }); 
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: context, viewport }).promise;

          const result = await window.Tesseract.recognize(canvas, 'eng');
          
          const newAnnotations: Annotation[] = result.data.words.map((word: any) => {
             const bbox = word.bbox;
             const widthPercent = ((bbox.x1 - bbox.x0) / viewport.width) * 100;
             const heightPercent = ((bbox.y1 - bbox.y0) / viewport.height) * 100;
             const xPercent = (bbox.x0 / viewport.width) * 100;
             const yPercent = (bbox.y0 / viewport.height) * 100;
             const fontSize = (bbox.y1 - bbox.y0);

             return {
                 id: `ocr-${Date.now()}-${Math.random()}`,
                 pageIndex: pageIdx, // Visual Index
                 type: 'ocr_text',
                 x: xPercent,
                 y: yPercent,
                 width: widthPercent,
                 height: heightPercent,
                 content: word.text,
                 color: 'transparent',
                 fontSize: fontSize / 2, 
                 opacity: 0,
             };
          });

          setAnnotations(prev => [...prev, ...newAnnotations]);
          setMode(AppMode.VIEW);
          alert(`OCR Complete! Found ${newAnnotations.length} words.`);

      } catch (err) {
          console.error("OCR Failed", err);
          alert("OCR Failed");
      } finally {
          setIsProcessing(false);
      }
  };

  // --- COMPRESSION LOGIC ---
  const handleCompress = async () => {
      if (!pdfDoc || !window.PDFLib) return;
      setIsProcessing(true);
      setProcessingMessage(`Compressing PDF (Quality: ${compressionLevel}/10)...`);

      try {
          const { PDFDocument } = window.PDFLib;
          const newPdfDoc = await PDFDocument.create();

          for (let i = 0; i < pages.length; i++) {
              setProcessingMessage(`Compressing page ${i + 1} of ${pages.length}...`);
              
              const pageData = pages[i];
              const page = await pdfDoc.getPage(pageData.originalIndex);
              
              const viewport = page.getViewport({ scale: 1.5, rotation: pageData.rotation }); 
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              
              if (context) {
                  context.fillStyle = 'white';
                  context.fillRect(0, 0, canvas.width, canvas.height);
              }
              
              await page.render({ canvasContext: context, viewport }).promise;

              const quality = compressionLevel / 10;
              const imgDataUrl = canvas.toDataURL('image/jpeg', quality);
              const imgBytes = await fetch(imgDataUrl).then(res => res.arrayBuffer());

              const jpgImage = await newPdfDoc.embedJpg(imgBytes);
              const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);
              newPage.drawImage(jpgImage, {
                  x: 0,
                  y: 0,
                  width: viewport.width,
                  height: viewport.height,
              });
          }

          const pdfBytes = await newPdfDoc.save();
          loadPDF(pdfBytes);
          const newFile = new File([pdfBytes], `compressed_${pdfFile?.name || 'doc.pdf'}`, { type: 'application/pdf' });
          setPdfFile(newFile);
          
          setMode(AppMode.VIEW);
          alert("Compression complete!");

      } catch (err) {
          console.error("Compression failed", err);
          alert("Compression failed.");
      } finally {
          setIsProcessing(false);
      }
  };

  // --- SAVE LOGIC ---
  const handleSavePDF = async () => {
    if (!pdfFile || !window.PDFLib) return;
    setIsProcessing(true);
    setProcessingMessage('Saving PDF...');
    
    try {
      const { PDFDocument, rgb, StandardFonts, degrees } = window.PDFLib;
      
      const existingPdfBytes = await pdfFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(existingPdfBytes);
      const newDoc = await PDFDocument.create();
      const helveticaFont = await newDoc.embedFont(StandardFonts.Helvetica);

      // 1. Copy Pages in VISUAL Order
      const copiedIndices = pages.map(p => p.originalIndex - 1);
      const copiedPages = await newDoc.copyPages(srcDoc, copiedIndices);

      // 2. Add Pages and Draw Annotations
      for (let i = 0; i < copiedPages.length; i++) {
          const page = copiedPages[i];
          const pageData = pages[i]; 
          
          // Apply rotation using degrees helper
          page.setRotation(degrees(pageData.rotation));
          
          newDoc.addPage(page);

          const { width, height } = page.getSize();
          const pageAnnotations = annotations.filter(a => a.pageIndex === i);
          
          pageAnnotations.forEach(ann => {
             if (ann.type === 'ocr_text') return; 

             const { r, g, b } = hexToRgb(ann.color);
             const color = rgb(r, g, b);

             if (ann.type === 'text') {
               const fontSize = ann.fontSize || 16;
               const x = (ann.x / 100) * width;
               const y = height - (ann.y / 100) * height - fontSize;
               
               page.drawText(ann.content || '', {
                 x, y, size: fontSize, font: helveticaFont, color: color,
               });
             }
             else if (ann.type === 'rect' || ann.type === 'highlight') {
                const x = (ann.x / 100) * width;
                const w = ((ann.width || 0) / 100) * width;
                const h = ((ann.height || 0) / 100) * height;
                const y = height - ((ann.y / 100) * height) - h;

                if (ann.type === 'highlight') {
                    page.drawRectangle({
                        x, y, width: w, height: h,
                        color: color, opacity: ann.opacity || 0.4
                    });
                } else {
                    page.drawRectangle({
                        x, y, width: w, height: h,
                        borderColor: color, borderWidth: ann.strokeWidth || 2,
                        opacity: 1, color: undefined
                    });
                }
            }
            else if (ann.type === 'freehand' && ann.points && ann.points.length > 0) {
                const pathOps = ann.points.map((p, k) => {
                    const px = (p.x / 100) * width;
                    const py = height - (p.y / 100) * height;
                    return `${k === 0 ? 'M' : 'L'} ${px} ${py}`;
                }).join(' ');

                page.drawSvgPath(pathOps, {
                    borderColor: color, borderWidth: ann.strokeWidth ? ann.strokeWidth / 2 : 2, 
                    opacity: ann.opacity || 1
                });
            }
            else if (ann.type === 'comment') {
                const iconSize = 24;
                const x = (ann.x / 100) * width;
                const y = height - ((ann.y / 100) * height) - iconSize;

                page.drawRectangle({
                    x, y, width: iconSize, height: iconSize,
                    color: rgb(0.99, 0.84, 0.39), borderColor: rgb(0.11, 0.1, 0.09), borderWidth: 1,
                });
                page.drawText('!', {
                    x: x + 10, y: y + 6, size: 14, font: helveticaFont, color: rgb(0.11, 0.1, 0.09),
                });
                if (ann.content) {
                    const textWidth = Math.min(200, ann.content.length * 6); 
                    const textHeight = 24;
                    page.drawRectangle({
                        x: x + iconSize + 2, y: y + iconSize - textHeight, 
                        width: textWidth, height: textHeight,
                        color: rgb(1, 1, 1), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1,
                    });
                    page.drawText(ann.content.substring(0, 30), {
                        x: x + iconSize + 6, y: y + iconSize - textHeight + 6,
                        size: 10, font: helveticaFont, color: rgb(0, 0, 0),
                    });
                }
            }
          });
      }

      const pdfBytes = await newDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `edited_${pdfFile.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error("Error saving PDF:", err);
      alert("Failed to save PDF. See console for details.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Native Zoom Handling ---
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleWheelNative = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault(); 
        const delta = e.deltaY * -0.01;
        setScale(prev => Math.min(Math.max(0.5, prev + delta), 4.0));
      }
    };
    container.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => container.removeEventListener('wheel', handleWheelNative);
  }, []);

  // --- Interaction Handlers ---
  const handlePageMouseDown = (e: React.MouseEvent, pageIndex: number, coords: {x: number, y: number}, targetId?: string, type?: 'move' | 'resize', handle?: string) => {
    if (mode !== AppMode.EDIT) return;
    if (targetId && type) {
      e.stopPropagation();
      if (activeTool !== 'text' && type === 'move') e.preventDefault();
      setSelectedAnnotationId(targetId);
      const targetAnn = annotations.find(a => a.id === targetId);
      if(!targetAnn) return;
      setInteractionState({
        type: type === 'move' ? 'moving' : 'resizing',
        pageIndex: pageIndex,
        startCoords: coords,
        currentCoords: coords,
        targetId: targetId,
        resizeHandle: handle,
        initialRect: { x: targetAnn.x, y: targetAnn.y, w: targetAnn.width || 0, h: targetAnn.height || 0 }
      });
      return;
    }
    if (activeTool && !targetId) {
      if (activeTool === 'freehand') {
        setInteractionState({ type: 'drawing', pageIndex, startCoords: coords, currentCoords: coords, targetId: null });
        setCurrentPath([coords]);
        return;
      }
      const newId = Date.now().toString();
      const newAnn: Annotation = {
        id: newId, pageIndex: pageIndex, type: activeTool,
        x: coords.x, y: coords.y, width: 0, height: 0,
        content: activeTool === 'text' ? '' : activeTool === 'comment' ? '' : undefined,
        color: activeTool === 'highlight' ? '#FFFF00' : activeTool === 'text' ? '#000000' : activeTool === 'comment' ? '#FDD663' : '#D0BCFF',
        fontSize: 16, strokeWidth: 2, opacity: activeTool === 'highlight' ? 0.4 : 1
      };
      if (activeTool === 'comment') {
         setAnnotations([...annotations, { ...newAnn, width: 0, height: 0 }]);
         setSelectedAnnotationId(newId);
         setActiveTool(null);
         return; 
      }
      setAnnotations([...annotations, newAnn]);
      setSelectedAnnotationId(newId);
      setInteractionState({ type: 'creating', pageIndex, startCoords: coords, currentCoords: coords, targetId: newId });
    } else {
        setSelectedAnnotationId(null);
    }
  };

  const handlePageMouseMove = (e: React.MouseEvent, pageIndex: number, coords: {x: number, y: number}) => {
    if (interactionState.type === 'idle') return;
    if (interactionState.pageIndex !== pageIndex) return;
    if (interactionState.type === 'drawing') {
      setCurrentPath(prev => [...prev, coords]);
      return;
    }
    if (interactionState.type === 'creating' && interactionState.targetId) {
      const start = interactionState.startCoords;
      const width = Math.abs(coords.x - start.x);
      const height = Math.abs(coords.y - start.y);
      const x = Math.min(coords.x, start.x);
      const y = Math.min(coords.y, start.y);
      updateAnnotation(interactionState.targetId, { x, y, width, height });
      return;
    }
    if (interactionState.type === 'moving' && interactionState.targetId && interactionState.initialRect) {
      const dx = coords.x - interactionState.startCoords.x;
      const dy = coords.y - interactionState.startCoords.y;
      const newX = interactionState.initialRect.x + dx;
      const newY = interactionState.initialRect.y + dy;
      updateAnnotation(interactionState.targetId, { x: newX, y: newY });
      return;
    }
    if (interactionState.type === 'resizing' && interactionState.targetId && interactionState.initialRect) {
        const { x, y, w, h } = interactionState.initialRect;
        const dx = coords.x - interactionState.startCoords.x;
        const dy = coords.y - interactionState.startCoords.y;
        let newX = x, newY = y, newW = w, newH = h;
        const handle = interactionState.resizeHandle;
        if (handle?.includes('e')) newW = Math.max(1, w + dx);
        if (handle?.includes('s')) newH = Math.max(1, h + dy);
        if (handle?.includes('w')) { newW = Math.max(1, w - dx); newX = x + dx; }
        if (handle?.includes('n')) { newH = Math.max(1, h - dy); newY = y + dy; }
        updateAnnotation(interactionState.targetId, { x: newX, y: newY, width: newW, height: newH });
    }
  };

  const handleGlobalMouseUp = () => {
    if (interactionState.type === 'drawing') {
      if (currentPath.length > 2) {
        const newAnn: Annotation = {
          id: Date.now().toString(), pageIndex: interactionState.pageIndex, type: 'freehand',
          x: 0, y: 0, points: currentPath, color: '#81C995', strokeWidth: 4, opacity: 1
        };
        setAnnotations([...annotations, newAnn]);
      }
      setCurrentPath([]);
    } else if (interactionState.type === 'creating') {
        const createdAnn = annotations.find(a => a.id === interactionState.targetId);
        if (createdAnn && createdAnn.type === 'text' && (createdAnn.width === 0 || createdAnn.height === 0)) {
             updateAnnotation(interactionState.targetId!, { width: 20, height: 5 });
        }
        else if (createdAnn && (createdAnn.width === 0 || createdAnn.height === 0)) {
             updateAnnotation(interactionState.targetId!, { width: 15, height: 5 });
        }
        setActiveTool(null);
    }
    setInteractionState({ type: 'idle', pageIndex: -1, startCoords: {x:0,y:0}, currentCoords: {x:0,y:0}, targetId: null });
  };

  const getSelectedAnnotation = () => annotations.find(a => a.id === selectedAnnotationId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-stone-950" onMouseUp={handleGlobalMouseUp}>
      <TopBar fileName={pdfFile?.name || null} onUpload={handleFileUpload} onSave={handleSavePDF} />
      <SideBar currentMode={mode} setMode={(m) => { setMode(m); setSelectedAnnotationId(null); setActiveTool(null); }} />

      <main className="flex-1 pt-20 pr-24 pl-4 pb-4 h-full overflow-hidden flex flex-col relative">
        {isProcessing && (
            <div className="absolute inset-0 z-[100] bg-black/60 flex items-center justify-center backdrop-blur-sm">
                <div className="bg-stone-800 p-6 rounded-xl border border-white/10 flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
                    <span className="text-stone-200 font-medium">{processingMessage}</span>
                </div>
            </div>
        )}
        {!pdfDoc && (
          <div className="flex-1 flex flex-col items-center justify-center text-stone-500">
             <label className="cursor-pointer group flex flex-col items-center">
                <div className="w-24 h-24 bg-stone-800 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 shadow-lg">
                  <Download className="w-10 h-10 text-stone-400 group-hover:text-stone-200" />
                </div>
                <h2 className="text-2xl font-bold text-stone-300 mb-2">Open PDF Document</h2>
                <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} />
             </label>
          </div>
        )}

        {pdfDoc && mode !== AppMode.PAGES && (
          <div className="flex-1 flex gap-4 overflow-hidden relative">
            <div className="w-48 overflow-y-auto hidden lg:block pr-2 custom-scrollbar flex-shrink-0">
               {pages.map((p, idx) => (
                 <div key={p.id} onClick={() => { 
                     setSelectedPageIndex(idx);
                     document.getElementById(`page-${idx}`)?.scrollIntoView({ behavior: 'smooth' });
                 }} className={`p-2 mb-2 rounded cursor-pointer text-sm font-medium hover:bg-white/5 ${selectedPageIndex === idx ? 'bg-white/10 text-brand-blue' : 'text-stone-500'}`}>Page {idx + 1}</div>
               ))}
            </div>

            <div ref={scrollContainerRef} className="flex-1 bg-stone-900/50 rounded-xl overflow-y-auto flex justify-center relative shadow-inner border border-white/5 custom-scrollbar">
              <div className="py-8 min-h-full">
                {pages.map((page, idx) => (
                  <div key={page.id} id={`page-${idx}`} className="relative">
                      <PDFPage 
                        pdfDoc={pdfDoc}
                        pageNumber={page.originalIndex}
                        visualIndex={idx} // CRITICAL FIX: Pass visual index
                        rotation={page.rotation}
                        scale={scale} 
                        annotations={annotations.filter(a => a.pageIndex === idx)}
                        selectedAnnotationId={selectedAnnotationId}
                        onMouseDown={handlePageMouseDown}
                        onMouseMove={handlePageMouseMove}
                        onAnnotationChange={updateAnnotation}
                        isToolActive={!!activeTool} 
                      />
                      {interactionState.type === 'drawing' && interactionState.pageIndex === idx && (
                          <div className="absolute inset-0 pointer-events-none z-50">
                             <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <path d={`M ${currentPath.map(p => `${p.x} ${p.y}`).join(' L ')}`} stroke="#81C995" strokeWidth={0.5} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
                             </svg>
                          </div>
                      )}
                  </div>
                ))}
              </div>
              
              <div className="fixed bottom-8 right-8 flex gap-2 z-50">
                  <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-2 bg-stone-800 text-stone-200 rounded-full shadow-lg hover:bg-stone-700"><ZoomOut size={20}/></button>
                  <span className="px-3 py-2 bg-stone-800 text-stone-200 rounded-full shadow-lg font-mono text-xs flex items-center">{Math.round(scale * 100)}%</span>
                  <button onClick={() => setScale(s => Math.min(4, s + 0.25))} className="p-2 bg-stone-800 text-stone-200 rounded-full shadow-lg hover:bg-stone-700"><ZoomIn size={20}/></button>
              </div>
            </div>

            {mode === AppMode.EDIT && selectedAnnotationId && (
                <div className="absolute top-4 right-4 w-64 bg-stone-800/95 backdrop-blur border border-white/10 p-4 rounded-xl shadow-2xl flex flex-col gap-4 z-50 animate-in fade-in slide-in-from-right-4">
                     <div className="flex justify-between items-center border-b border-white/10 pb-2">
                        <span className="text-xs font-bold text-stone-400 uppercase">Properties</span>
                        <button onClick={() => setSelectedAnnotationId(null)} className="text-stone-500 hover:text-white"><X size={14}/></button>
                    </div>
                    {getSelectedAnnotation()?.type !== 'ocr_text' && (
                        <>
                            <div className="flex items-center justify-between">
                                <label className="text-sm text-stone-300 flex items-center gap-2"><Palette size={14}/> Color</label>
                                <input type="color" value={getSelectedAnnotation()?.color || '#000000'} onChange={(e) => updateAnnotation(selectedAnnotationId, { color: e.target.value })} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"/>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm text-stone-300">Size / Opacity</label>
                                <input type="range" min="1" max="50" value={(getSelectedAnnotation()?.type === 'text' ? getSelectedAnnotation()?.fontSize : getSelectedAnnotation()?.strokeWidth) || 12} onChange={(e) => updateAnnotation(selectedAnnotationId, { fontSize: parseInt(e.target.value), strokeWidth: parseInt(e.target.value) })} className="w-full h-1 bg-stone-600 rounded-lg accent-brand-purple mb-2"/>
                                <input type="range" min="0" max="1" step="0.1" value={getSelectedAnnotation()?.opacity || 1} onChange={(e) => updateAnnotation(selectedAnnotationId, { opacity: parseFloat(e.target.value) })} className="w-full h-1 bg-stone-600 rounded-lg accent-brand-purple"/>
                            </div>
                        </>
                    )}
                     <button onClick={() => { setAnnotations(prev => prev.filter(a => a.id !== selectedAnnotationId)); setSelectedAnnotationId(null); }} className="mt-2 w-full py-2 bg-red-900/30 text-red-400 border border-red-900/50 rounded-lg hover:bg-red-900/50 flex items-center justify-center gap-2 text-sm"><Trash2 size={14}/> Delete</button>
                </div>
            )}

            {mode === AppMode.EDIT && !selectedAnnotationId && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-stone-800/90 backdrop-blur border border-white/10 p-2 rounded-full shadow-lg flex gap-2 z-50">
                {[
                  { id: 'highlight', icon: Highlighter, color: 'text-yellow-400', label: 'Highlight' },
                  { id: 'freehand', icon: Pen, color: 'text-brand-green', label: 'Freehand' },
                  { id: 'text', icon: Type, color: 'text-stone-200', label: 'Text' },
                  { id: 'rect', icon: Square, color: 'text-brand-purple', label: 'Rectangle' },
                  { id: 'comment', icon: MessageSquare, color: 'text-brand-yellow', label: 'Note' },
                ].map((tool) => (
                  <button key={tool.id} title={tool.label} onClick={(e) => { e.stopPropagation(); setActiveTool(tool.id as any); setSelectedAnnotationId(null); }} className={`p-3 rounded-full hover:bg-white/10 transition-all ${activeTool === tool.id ? 'bg-white/20 ring-1 ring-white/30 scale-110' : ''}`}>
                    <tool.icon size={20} className={tool.color} />
                  </button>
                ))}
              </div>
            )}

             {mode === AppMode.OCR && (
                <div className="w-80 bg-stone-800 rounded-xl shadow-lg border border-white/10 p-6 flex flex-col gap-4 animate-in slide-in-from-right-10 absolute right-4 top-4 z-50">
                    <h3 className="text-brand-blue font-bold flex items-center gap-2"><ScanText size={20} /> Smart OCR</h3>
                     <p className="text-xs text-stone-400">Scan current page ({selectedPageIndex + 1}) to make text selectable.</p>
                     <button onClick={handleRunOCR} disabled={isProcessing} className="w-full py-3 bg-brand-blue/90 text-stone-900 rounded-lg shadow hover:bg-brand-blue disabled:opacity-50 font-medium transition-colors"> 
                        {isProcessing ? 'Scanning...' : 'Extract Text Overlay'} 
                     </button>
                </div>
            )}

             {mode === AppMode.COMPRESS && (
               <div className="w-80 bg-stone-800 rounded-xl shadow-lg border border-white/10 p-6 flex flex-col gap-6 animate-in slide-in-from-right-10 absolute right-4 top-4 z-50">
                 <h3 className="text-brand-green font-bold flex items-center gap-2"><Download size={20} /> Optimization</h3>
                 <div className="space-y-4">
                    <div className="flex justify-between text-sm text-stone-300">
                        <span>Smaller File</span>
                        <span>Better Quality</span>
                    </div>
                    <label className="text-sm font-medium text-stone-300">Quality Level: {compressionLevel}</label>
                    <input type="range" min="1" max="10" value={compressionLevel} onChange={(e) => setCompressionLevel(parseInt(e.target.value))} className="w-full accent-brand-green mt-2 h-2 bg-stone-600 rounded-lg appearance-none cursor-pointer"/>
                    <p className="text-xs text-stone-500">This will rasterize pages to images and rebuild the PDF.</p>
                    <button onClick={handleCompress} disabled={isProcessing} className="w-full py-3 bg-brand-green/90 text-stone-900 rounded-lg shadow hover:bg-brand-green transition-all font-medium">
                        {isProcessing ? 'Compressing...' : 'Apply Compression'}
                    </button>
                 </div>
               </div>
            )}
          </div>
        )}

        {/* Pages Grid Mode (Page Editor) */}
        {pdfDoc && mode === AppMode.PAGES && (
            <div className="flex-1 flex flex-col relative h-full">
                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-8 animate-in fade-in custom-scrollbar">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {pages.map((page, index) => (
                        <div key={page.id} className="relative group">
                            <PageThumbnail 
                            pdfDoc={pdfDoc} 
                            pageNumber={page.originalIndex} 
                            rotation={page.rotation} 
                            isSelected={selectedPageIndex === index} 
                            onClick={() => setSelectedPageIndex(index)} 
                            onDragStart={(e) => handleDragStart(e, index)} 
                            onDragOver={(e) => handleDragOver(e, index)} 
                            onDrop={(e) => handleDrop(e, index)} 
                            />
                            <div className="absolute top-2 left-2 bg-stone-950/80 text-white w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold pointer-events-none border border-white/10">{index + 1}</div>
                        </div>
                        ))}
                    </div>
                </div>

                {/* Page Action Bar */}
                <div className="h-16 glass-panel border-t border-white/5 flex items-center justify-center gap-6 px-4 shrink-0 z-50">
                     <div className="flex items-center gap-2">
                         <button onClick={() => handleRotatePage('left')} className="p-2 rounded hover:bg-white/10 text-stone-300 flex flex-col items-center gap-1 group" title="Rotate Left">
                             <RotateCcw size={18} className="group-hover:text-brand-purple"/>
                             <span className="text-[10px]">Rot. L</span>
                         </button>
                         <button onClick={() => handleRotatePage('right')} className="p-2 rounded hover:bg-white/10 text-stone-300 flex flex-col items-center gap-1 group" title="Rotate Right">
                             <RotateCw size={18} className="group-hover:text-brand-purple"/>
                             <span className="text-[10px]">Rot. R</span>
                         </button>
                     </div>
                     <div className="w-[1px] h-8 bg-white/10"></div>
                     <div className="flex items-center gap-2">
                        <label className="p-2 rounded hover:bg-white/10 text-stone-300 flex flex-col items-center gap-1 group cursor-pointer" title="Insert PDF">
                            <FilePlus size={18} className="group-hover:text-brand-green"/>
                            <span className="text-[10px]">Insert</span>
                            <input type="file" accept="application/pdf" className="hidden" onChange={handleInsertFile} />
                        </label>
                        <button onClick={handleExtractPage} className="p-2 rounded hover:bg-white/10 text-stone-300 flex flex-col items-center gap-1 group" title="Extract Page">
                             <Split size={18} className="group-hover:text-brand-blue"/>
                             <span className="text-[10px]">Extract</span>
                         </button>
                     </div>
                     <div className="w-[1px] h-8 bg-white/10"></div>
                     <button onClick={handleDeletePage} className="p-2 rounded hover:bg-red-900/20 text-stone-300 flex flex-col items-center gap-1 group" title="Delete Page">
                         <Trash2 size={18} className="group-hover:text-red-400"/>
                         <span className="text-[10px] group-hover:text-red-400">Delete</span>
                     </button>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}

export default App;