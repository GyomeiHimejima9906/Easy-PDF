
import React, { useState } from 'react';
import { FileUp, Save, Menu, Check, CloudDownload, ChevronLeft } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface TopBarProps {
  fileName: string | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => Promise<void>;
  onExport: () => Promise<void>;
  onMenuClick: () => void;
  onBack?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ fileName, onUpload, onSave, onExport, onMenuClick, onBack }) => {
  const [isSaved, setIsSaved] = useState(false);
  const { t } = useLanguage();

  const handleSave = async () => {
    setIsSaved(false);
    await onSave();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="h-16 w-full glass-panel border-b border-white/5 flex items-center justify-between px-4 md:px-6 z-[60] fixed top-0 left-0">
      <div className="flex items-center gap-4 overflow-hidden">
        {fileName ? (
            <button 
                onClick={onBack}
                className="p-2 rounded-full hover:bg-white/10 cursor-pointer transition-colors text-stone-200 shrink-0"
                title={t('save')}
            >
                <ChevronLeft className="w-6 h-6" />
            </button>
        ) : (
            <button 
              onClick={onMenuClick}
              className="p-2 rounded-full hover:bg-white/10 cursor-pointer transition-colors text-stone-400 hover:text-white shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
        )}
        
        <div 
            className={`flex items-center gap-2 shrink-0 ${fileName ? 'cursor-pointer hover:opacity-80' : ''}`}
            onClick={fileName ? onBack : undefined}
        >
          <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-red-700 rounded-md shadow-lg shadow-red-900/20 flex items-center justify-center text-white font-bold text-xs shrink-0">
            PDF
          </div>
          <span className="font-medium text-stone-200 text-lg tracking-tight hidden sm:inline">{t('appName')}</span>
        </div>

        {fileName && (
          <div className="flex items-center min-w-0">
            <div className="h-4 w-[1px] bg-white/10 mx-2 hidden sm:block shrink-0" />
            <span className="text-sm text-stone-400 truncate max-w-[120px] sm:max-w-[200px]">{fileName}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {!fileName && (
            <label className="flex items-center gap-2 px-3 py-2 md:px-4 bg-stone-100 text-stone-950 rounded-lg hover:bg-white transition-all cursor-pointer shadow-md hover:shadow-lg hover:shadow-stone-900/50 active:scale-95 text-xs md:text-sm font-medium whitespace-nowrap">
            <FileUp className="w-4 h-4" />
            <span className="hidden sm:inline">{t('openPDF')}</span>
            <span className="sm:hidden">{t('openPDF')}</span>
            <input type="file" accept="application/pdf,.epdf" className="hidden" onChange={onUpload} />
            </label>
        )}
        
        {fileName && (
          <>
             <button 
                onClick={onExport}
                className="flex items-center gap-2 px-3 py-2 md:px-4 border border-stone-700 bg-stone-800 text-brand-blue rounded-lg hover:bg-stone-700 transition-all cursor-pointer shadow-sm text-xs md:text-sm font-medium"
                title={t('download')}
              >
                <CloudDownload className="w-4 h-4" />
                <span className="hidden sm:inline">{t('download')}</span>
              </button>

              <button 
                onClick={handleSave}
                disabled={isSaved}
                className={`flex items-center gap-2 px-3 py-2 md:px-4 border rounded-lg transition-all cursor-pointer shadow-sm text-xs md:text-sm font-medium ${
                    isSaved 
                    ? 'bg-green-600/20 border-green-500 text-green-400' 
                    : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
                }`}
                title={t('save')}
              >
                {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span className="hidden sm:inline">{isSaved ? t('saved') : t('save')}</span>
              </button>
          </>
        )}
      </div>
    </div>
  );
};
