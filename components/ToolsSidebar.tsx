
import React, { useState } from 'react';
import { AppMode, PDFPageData, Annotation } from '../types';
import { Minimize2, ChevronRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ToolsSidebarProps {
  mode: AppMode;
  onClose: () => void;
  // Compressor Props
  onCompress: (quality: number) => Promise<void>;
  // OCR Props (Removed legacy props)
}

export const ToolsSidebar: React.FC<ToolsSidebarProps> = ({ 
    mode, onClose, onCompress 
}) => {
  const [quality, setQuality] = useState(0.7);
  const { t } = useLanguage();

  const handleCompressClick = async () => {
      await onCompress(quality);
  };

  if (mode !== AppMode.COMPRESS) return null;

  return (
    <div className="w-80 h-full bg-stone-900 border-l border-white/5 flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl z-50">
        {/* Header */}
        <div className="h-16 border-b border-white/5 flex items-center justify-between px-6">
            <h3 className="font-bold text-stone-200 flex items-center gap-2">
                <Minimize2 className="text-brand-green" />
                {t('compress')}
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-stone-500">
                <ChevronRight size={20} />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-8">
                <p className="text-sm text-stone-400">{t('compressDesc')}</p>
                
                <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold uppercase text-stone-500">
                        <span>{t('quality')}</span>
                        <span>{Math.round(quality * 100)}%</span>
                    </div>
                    <input 
                        type="range" 
                        min="0.1" max="1.0" step="0.1" 
                        value={quality} 
                        onChange={(e) => setQuality(parseFloat(e.target.value))}
                        className="w-full accent-brand-green h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-stone-600">
                        <span>{t('maxCompression')}</span>
                        <span>{t('bestQuality')}</span>
                    </div>
                </div>

                <button 
                    onClick={handleCompressClick}
                    className="w-full py-3 bg-brand-green text-stone-950 font-bold rounded-xl hover:bg-green-400 transition-colors flex items-center justify-center gap-2"
                >
                    <Minimize2 size={18} /> {t('compressNow')}
                </button>
            </div>
        </div>
    </div>
  );
};
