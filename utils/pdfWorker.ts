// In a real build system, we would import the worker. 
// For this environment, we rely on the window.pdfjsLib injected via CDN or setup here.

export const setupPDFWorker = () => {
  if (typeof window !== 'undefined') {
    if (window.pdfjsLib) {
      // Check if we are running locally or offline
      const isLocal = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' || 
                      window.location.protocol === 'file:';
      
      // Use local worker if local/offline, otherwise use CDN
      // NOTE: For offline usage, you must download 'pdf.worker.min.js' and place it in the root.
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = isLocal
        ? './pdf.worker.min.js'
        : 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        
      console.log(`PDF Worker initialized (Source: ${isLocal ? 'Local' : 'CDN'})`);
    } else {
      console.error("PDF.js library not found on window object. The PDF will not load. Please check the index.html script tags.");
    }
  }
};