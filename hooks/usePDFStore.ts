
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Annotation, PDFPageData } from '../types';
import { DB } from '../utils/db';

export interface PDFStore {
  pdfDoc: any;
  currentFile: any;
  pages: PDFPageData[];
  annotations: Annotation[];
  isProcessing: boolean;
  processingMessage: string;
  loadPDF: (data: Uint8Array, name: string, savedState?: any) => Promise<void>;
  updateAnnotation: (id: string, newProps: Partial<Annotation>) => void;
  addAnnotation: (ann: Annotation) => void;
  deleteAnnotation: (id: string) => void;
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  updatePageRotation: (pageIndex: number, direction: 'left' | 'right') => void;
  deletePage: (pageIndex: number) => void;
  movePage: (dragIndex: number, hoverIndex: number) => void;
  updateViewState: (visualPageIndex: number, scrollX: number, scrollY: number) => void;
  saveToDB: () => Promise<void>;
  closeDocument: () => Promise<void>;
  exportPDF: () => Promise<void>;
  extractPage: (pageIndex: number) => Promise<void>;
  insertFile: (file: File) => Promise<void>;
  insertBlankPage: () => Promise<void>;
  saveSelectionAsNewFile: (pageIndex: number, rect: { x: number, y: number, w: number, h: number }) => Promise<void>;
  setIsProcessing: (loading: boolean, msg?: string) => void;
}

export const usePDFStore = (): PDFStore => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentFile, setCurrentFile] = useState<any>(null);
  const [pages, setPages] = useState<PDFPageData[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  const stateRef = useRef({ currentFile: null as any, pages: [], annotations: [] });

  useEffect(() => {
    stateRef.current.pages = pages;
    stateRef.current.annotations = annotations;
    if (currentFile) {
        stateRef.current.currentFile = { ...currentFile, pages, annotations };
    }
  }, [pages, annotations, currentFile]);

  const setIsProcessingState = useCallback((loading: boolean, msg: string = '') => {
      setIsProcessing(loading);
      setProcessingMessage(msg);
  }, []);

  const generatePreview = async (pdf: any): Promise<string> => {
    try {
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.5);
    } catch(e) {
        return '';
    }
  };

  const loadPDF = useCallback(async (data: Uint8Array, name: string, savedState: any = null) => {
    setIsProcessingState(true, 'Loading Document...');
    try {
      const pdfData = data.slice(0);
      const loadingTask = window.pdfjsLib.getDocument({ data: pdfData });
      
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);

      const fileId = savedState?.id || `pdf-${Date.now()}`;
      
      let loadedPages = savedState?.pages;
      if (!loadedPages) {
          loadedPages = Array.from({ length: pdf.numPages }, (_, i) => ({
            id: `p-${Date.now()}-${i}`,
            originalIndex: i + 1,
            rotation: 0
          }));
      }
      setPages(loadedPages);

      const loadedAnnotations = savedState?.annotations || [];
      setAnnotations(loadedAnnotations);

      const preview = savedState?.preview || await generatePreview(pdf);
      
      const fileRecord = {
        id: fileId,
        name,
        file: data,
        preview,
        pages: loadedPages,
        annotations: loadedAnnotations,
        lastPage: savedState?.lastPage || 0,
        scrollX: savedState?.scrollX || 0,
        scrollY: savedState?.scrollY || 0,
        lastModified: Date.now()
      };
      
      setCurrentFile(fileRecord);
      stateRef.current.currentFile = fileRecord;

    } catch (e) {
      console.error(e);
      alert("Failed to load PDF. Please try another file.");
    } finally {
      setIsProcessingState(false);
    }
  }, []);

  const updateAnnotation = useCallback((id: string, newProps: Partial<Annotation>) => {
    setAnnotations(prev => prev.map(ann => ann.id === id ? { ...ann, ...newProps } : ann));
  }, []);

  const addAnnotation = useCallback((ann: Annotation) => {
    setAnnotations(prev => [...prev, ann]);
  }, []);

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  }, []);

  const updatePageRotation = useCallback((pageIndex: number, direction: 'left' | 'right') => {
      setPages(prev => prev.map((p, idx) => {
          if (idx !== pageIndex) return p;
          const delta = direction === 'left' ? -90 : 90;
          let newRot = (p.rotation + delta) % 360;
          if (newRot < 0) newRot += 360;
          return { ...p, rotation: newRot };
      }));
  }, []);

  const deletePage = useCallback((pageIndex: number) => {
      setPages(prev => prev.filter((_, idx) => idx !== pageIndex));
      setAnnotations(prev => prev.filter(a => a.pageIndex !== pageIndex));
      setAnnotations(prev => prev.map(a => {
          if (a.pageIndex > pageIndex) {
              return { ...a, pageIndex: a.pageIndex - 1 };
          }
          return a;
      }));
  }, []);

  const movePage = useCallback((dragIndex: number, hoverIndex: number) => {
      setPages(prev => {
          const newPages = [...prev];
          const [removed] = newPages.splice(dragIndex, 1);
          newPages.splice(hoverIndex, 0, removed);
          return newPages;
      });
  }, []);

  const updateViewState = useCallback((visualPageIndex: number, scrollX: number, scrollY: number) => {
      setCurrentFile((prev: any) => {
          if (!prev) return null;
          return { ...prev, lastPage: visualPageIndex, scrollX, scrollY };
      });
  }, []);

  const saveToDB = useCallback(async () => {
      const fileToSave = stateRef.current.currentFile;
      if (!fileToSave) return;
      
      const updatedRecord = {
          ...fileToSave,
          pages: stateRef.current.pages,
          annotations: stateRef.current.annotations,
          lastModified: Date.now()
      };
      
      try {
          stateRef.current.currentFile = updatedRecord;
          await DB.saveFile(updatedRecord);
          console.log(`[AutoSave] File ${updatedRecord.name} saved.`);
      } catch (e) {
          console.error("Failed to save state:", e);
      }
  }, []);

  const closeDocument = useCallback(async () => {
      setIsProcessingState(true, "Saving & Closing...");
      await saveToDB();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setPdfDoc(null);
      setCurrentFile(null);
      setPages([]);
      setAnnotations([]);
      stateRef.current = { currentFile: null, pages: [], annotations: [] };
      setIsProcessingState(false);
  }, [saveToDB]);

  // --- PDF BAKING & UTILS ---

  const createBakedPDF = async () => {
      const fileRecord = stateRef.current.currentFile;
      const currentPages = stateRef.current.pages;
      
      if (!fileRecord || !window.PDFLib) return null;
      const { PDFDocument, degrees } = window.PDFLib;
      const originalPdf = await PDFDocument.load(fileRecord.file);
      const newPdf = await PDFDocument.create();

      for (let i = 0; i < currentPages.length; i++) {
          const pageData = currentPages[i];
          const [copiedPage] = await newPdf.copyPages(originalPdf, [pageData.originalIndex - 1]);
          copiedPage.setRotation(degrees(pageData.rotation));
          newPdf.addPage(copiedPage);
      }
      return await newPdf.save();
  };

  const extractPage = useCallback(async (pageIndex: number) => {
      const fileRecord = stateRef.current.currentFile;
      const currentPages = stateRef.current.pages;
      if (!fileRecord || !window.PDFLib) return;
      setIsProcessingState(true, "Extracting Page...");
      try {
          const { PDFDocument, degrees } = window.PDFLib;
          const originalPdf = await PDFDocument.load(fileRecord.file);
          const newPdf = await PDFDocument.create();
          const pageData = currentPages[pageIndex];
          const [copiedPage] = await newPdf.copyPages(originalPdf, [pageData.originalIndex - 1]);
          copiedPage.setRotation(degrees(pageData.rotation));
          newPdf.addPage(copiedPage);
          const pdfBytes = await newPdf.save();
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `page_${pageIndex + 1}_${fileRecord.name}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (e) {
          console.error(e);
          alert("Could not extract page.");
      } finally {
          setIsProcessingState(false);
      }
  }, []);

  const insertFile = useCallback(async (file: File) => {
      const fileRecord = stateRef.current.currentFile;
      if (!fileRecord || !window.PDFLib) return;
      setIsProcessingState(true, "Merging PDF...");
      try {
          const { PDFDocument } = window.PDFLib;
          const currentBytes = await createBakedPDF();
          if (!currentBytes) throw new Error("Failed to process current file");
          const mainPdf = await PDFDocument.load(currentBytes);
          const appendBytes = new Uint8Array(await file.arrayBuffer());
          const appendPdf = await PDFDocument.load(appendBytes);
          const appendIndices = appendPdf.getPageIndices();
          const copiedPages = await mainPdf.copyPages(appendPdf, appendIndices);
          copiedPages.forEach((page: any) => mainPdf.addPage(page));
          const newBytes = await mainPdf.save();
          await loadPDF(newBytes, fileRecord.name, { id: fileRecord.id, annotations: stateRef.current.annotations });
      } catch (e) {
          console.error(e);
          alert("Could not merge PDF.");
      } finally {
          setIsProcessingState(false);
      }
  }, [loadPDF]);

  const insertBlankPage = useCallback(async () => {
    const fileRecord = stateRef.current.currentFile;
    if (!fileRecord || !window.PDFLib) return;
    setIsProcessingState(true, "Inserting Blank Page...");
    try {
        const { PDFDocument } = window.PDFLib;
        const currentBytes = await createBakedPDF();
        if (!currentBytes) throw new Error("Failed to process current file");
        const pdfDoc = await PDFDocument.load(currentBytes);
        pdfDoc.addPage();
        const newBytes = await pdfDoc.save();
        await loadPDF(newBytes, fileRecord.name, { id: fileRecord.id, annotations: stateRef.current.annotations });
    } catch (e) {
        console.error(e);
        alert("Could not insert page.");
    } finally {
        setIsProcessingState(false);
    }
  }, [loadPDF]);

  const saveSelectionAsNewFile = useCallback(async (pageIndex: number, rect: { x: number, y: number, w: number, h: number }) => {
      const fileRecord = stateRef.current.currentFile;
      const currentPages = stateRef.current.pages;
      if (!fileRecord || !window.PDFLib) return;
      setIsProcessingState(true, "Saving Selection...");
      try {
          const { PDFDocument, degrees } = window.PDFLib;
          const originalPdf = await PDFDocument.load(fileRecord.file);
          const newPdf = await PDFDocument.create();
          const pageData = currentPages[pageIndex];
          const [copiedPage] = await newPdf.copyPages(originalPdf, [pageData.originalIndex - 1]);
          copiedPage.setRotation(degrees(pageData.rotation));
          const { width, height } = copiedPage.getSize();
          const cropX = (rect.x / 100) * width;
          const cropW = (rect.w / 100) * width;
          const cropH = (rect.h / 100) * height;
          const cropY = height - ((rect.y / 100) * height) - cropH;
          copiedPage.setCropBox(cropX, cropY, cropW, cropH);
          copiedPage.setMediaBox(cropX, cropY, cropW, cropH);
          newPdf.addPage(copiedPage);
          const pdfBytes = await newPdf.save();
          const newId = `pdf-${Date.now()}`;
          const newName = `Selection_${fileRecord.name}`;
          const loadingTask = window.pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
          const tempPdf = await loadingTask.promise;
          const preview = await generatePreview(tempPdf);
          const newRecord = {
            id: newId, name: newName, file: pdfBytes, preview,
            pages: [{ id: `p-${Date.now()}-0`, originalIndex: 1, rotation: 0 }],
            annotations: [], lastPage: 0, scrollX: 0, scrollY: 0, lastModified: Date.now()
          };
          await DB.saveFile(newRecord);
          alert("Saved selection to library as: " + newName);
      } catch (e) {
          console.error(e);
          alert("Could not save selection.");
      } finally {
          setIsProcessingState(false);
      }
  }, []);

  // --- ADVANCED RASTERIZER FOR EXPORT ---
  // Renders HTML/Markdown/Latex to a PNG image to preserve visual fidelity (Vertical text, Lists, Math)
  const rasterizeAnnotation = (ann: Annotation, width: number, height: number): Promise<string | null> => {
      return new Promise((resolve) => {
          const canvas = document.createElement('canvas');
          // Double resolution for better quality in PDF
          const scale = 2;
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.scale(scale, scale);

          let content = ann.content || '';
          let styles = `
             width: 100%; height: 100%;
             color: ${ann.color};
             font-size: ${ann.fontSize || 16}px;
             font-family: sans-serif;
             overflow: hidden;
             display: flex;
             ${ann.vertical ? 'writing-mode: vertical-rl; text-orientation: upright;' : ''}
          `;

          // Latex Special Handling: Try to render to MathML for better embedding without external CSS
          if (ann.type === 'latex' && window.katex) {
               try {
                   content = window.katex.renderToString(content, {
                       throwOnError: false,
                       output: 'mathml', // Key change: Output MathML which renders well in foreignObject
                       displayMode: true
                   });
                   styles += ' align-items: center; justify-content: center;';
               } catch (e) {
                   content = `<div style="color:red">Math Error</div>`;
               }
          }

          // Specific styles to fix Markdown formatting in export
          const embeddedCss = `
            <style>
               h1 { font-size: 1.8em; font-weight: bold; margin: 0; line-height: 1.2; }
               h2 { font-size: 1.4em; font-weight: bold; margin: 0; line-height: 1.2; }
               ul { list-style-type: disc; margin-left: 1.2em; padding-left: 0; }
               ol { list-style-type: decimal; margin-left: 1.2em; padding-left: 0; }
               blockquote { border-left: 3px solid ${ann.color}; padding-left: 0.5em; opacity: 0.8; font-style: italic; }
               p { margin: 0; }
            </style>
          `;

          const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
             <foreignObject width="100%" height="100%">
               <div xmlns="http://www.w3.org/1999/xhtml" style="${styles}">
                  ${embeddedCss}
                  ${content}
               </div>
             </foreignObject>
          </svg>`;

          const img = new Image();
          img.onload = () => {
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = () => resolve(null);
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      });
  };

  const hexToRgb = (hex: string) => {
    try {
        if (!hex) return { r: 0, g: 0, b: 0 };
        const cleanHex = hex.replace('#', '');
        const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
        const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
        const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
        return { r: isNaN(r) ? 0 : r, g: isNaN(g) ? 0 : g, b: isNaN(b) ? 0 : b };
    } catch { return { r: 0, g: 0, b: 0 }; }
  };

  const exportPDF = useCallback(async () => {
      const fileRecord = stateRef.current.currentFile;
      const currentPages = stateRef.current.pages;
      const currentAnnotations = stateRef.current.annotations;
      
      if (!fileRecord || !window.PDFLib) return;

      setIsProcessingState(true, "Generating PDF...");

      try {
          const { PDFDocument, rgb, degrees, StandardFonts } = window.PDFLib;
          const originalPdf = await PDFDocument.load(fileRecord.file);
          const newPdf = await PDFDocument.create();
          const font = await newPdf.embedFont(StandardFonts.Helvetica);

          for (let i = 0; i < currentPages.length; i++) {
              const pageData = currentPages[i];
              const [copiedPage] = await newPdf.copyPages(originalPdf, [pageData.originalIndex - 1]);
              copiedPage.setRotation(degrees(pageData.rotation));
              newPdf.addPage(copiedPage);

              const pageAnns = currentAnnotations.filter(a => a.pageIndex === i);
              const { width, height } = copiedPage.getSize();

              for (const ann of pageAnns) {
                  try {
                      const x = (ann.x / 100) * width;
                      const w = (ann.width ? ann.width / 100 : 0) * width;
                      const h = (ann.height ? ann.height / 100 : 0) * height;
                      const y = height - ((ann.y / 100) * height) - h;

                      const { r, g, b } = hexToRgb(ann.color);
                      const color = rgb(r, g, b);

                      // --- TEXT / OCR / LATEX (Now Rasterized to preserve styles/math/vertical) ---
                      if (ann.type === 'text' || ann.type === 'ocr_text' || ann.type === 'latex') {
                          // Draw Background first if needed
                          if (ann.fill && ann.fill !== 'transparent') {
                              const f = hexToRgb(ann.fill);
                              copiedPage.drawRectangle({
                                  x, y, width: w, height: h,
                                  color: rgb(f.r, f.g, f.b),
                              });
                          }

                          // Rasterize the HTML content to an image
                          const imgDataUrl = await rasterizeAnnotation(ann, w > 0 ? w : 200, h > 0 ? h : 50);
                          if (imgDataUrl) {
                              const embeddedImage = await newPdf.embedPng(imgDataUrl);
                              copiedPage.drawImage(embeddedImage, {
                                  x, y, width: w, height: h
                              });
                          }
                      } 
                      // --- RECTANGLE / HIGHLIGHT ---
                      else if (ann.type === 'rect' || ann.type === 'highlight') {
                          let fillColor = undefined;
                          if (ann.type === 'highlight') fillColor = color;
                          else if (ann.fill && ann.fill !== 'transparent') {
                              const f = hexToRgb(ann.fill);
                              fillColor = rgb(f.r, f.g, f.b);
                          }
                          copiedPage.drawRectangle({
                              x, y, width: w, height: h,
                              color: fillColor,
                              borderColor: ann.type === 'rect' ? color : undefined,
                              borderWidth: ann.type === 'rect' ? (ann.strokeWidth || 2) : 0,
                              opacity: ann.opacity || 1
                          });
                      }
                      // --- FREEHAND ---
                      else if (ann.type === 'freehand' && ann.points && ann.points.length > 1) {
                          const pathPoints = ann.points.map(p => ({
                              x: (p.x / 100) * width,
                              y: height - ((p.y / 100) * height)
                          }));
                          for(let k=0; k < pathPoints.length - 1; k++) {
                              copiedPage.drawLine({
                                  start: pathPoints[k], end: pathPoints[k+1],
                                  thickness: (ann.strokeWidth || 4), color: color, opacity: ann.opacity || 1
                              });
                          }
                      }
                      // --- IMAGE ---
                      else if (ann.type === 'image' && ann.imageData) {
                          let embeddedImage;
                          if (ann.imageData.startsWith('data:image/png')) embeddedImage = await newPdf.embedPng(ann.imageData);
                          else if (ann.imageData.startsWith('data:image/jpeg') || ann.imageData.startsWith('data:image/jpg')) embeddedImage = await newPdf.embedJpg(ann.imageData);
                          
                          if (embeddedImage) {
                            copiedPage.drawImage(embeddedImage, { x, y, width: w, height: h });
                          }
                      }
                      // --- COMMENT ---
                      else if (ann.type === 'comment') {
                          const markerSize = 20;
                          copiedPage.drawRectangle({
                              x: (ann.x / 100) * width,
                              y: height - ((ann.y / 100) * height) - markerSize,
                              width: markerSize, height: markerSize,
                              color: color, borderColor: rgb(0,0,0), borderWidth: 1
                          });
                          copiedPage.drawText("!", {
                              x: (ann.x / 100) * width + 7,
                              y: height - ((ann.y / 100) * height) - 15,
                              size: 12, font: font, color: rgb(0,0,0)
                          });
                          if (ann.content) {
                              // Simplified text for sticky notes (no HTML)
                              const tmp = document.createElement("DIV");
                              tmp.innerHTML = ann.content;
                              const plainText = tmp.textContent || "";
                              copiedPage.drawText(plainText, {
                                  x: (ann.x / 100) * width + markerSize + 5,
                                  y: height - ((ann.y / 100) * height) - 15,
                                  size: 10, font: font, color: rgb(0,0,0)
                              });
                          }
                      }
                  } catch (annErr) {
                      console.warn(`Failed to export annotation ${ann.id}`, annErr);
                  }
              }
          }

          const pdfBytes = await newPdf.save();
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `edited_${fileRecord.name}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

      } catch (e) {
          console.error("Export failed", e);
          alert("Could not export PDF.");
      } finally {
          setIsProcessingState(false);
      }
  }, []);

  return {
    pdfDoc, currentFile, pages, annotations, isProcessing, processingMessage,
    loadPDF, updateAnnotation, addAnnotation, deleteAnnotation, setAnnotations,
    updatePageRotation, deletePage, movePage, updateViewState,
    saveToDB, closeDocument, exportPDF, extractPage, insertFile, insertBlankPage, saveSelectionAsNewFile,
    setIsProcessing: setIsProcessingState
  };
};
