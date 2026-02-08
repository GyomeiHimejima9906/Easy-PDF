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
    <div className="
      glass-panel z-40
      fixed 
      /* PORTRAIT (Taller than wide - Smartphone feel): Bottom Bar */
      portrait:bottom-0 portrait:left-0 portrait:w-full portrait:h-16 portrait:border-t portrait:border-white/5 portrait:flex-row portrait:justify-around portrait:px-2
      /* LANDSCAPE (Wider than tall - Desktop/Tablet feel): Right Sidebar */
      landscape:top-0 landscape:right-0 landscape:w-20 landscape:h-full landscape:border-l landscape:border-t-0 landscape:pt-20 landscape:pb-4 landscape:flex-col landscape:justify-start landscape:gap-4
      flex items-center 
    ">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = currentMode === mode.id;
        
        return (
          <button
            key={mode.id}
            onClick={() => setMode(mode.id)}
            className={`
              rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-300
              /* Sizing */
              w-12 h-12
              /* Active State */
              ${isActive ? `${mode.activeBg} shadow-inner shadow-black/20` : 'hover:bg-white/5'}
              group relative
            `}
          >
            <Icon 
              className={`w-5 h-5 md:w-6 md:h-6 transition-colors duration-300 ${isActive ? mode.color : 'text-stone-500 group-hover:text-stone-300'}`} 
            />
            <span className={`text-[9px] font-medium ${isActive ? mode.color : 'text-stone-600 group-hover:text-stone-400'}`}>
              {mode.label}
            </span>
            
            {isActive && (
              <>
                {/* Landscape Indicator (Left Border) */}
                <div className={`hidden landscape:block absolute left-0 h-6 w-1 rounded-r-full ${mode.color.replace('text-', 'bg-')}`} />
                {/* Portrait Indicator (Top Border) */}
                <div className={`landscape:hidden absolute top-0 w-6 h-1 rounded-b-full ${mode.color.replace('text-', 'bg-')}`} />
              </>
            )}
          </button>
        );
      })}
    </div>
  );
};