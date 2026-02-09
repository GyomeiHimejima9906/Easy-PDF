
import React from 'react';

export type ColorBlindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';

interface VisualFiltersProps {
  mode: ColorBlindMode;
  isNightMode: boolean;
}

export const VisualFilters: React.FC<VisualFiltersProps> = ({ mode, isNightMode }) => {
  return (
    <>
      {/* Night Mode Overlay (Yellowing/Blue Light Filter) */}
      {isNightMode && (
        <div 
          className="fixed inset-0 pointer-events-none z-[9999] mix-blend-multiply"
          style={{ backgroundColor: 'rgba(255, 180, 50, 0.2)' }}
        />
      )}

      {/* SVG Filters for Color Blindness */}
      <svg className="fixed h-0 w-0 pointer-events-none" aria-hidden="true">
        <defs>
          <filter id="protanopia">
            <feColorMatrix
              type="matrix"
              values="0.567 0.433 0     0 0
                      0.558 0.442 0     0 0
                      0     0.242 0.758 0 0
                      0     0     0     1 0"
            />
          </filter>
          <filter id="deuteranopia">
            <feColorMatrix
              type="matrix"
              values="0.625 0.375 0   0 0
                      0.7   0.3   0   0 0
                      0     0.3   0.7 0 0
                      0     0     0   1 0"
            />
          </filter>
          <filter id="tritanopia">
            <feColorMatrix
              type="matrix"
              values="0.95 0.05  0     0 0
                      0    0.433 0.567 0 0
                      0    0.475 0.525 0 0
                      0    0     0     1 0"
            />
          </filter>
        </defs>
      </svg>

      {/* Apply Filter Style Global Override */}
      {mode !== 'none' && (
        <style>{`
          body {
            filter: ${
              mode === 'achromatopsia' ? 'grayscale(100%)' : `url(#${mode})`
            };
          }
        `}</style>
      )}
    </>
  );
};
