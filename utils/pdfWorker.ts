
// In a real build system, we would import the worker. 
// For this environment, we rely on the window.pdfjsLib injected via CDN.

export const setupPDFWorker = () => {
  if (typeof window !== 'undefined') {
    if (window.pdfjsLib) {
      // Always use the CDN for the worker to ensure reliability without requiring local file downloads.
      // Matches the version loaded in index.html (3.11.174)
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        
      console.log(`PDF Worker initialized (Source: CDN)`);
    } else {
      console.error("PDF.js library not found on window object. The PDF will not load. Please check the index.html script tags.");
    }
  }
};
