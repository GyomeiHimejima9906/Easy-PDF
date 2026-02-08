
export enum AppMode {
  VIEW = 'VIEW',
  PAGES = 'PAGES',
  COMPRESS = 'COMPRESS',
  EDIT = 'EDIT',
  OCR = 'OCR'
}

export interface Annotation {
  id: string;
  pageIndex: number;
  type: 'text' | 'rect' | 'highlight' | 'freehand' | 'comment' | 'ocr_text' | 'image';
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  width?: number; // Percentage
  height?: number; // Percentage
  content?: string;
  color: string;
  // New properties
  points?: {x: number, y: number}[]; // For freehand
  fontSize?: number;
  strokeWidth?: number;
  opacity?: number;
  fill?: string; // For solid rectangles (Whiteout)
  imageData?: string; // Base64 for images
}

export interface PDFPageData {
  id: string; // Unique ID for Drag and Drop tracking
  originalIndex: number;
  rotation: number;
}

export interface Tool {
  id: string;
  icon: any;
  label: string;
  action?: () => void;
}

// Mocking Tesseract types globally since we load via script tag
declare global {
  interface Window {
    Tesseract: any;
    pdfjsLib: any;
    PDFLib: any;
  }
}