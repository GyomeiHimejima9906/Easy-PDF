
import React, { useState, useEffect } from 'react';
import { setupPDFWorker } from './utils/pdfWorker';
import { TopBar } from './components/TopBar';
import { SideBar } from './components/SideBar';
import { Dashboard } from './components/Dashboard';
import { Editor } from './components/Editor';
import { PageManager } from './components/PageManager';
import { ToolsSidebar } from './components/ToolsSidebar';
import { AppMode } from './types';
import { usePDFStore } from './hooks/usePDFStore';
import { DB } from './utils/db';
import { Loader2, Sun, Moon, Accessibility } from 'lucide-react';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { ProjectHandler } from './utils/projectHandler';
import { VisualFilters, ColorBlindMode } from './components/VisualFilters';

setupPDFWorker();

function AppContent() {
  const [mode, setMode] = useState<AppMode>(AppMode.VIEW);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isNightMode, setIsNightMode] = useState(false);
  const [colorBlindMode, setColorBlindMode] = useState<ColorBlindMode>('none');
  const [scale, setScale] = useState(1.0);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(window.innerWidth >= 768);
  const [isAccessMenuOpen, setIsAccessMenuOpen] = useState(false);
  
  const { t } = useLanguage();

  // Use the Custom Hook (SRP: Logic is separated)
  const { 
    pdfDoc, currentFile, pages, annotations, isProcessing, processingMessage,
    loadPDF, updateAnnotation, addAnnotation, deleteAnnotation, 
    saveToDB, updateViewState, closeDocument, exportPDF, extractPage, insertFile, insertBlankPage,
    updatePageRotation, deletePage, movePage, setIsProcessing
  } = usePDFStore();

  // Settings Load
  useEffect(() => {
    DB.getSetting('isHighContrast').then(val => setIsHighContrast(!!val));
    DB.getSetting('isNightMode').then(val => setIsNightMode(!!val));
    DB.getSetting('colorBlindMode').then(val => { if (val) setColorBlindMode(val as ColorBlindMode); });
  }, []);

  // Auto-Save Timer (Every 5 Minutes)
  useEffect(() => {
      if (!pdfDoc) return;
      const timer = setInterval(() => {
          saveToDB();
      }, 5 * 60 * 1000); // 5 Minutes
      
      return () => clearInterval(timer);
  }, [pdfDoc, saveToDB]);

  const toggleContrast = () => {
      const newVal = !isHighContrast;
      setIsHighContrast(newVal);
      DB.setSetting('isHighContrast', newVal);
  };

  const toggleNightMode = () => {
      const newVal = !isNightMode;
      setIsNightMode(newVal);
      DB.setSetting('isNightMode', newVal);
  };

  const handleSetColorBlindMode = (newMode: ColorBlindMode) => {
      setColorBlindMode(newMode);
      DB.setSetting('colorBlindMode', newMode);
  };

  const handleFileSelect = async (file: File) => {
      // Check for .ePDF extension
      if (file.name.toLowerCase().endsWith('.epdf')) {
          setIsProcessing(true, t('importingProject'));
          const projectRecord = await ProjectHandler.importProject(file);
          if (projectRecord) {
              // Load the project record (it acts like a saved state)
              await loadPDF(projectRecord.file, projectRecord.name, projectRecord);
              // Save to DB immediately so it's in the library
              await DB.saveFile(projectRecord);
          }
          setIsProcessing(false);
      } else {
          // Standard PDF Load
          const data = new Uint8Array(await file.arrayBuffer());
          await loadPDF(data, file.name);
      }
  };

  const handleRecentSelect = async (fileRecord: any, targetMode?: AppMode) => {
      await loadPDF(fileRecord.file, fileRecord.name, fileRecord);
      if (targetMode) {
          setMode(targetMode);
      }
  };

  const handleCompress = async (quality: number) => {
     setIsProcessing(true, t('compressingPDF'));
     setTimeout(() => {
         setIsProcessing(false);
         alert(`${t('compressedMessage')} ${quality * 100}%. (Feature Simulated)`);
         setMode(AppMode.VIEW);
     }, 1500);
  };

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${isHighContrast ? 'bg-black' : 'bg-stone-950'}`}>
      {/* Global Visual Filters */}
      <VisualFilters mode={colorBlindMode} isNightMode={isNightMode} />

      <TopBar 
        fileName={currentFile?.name || null} 
        onUpload={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} 
        onSave={() => saveToDB()}
        onExport={() => exportPDF()} 
        onBack={() => closeDocument()}
        onMenuClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)} 
      />
      
      <SideBar currentMode={mode} setMode={setMode} />

      <main className="flex-1 pt-16 h-full overflow-hidden flex flex-row relative transition-all duration-300">
        {isProcessing && (
          <div className="absolute inset-0 z-[100] bg-black/80 flex items-center justify-center backdrop-blur-md">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-brand-blue animate-spin" />
                <span className="text-stone-300 font-medium">{processingMessage}</span>
            </div>
          </div>
        )}

        {!pdfDoc ? (
            <Dashboard 
                onFileSelect={handleFileSelect} 
                onRecentSelect={handleRecentSelect} 
                isHighContrast={isHighContrast}
                onToggleContrast={toggleContrast}
                isNightMode={isNightMode}
                onToggleNightMode={toggleNightMode}
                colorBlindMode={colorBlindMode}
                onSetColorBlindMode={handleSetColorBlindMode}
            />
        ) : (
            <>
                {/* Left Panel (Page Thumbnails in Edit/View/OCR) - Collapsible */}
                {/* Mobile: Absolute Overlay | Desktop: Relative Sidebar */}
                <div 
                    className={`
                        bg-stone-950/95 backdrop-blur-sm border-r border-white/5 overflow-y-auto custom-scrollbar shrink-0 transition-all duration-300 ease-in-out z-40
                        absolute h-full md:relative
                        /* COMPRESSED MODE ON MOBILE: w-36 instead of w-64 */
                        ${isLeftPanelOpen && mode !== AppMode.PAGES 
                            ? 'w-36 md:w-64 opacity-100 translate-x-0 shadow-2xl md:shadow-none' 
                            : 'w-0 opacity-0 -translate-x-full md:w-0 md:-translate-x-0 border-none pointer-events-none'}
                    `}
                >
                     <div className="p-4 text-xs text-stone-500 font-bold uppercase tracking-wider sticky top-0 bg-stone-950 z-10 whitespace-nowrap flex justify-between items-center">
                         <span>{t('pages')}</span>
                         {/* Close button for mobile */}
                         <button onClick={() => setIsLeftPanelOpen(false)} className="md:hidden text-stone-400 p-1">✕</button>
                     </div>
                     <div className="px-2 pb-4 space-y-2">
                         {pages.map((p, idx) => (
                             <button 
                                key={p.id}
                                onClick={() => {
                                    document.getElementById(`page-${idx}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                                    if (window.innerWidth < 768) setIsLeftPanelOpen(false); // Auto close on mobile
                                }}
                                className="w-full text-left px-3 py-3 md:px-4 rounded-lg hover:bg-white/5 text-stone-400 text-xs md:text-sm font-medium truncate transition-colors"
                             >
                                 {t('page')} {idx + 1}
                             </button>
                         ))}
                     </div>
                </div>
                
                {/* Overlay backdrop for mobile when panel is open */}
                {isLeftPanelOpen && window.innerWidth < 768 && (
                    <div 
                        className="absolute inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
                        onClick={() => setIsLeftPanelOpen(false)}
                    />
                )}
                
                {/* Main Content Area */}
                <div className="flex-1 relative h-full overflow-hidden flex">
                    {mode === AppMode.PAGES ? (
                        <PageManager 
                            pdfDoc={pdfDoc}
                            pages={pages}
                            onMovePage={movePage}
                            onRotatePage={updatePageRotation}
                            onDeletePage={deletePage}
                            onExtractPage={extractPage}
                            onInsertFile={insertFile}
                            onInsertBlankPage={insertBlankPage}
                            isHighContrast={isHighContrast}
                        />
                    ) : (
                        <Editor 
                            pdfDoc={pdfDoc}
                            pages={pages}
                            annotations={annotations}
                            mode={mode} // Editor now handles both EDIT and OCR modes
                            scale={scale}
                            setScale={setScale}
                            onAnnotationChange={updateAnnotation}
                            onAddAnnotation={addAnnotation}
                            onDeleteAnnotation={deleteAnnotation}
                            onScrollStateChange={(p, x, y) => updateViewState(p, x, y)} 
                            onAutoSaveTrigger={() => saveToDB()}
                            initialScrollState={currentFile ? { pageIndex: currentFile.lastPage, scrollX: currentFile.scrollX, scrollY: currentFile.scrollY } : undefined}
                            isHighContrast={isHighContrast}
                        />
                    )}
                </div>

                {/* Right Panel (Only for Compressor now) */}
                {mode === AppMode.COMPRESS && (
                    <ToolsSidebar 
                        mode={mode}
                        onClose={() => setMode(AppMode.VIEW)}
                        onCompress={handleCompress}
                    />
                )}
            </>
        )}

        {/* Accessibility FAB */}
        <div className="fixed bottom-6 left-6 z-[90]">
             {isAccessMenuOpen && (
                 <div className="mb-4 bg-stone-800 border border-white/10 p-2 rounded-xl shadow-2xl animate-in slide-in-from-bottom-2 flex flex-col gap-1 w-48">
                     <button onClick={toggleContrast} className="flex items-center gap-3 p-3 hover:bg-white/10 rounded-lg text-stone-200">
                         {isHighContrast ? <Sun size={18} /> : <Moon size={18} />}
                         <span className="text-xs font-bold whitespace-nowrap">{t('highContrast')}</span>
                     </button>
                     <button onClick={toggleNightMode} className="flex items-center gap-3 p-3 hover:bg-white/10 rounded-lg text-stone-200">
                         <Moon size={18} className="text-orange-400" />
                         <span className="text-xs font-bold whitespace-nowrap">{t('nightMode')}</span>
                     </button>
                 </div>
             )}
             <button onClick={() => setIsAccessMenuOpen(!isAccessMenuOpen)} className="w-12 h-12 bg-stone-800 text-white rounded-xl shadow-xl flex items-center justify-center border border-white/10 hover:bg-stone-700">
                 <Accessibility size={20} />
             </button>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
