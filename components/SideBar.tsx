import React from 'react';
import { Layers, FileOutput, PenTool, ScanText, Eye } from 'lucide-react';
import { AppMode } from '../types';

interface SideBarProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
}

export const SideBar: React.FC<SideBarProps> = ({ currentMode, setMode }) => {
  
  const modes = [
    { id: AppMode.VIEW, icon: Eye, label: 'View', color: 'text-stone-300', activeBg: 'bg-stone-800' },
    { id: AppMode.PAGES, icon: Layers, label: 'Pages', color: 'text-brand-yellow', activeBg: 'bg-yellow-500/10' },
    { id: AppMode.COMPRESS, icon: FileOutput, label: 'Size', color: 'text-brand-green', activeBg: 'bg-green-500/10' },
    { id: AppMode.EDIT, icon: PenTool, label: 'Edit', color: 'text-brand-purple', activeBg: 'bg-purple-500/10' },
    { id: AppMode.OCR, icon: ScanText, label: 'OCR', color: 'text-brand-blue', activeBg: 'bg-blue-500/10' },
  ];

  return (
    <div className="w-20 h-full pt-20 pb-4 glass-panel border-l border-white/5 flex flex-col items-center gap-4 fixed right-0 top-0 z-40">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = currentMode === mode.id;
        
        return (
          <button
            key={mode.id}
            onClick={() => setMode(mode.id)}
            className={`
              w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-300
              ${isActive ? `${mode.activeBg} shadow-inner shadow-black/20` : 'hover:bg-white/5'}
              group relative
            `}
          >
            <Icon 
              className={`w-6 h-6 transition-colors duration-300 ${isActive ? mode.color : 'text-stone-500 group-hover:text-stone-300'}`} 
            />
            <span className={`text-[9px] font-medium ${isActive ? mode.color : 'text-stone-600 group-hover:text-stone-400'}`}>
              {mode.label}
            </span>
            
            {isActive && (
              <div className={`absolute left-0 h-8 w-1 rounded-r-full ${mode.color.replace('text-', 'bg-')}`} />
            )}
          </button>
        );
      })}
    </div>
  );
};