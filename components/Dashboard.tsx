
import React, { useEffect, useState, useRef } from 'react';
import { Download, FileText, Clock, XCircle, Loader2, FolderOpen, Settings, Globe, Moon, Sun, Copy, Database, Minimize2, ScanText, Trash2, FileCode, Eye, UploadCloud, Archive } from 'lucide-react';
import { DB } from '../utils/db';
import { useLanguage } from '../contexts/LanguageContext';
import { languages, LanguageCode } from '../locales/translations';
import { AppMode } from '../types';
import { ProjectHandler } from '../utils/projectHandler';
import { ColorBlindMode } from './VisualFilters';
import { DataHandler } from '../utils/dataHandler';

interface DashboardProps {
  onFileSelect: (file: File) => void;
  onRecentSelect: (fileRecord: any, mode?: AppMode) => void;
  isHighContrast: boolean;
  onToggleContrast: () => void;
  isNightMode: boolean;
  onToggleNightMode: () => void;
  colorBlindMode: ColorBlindMode;
  onSetColorBlindMode: (mode: ColorBlindMode) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
    onFileSelect, onRecentSelect, 
    isHighContrast, onToggleContrast,
    isNightMode, onToggleNightMode,
    colorBlindMode, onSetColorBlindMode
}) => {
  const [recentFiles, setRecentFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, file: any } | null>(null);
  const [isDataProcessing, setIsDataProcessing] = useState(false);
  const { t, language, setLanguage } = useLanguage();

  const loadRecents = async () => {
      setIsLoading(true);
      try {
        const files = await DB.getFiles();
        setRecentFiles(files);
      } catch (e) {
          console.error("Failed to load recents", e);
      } finally {
        setIsLoading(false);
      }
  };

  useEffect(() => {
    loadRecents();
  }, []);

  // Format Bytes to readable string
  const formatBytes = (bytes: number, decimals = 2) => {
      if (!+bytes) return '0 Bytes';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MiB', 'GiB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const handleContextMenu = (e: React.MouseEvent, file: any) => {
      e.preventDefault();
      // Adjust position to not go off-screen roughly
      const x = Math.min(e.clientX, window.innerWidth - 220);
      const y = Math.min(e.clientY, window.innerHeight - 300);
      setContextMenu({ x, y, file });
  };

  const closeContextMenu = () => setContextMenu(null);

  // --- Context Menu Actions ---

  const handleCopy = async () => {
      if (!contextMenu?.file) return;
      const file = contextMenu.file;
      const newFile = { 
          ...file, 
          id: `pdf-${Date.now()}`, 
          name: `${file.name} (Copy)`, 
          lastModified: Date.now() 
      };
      await DB.saveFile(newFile);
      loadRecents();
      closeContextMenu();
  };

  const handleDownload = () => {
      if (!contextMenu?.file) return;
      const blob = new Blob([contextMenu.file.file], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = contextMenu.file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      closeContextMenu();
  };

  const handleExportProject = async () => {
      if (!contextMenu?.file) return;
      await ProjectHandler.exportProject(contextMenu.file);
      closeContextMenu();
  };

  const handleCompress = () => {
      if (!contextMenu?.file) return;
      onRecentSelect(contextMenu.file, AppMode.COMPRESS);
      closeContextMenu();
  };

  const handleOCR = () => {
      if (!contextMenu?.file) return;
      onRecentSelect(contextMenu.file, AppMode.OCR);
      closeContextMenu();
  };

  const handleDeleteFromMenu = async () => {
      if (!contextMenu?.file) return;
      await DB.deleteFile(contextMenu.file.id);
      loadRecents();
      closeContextMenu();
  };

  const colorBlindOptions: { id: ColorBlindMode, label: string }[] = [
      { id: 'none', label: t('cb_none') },
      { id: 'protanopia', label: t('cb_protanopia') },
      { id: 'deuteranopia', label: t('cb_deuteranopia') },
      { id: 'tritanopia', label: t('cb_tritanopia') },
      { id: 'achromatopsia', label: t('cb_achromatopsia') },
  ];

  const handleExportData = async () => {
      setIsDataProcessing(true);
      await DataHandler.exportData();
      setIsDataProcessing(false);
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.[0]) return;
      setIsDataProcessing(true);
      const success = await DataHandler.importData(e.target.files[0]);
      if (success) {
          alert(t('importSuccess'));
          window.location.reload(); // Reload to apply settings/files
      } else {
          alert(t('importFail'));
      }
      setIsDataProcessing(false);
      e.target.value = ''; // Reset input
  };

  return (
    <div 
        className="flex-1 flex flex-col items-center p-8 pb-24 md:pb-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500 relative"
        onClick={closeContextMenu} // Close menu on click elsewhere
    >
        
        {/* Context Menu */}
        {contextMenu && (
            <div 
                className="fixed z-[100] bg-stone-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden w-64 animate-in fade-in zoom-in-95 duration-100"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
                {/* Header info */}
                <div className="bg-stone-800/50 p-3 border-b border-white/5">
                    <h4 className="text-stone-300 font-bold truncate text-sm">{contextMenu.file.name}</h4>
                    <span className="text-xs text-stone-500 font-mono">
                        {formatBytes(contextMenu.file.file.byteLength)}
                    </span>
                </div>
                
                <div className="p-1">
                     <button onClick={handleCopy} className="w-full flex items-center gap-3 px-3 py-2 text-stone-300 hover:bg-white/10 rounded-lg text-sm transition-colors text-left group">
                        <Copy size={16} className="text-stone-400 group-hover:text-white" />
                        {t('copy')}
                    </button>
                    <button onClick={handleDownload} className="w-full flex items-center gap-3 px-3 py-2 text-stone-300 hover:bg-white/10 rounded-lg text-sm transition-colors text-left group">
                        <Download size={16} className="text-stone-400 group-hover:text-white" />
                        {t('download')}
                    </button>
                    <button onClick={handleExportProject} className="w-full flex items-center gap-3 px-3 py-2 text-stone-300 hover:bg-white/10 rounded-lg text-sm transition-colors text-left group">
                        <FileCode size={16} className="text-brand-yellow group-hover:text-white" />
                        {t('exportProject')}
                    </button>
                    
                    <div className="h-[1px] bg-white/10 my-1 mx-2" />
                    
                    <button onClick={handleCompress} className="w-full flex items-center gap-3 px-3 py-2 text-stone-300 hover:bg-white/10 rounded-lg text-sm transition-colors text-left group">
                        <Minimize2 size={16} className="text-brand-green" />
                        {t('compress')}
                    </button>
                    <button onClick={handleOCR} className="w-full flex items-center gap-3 px-3 py-2 text-stone-300 hover:bg-white/10 rounded-lg text-sm transition-colors text-left group">
                        <ScanText size={16} className="text-brand-blue" />
                        {t('ocr')}
                    </button>
                    
                    <div className="h-[1px] bg-white/10 my-1 mx-2" />
                    
                    <button onClick={handleDeleteFromMenu} className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-red-900/20 rounded-lg text-sm transition-colors text-left group">
                        <Trash2 size={16} />
                        {t('delete')}
                    </button>
                </div>
            </div>
        )}

        {/* Header Section */}
        <div className="flex flex-col items-center justify-center min-h-[40vh] w-full">
            <label className="cursor-pointer group flex flex-col items-center mb-8 relative">
                <div className="w-28 h-28 bg-stone-800 rounded-[2rem] flex items-center justify-center mb-6 group-hover:scale-110 transition-all shadow-2xl border border-white/10 relative z-10">
                    <Download className="w-12 h-12 text-brand-blue group-hover:text-white transition-colors" />
                </div>
                <div className="absolute inset-0 bg-brand-blue/20 blur-3xl rounded-full opacity-0 group-hover:opacity-50 transition-opacity" />
                
                <h2 className="text-4xl font-black text-stone-100 mb-2 tracking-tight">{t('appName')}</h2>
                <p className="text-stone-500 font-medium">{t('subTitle')}</p>
                <input 
                    type="file" 
                    accept="application/pdf,.epdf" 
                    className="hidden" 
                    onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])} 
                />
            </label>
        </div>

        {/* Files Section */}
        {isLoading ? (
            <Loader2 className="animate-spin text-stone-600 mb-12" />
        ) : recentFiles.length > 0 ? (
            <div className="w-full max-w-4xl mb-16">
                <div className="flex items-center gap-2 mb-6 text-stone-500 uppercase text-xs font-bold tracking-[0.2em] border-b border-white/5 pb-4">
                    <Clock size={14} /> {t('persistentLib')}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {recentFiles.map(file => (
                    <div 
                        key={file.id} 
                        onClick={() => onRecentSelect(file)} 
                        onContextMenu={(e) => handleContextMenu(e, file)}
                        className="group relative flex flex-col bg-stone-900/40 hover:bg-stone-800/80 border border-white/5 hover:border-brand-blue/30 rounded-2xl cursor-pointer transition-all overflow-hidden p-4 shadow-lg hover:shadow-2xl"
                    >
                        <div className="aspect-[3/4] rounded-lg overflow-hidden mb-4 bg-stone-950 border border-white/10 relative">
                            {file.preview ? (
                                <img 
                                    src={file.preview} 
                                    alt="" 
                                    className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity scale-100 group-hover:scale-105 duration-500" 
                                    style={{ filter: isHighContrast ? 'invert(1) hue-rotate(180deg)' : 'none' }}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-stone-700">
                                    <FileText size={40} />
                                </div>
                            )}
                            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-[10px] font-mono text-white/70">
                                P. {file.lastPage + 1}
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-stone-200 font-bold truncate text-sm mb-1">{file.name}</h4>
                            <p className="text-stone-600 text-[10px] uppercase font-bold">{new Date(file.lastModified).toLocaleDateString()}</p>
                        </div>
                    </div>
                    ))}
                </div>
            </div>
        ) : (
            <div className="flex flex-col items-center text-stone-600 mb-16 animate-in fade-in slide-in-from-bottom-4">
                <FolderOpen className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium text-stone-500">{t('noRecentDocs')}</p>
                <p className="text-sm text-stone-700">{t('startPrompt')}</p>
            </div>
        )}

        {/* Settings Section */}
        <div className="w-full max-w-4xl border-t border-white/5 pt-8 mb-12">
            <div className="flex items-center gap-2 mb-6 text-stone-500 uppercase text-xs font-bold tracking-[0.2em]">
                <Settings size={14} /> {t('settings')}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Language Selector */}
                <div className="bg-stone-900/40 border border-white/5 rounded-2xl p-6 h-full">
                    <div className="flex items-center gap-3 mb-4 text-stone-300 font-medium">
                        <Globe size={18} /> {t('language')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {languages.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => setLanguage(lang.code)}
                                className={`
                                    px-3 py-2 rounded-lg text-xs font-medium text-left transition-all border
                                    ${language === lang.code 
                                        ? 'bg-brand-blue/20 border-brand-blue text-brand-blue' 
                                        : 'bg-stone-950 border-white/5 text-stone-500 hover:bg-white/5 hover:text-stone-300'}
                                `}
                            >
                                <span className="block text-sm">{lang.nativeName}</span>
                                <span className="text-[10px] opacity-70">{lang.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Appearance Settings */}
                <div className="bg-stone-900/40 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-3 mb-2 text-stone-300 font-medium">
                        <Eye size={18} /> {t('appearance')}
                    </div>
                    
                    {/* High Contrast */}
                    <button 
                        onClick={onToggleContrast}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                            isHighContrast 
                            ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' 
                            : 'bg-stone-950 border-white/5 text-stone-400 hover:bg-white/5 hover:text-stone-200'
                        }`}
                    >
                        <span className="font-bold text-sm flex items-center gap-2">{isHighContrast ? <Sun size={14}/> : <Moon size={14}/>} {t('highContrast')}</span>
                        <div className={`w-8 h-5 rounded-full p-0.5 transition-colors ${isHighContrast ? 'bg-yellow-500' : 'bg-stone-700'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isHighContrast ? 'translate-x-3' : ''}`} />
                        </div>
                    </button>

                    {/* Night Mode */}
                    <button 
                        onClick={onToggleNightMode}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                            isNightMode 
                            ? 'bg-orange-500/20 border-orange-500 text-orange-400' 
                            : 'bg-stone-950 border-white/5 text-stone-400 hover:bg-white/5 hover:text-stone-200'
                        }`}
                    >
                        <span className="font-bold text-sm flex items-center gap-2"><Moon size={14}/> {t('nightMode')}</span>
                        <div className={`w-8 h-5 rounded-full p-0.5 transition-colors ${isNightMode ? 'bg-orange-500' : 'bg-stone-700'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isNightMode ? 'translate-x-3' : ''}`} />
                        </div>
                    </button>

                    {/* Color Blindness */}
                    <div className="w-full">
                        <label className="text-xs font-bold text-stone-500 uppercase mb-2 block">{t('colorBlindness')}</label>
                        <select 
                            value={colorBlindMode}
                            onChange={(e) => onSetColorBlindMode(e.target.value as ColorBlindMode)}
                            className="w-full p-3 bg-stone-950 border border-white/5 rounded-xl text-stone-300 text-sm outline-none focus:border-brand-blue"
                        >
                            {colorBlindOptions.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Data Management */}
                <div className="bg-stone-900/40 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-3 mb-2 text-stone-300 font-medium">
                        <Database size={18} /> {t('dataManagement')}
                    </div>
                    
                    <button 
                        onClick={handleExportData}
                        disabled={isDataProcessing}
                        className="w-full flex items-center justify-between p-3 rounded-xl border border-white/5 bg-stone-950 text-stone-400 hover:bg-white/5 hover:text-stone-200 transition-all"
                    >
                        <span className="font-bold text-sm flex items-center gap-2"><Archive size={14}/> {t('exportData')}</span>
                        {isDataProcessing && <Loader2 size={14} className="animate-spin" />}
                    </button>

                    <label 
                        className={`w-full flex items-center justify-between p-3 rounded-xl border border-white/5 bg-stone-950 text-stone-400 hover:bg-white/5 hover:text-stone-200 transition-all cursor-pointer ${isDataProcessing ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                        <span className="font-bold text-sm flex items-center gap-2"><UploadCloud size={14}/> {t('importData')}</span>
                        {isDataProcessing && <Loader2 size={14} className="animate-spin" />}
                        <input type="file" accept=".zip" className="hidden" onChange={handleImportData} disabled={isDataProcessing} />
                    </label>
                </div>
            </div>
        </div>
    </div>
  );
};
