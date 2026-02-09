
import React from 'react';
import { PageThumbnail } from './PageThumbnail';
import { PDFPageData } from '../types';
import { Trash2, RotateCw, RotateCcw, Download, PlusCircle, FilePlus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface PageManagerProps {
  pdfDoc: any;
  pages: PDFPageData[];
  onMovePage: (dragIndex: number, hoverIndex: number) => void;
  onRotatePage: (index: number, dir: 'left' | 'right') => void;
  onDeletePage: (index: number) => void;
  // New props passed from App (via usePDFStore)
  onExtractPage?: (index: number) => void;
  onInsertFile?: (file: File) => void;
  onInsertBlankPage?: () => void;
  isHighContrast: boolean;
}

export const PageManager: React.FC<PageManagerProps> = ({
  pdfDoc,
  pages,
  onMovePage,
  onRotatePage,
  onDeletePage,
  onExtractPage,
  onInsertFile,
  onInsertBlankPage,
  isHighContrast
}) => {
  const [draggedItem, setDraggedItem] = React.useState<number | null>(null);
  const { t } = useLanguage();

  const onDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;
    onMovePage(draggedItem, index);
    setDraggedItem(index);
  };

  const onDragEnd = () => {
    setDraggedItem(null);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-stone-900/50 p-8 pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-stone-200 flex items-center gap-2">
                    {t('organizePages')}
                </h2>
                <p className="text-stone-500 text-sm mt-1">{t('dragToReorder')}</p>
            </div>
            
            <div className="flex items-center gap-3">
                <button 
                    onClick={onInsertBlankPage}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-800 text-stone-200 border border-white/10 rounded-xl hover:bg-stone-700 transition-colors cursor-pointer font-bold shadow-lg"
                >
                    <FilePlus size={20} />
                    <span>{t('insertBlankPage')}</span>
                </button>
                <label className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-stone-900 rounded-xl hover:bg-blue-400 transition-colors cursor-pointer font-bold shadow-lg">
                    <PlusCircle size={20} />
                    <span>{t('insertPage')}</span>
                    <input 
                        type="file" 
                        accept="application/pdf" 
                        className="hidden" 
                        onChange={(e) => e.target.files?.[0] && onInsertFile && onInsertFile(e.target.files[0])}
                    />
                </label>
            </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
          {pages.map((page, index) => (
            <div 
                key={page.id}
                className={`relative flex flex-col bg-stone-800 rounded-xl border-2 transition-all p-2 ${draggedItem === index ? 'border-brand-blue opacity-50 scale-95' : 'border-stone-700 hover:border-stone-600'}`}
                draggable
                onDragStart={(e) => onDragStart(e, index)}
                onDragOver={(e) => onDragOver(e, index)}
                onDragEnd={onDragEnd}
            >
              {/* Header: Page Number */}
              <div className="mb-2 flex justify-between items-center px-1">
                   <span className="text-xs font-bold text-stone-400">{t('page')} {index + 1}</span>
                   <div className="w-2 h-2 rounded-full bg-stone-600" />
              </div>

              {/* Thumbnail Container */}
              <div className="aspect-[3/4] bg-white rounded-lg overflow-hidden relative shadow-inner mb-3">
                <div className="w-full h-full transform transition-transform" style={{ transform: `rotate(${page.rotation}deg)` }}>
                   <PageThumbnail 
                        pdfDoc={pdfDoc} 
                        pageNumber={page.originalIndex} 
                        rotation={0} 
                        isSelected={false}
                        onClick={() => {}}
                        onDragStart={() => {}} 
                        onDragOver={() => {}} 
                        onDrop={() => {}}
                        isHighContrast={isHighContrast}
                    />
                </div>
              </div>
              
              {/* Permanent Tools Bar (No Hover Required) */}
              <div className="flex items-center justify-between gap-1 px-1 mt-auto">
                   <button onClick={() => onRotatePage(index, 'left')} className="p-2 hover:bg-white/10 rounded-md text-stone-400 hover:text-white transition-colors" title={t('rotateLeft')}>
                        <RotateCcw size={16} />
                   </button>
                   <button onClick={() => onRotatePage(index, 'right')} className="p-2 hover:bg-white/10 rounded-md text-stone-400 hover:text-white transition-colors" title={t('rotateRight')}>
                        <RotateCw size={16} />
                   </button>
                   <div className="w-[1px] h-4 bg-white/10" />
                   <button onClick={() => onExtractPage && onExtractPage(index)} className="p-2 hover:bg-white/10 rounded-md text-brand-blue/80 hover:text-brand-blue transition-colors" title={t('extractPage')}>
                        <Download size={16} />
                   </button>
                   <button onClick={() => onDeletePage(index)} className="p-2 hover:bg-red-900/30 rounded-md text-stone-500 hover:text-red-400 transition-colors" title={t('delete')}>
                        <Trash2 size={16} />
                   </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
