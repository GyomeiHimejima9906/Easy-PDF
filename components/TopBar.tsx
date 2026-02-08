import React from 'react';
import { FileUp, Save, Menu } from 'lucide-react';

interface TopBarProps {
  fileName: string | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
  onMenuClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ fileName, onUpload, onSave, onMenuClick }) => {
  return (
    <div className="h-16 w-full glass-panel border-b border-white/5 flex items-center justify-between px-4 md:px-6 z-[60] fixed top-0 left-0">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="p-2 rounded-full hover:bg-white/10 cursor-pointer transition-colors text-stone-400 hover:text-white"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-red-700 rounded-md shadow-lg shadow-red-900/20 flex items-center justify-center text-white font-bold text-xs">
            PDF
          </div>
          <span className="font-medium text-stone-200 text-lg tracking-tight hidden sm:inline">Easy PDF</span>
        </div>
        {fileName && (
          <div className="flex items-center">
            <div className="h-4 w-[1px] bg-white/10 mx-2 hidden sm:block" />
            <span className="text-sm text-stone-400 truncate max-w-[120px] sm:max-w-[200px]">{fileName}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <label className="flex items-center gap-2 px-3 py-2 md:px-4 bg-stone-100 text-stone-950 rounded-lg hover:bg-white transition-all cursor-pointer shadow-md hover:shadow-lg hover:shadow-stone-900/50 active:scale-95 text-xs md:text-sm font-medium whitespace-nowrap">
          <FileUp className="w-4 h-4" />
          <span className="hidden sm:inline">Open PDF</span>
          <span className="sm:hidden">Open</span>
          <input type="file" accept="application/pdf" className="hidden" onChange={onUpload} />
        </label>
        
        {fileName && (
          <button 
            onClick={onSave}
            className="flex items-center gap-2 px-3 py-2 md:px-4 bg-stone-800 border border-stone-700 text-stone-300 rounded-lg hover:bg-stone-700 transition-all cursor-pointer shadow-sm text-xs md:text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Save</span>
          </button>
        )}
      </div>
    </div>
  );
};