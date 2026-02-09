
// Utility to handle Import/Export of Project Files (.ePDF)
// Format: Gzipped JSON containing the file record (PDF data, annotations, pages metadata)

export const ProjectHandler = {
  // Compress and Download
  exportProject: async (fileRecord: any) => {
    try {
      // 1. Create JSON string
      const jsonString = JSON.stringify(fileRecord);
      
      // 2. Compress using CompressionStream (GZIP)
      const stream = new Blob([jsonString]).stream();
      const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
      const compressedBlob = await new Response(compressedStream).blob();

      // 3. Download
      const link = document.createElement('a');
      link.href = URL.createObjectURL(compressedBlob);
      link.download = `${fileRecord.name.replace('.pdf', '')}.epdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    } catch (e) {
      console.error("Export failed", e);
      alert("Failed to export project. Your browser might not support CompressionStream.");
      return false;
    }
  },

  // Decompress and Parse
  importProject: async (file: File): Promise<any> => {
    try {
      // 1. Decompress
      const stream = file.stream();
      const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
      const decompressedResponse = new Response(decompressedStream);
      
      // 2. Parse JSON
      const fileRecord = await decompressedResponse.json();
      
      // 3. Validate minimal structure
      if (!fileRecord || !fileRecord.file || !fileRecord.pages) {
        throw new Error("Invalid ePDF format");
      }

      // 4. Convert file data back to Uint8Array if it was serialized as object/array
      // JSON.stringify turns Uint8Array into {0: x, 1: y...} or array.
      // We need to ensure it's a clean Uint8Array for PDF.js
      if (!(fileRecord.file instanceof Uint8Array)) {
          // If it's a regular array or object
          fileRecord.file = new Uint8Array(Object.values(fileRecord.file));
      }

      // Update ID to avoid collision if importing same file twice
      fileRecord.id = `imported-${Date.now()}`;
      fileRecord.name = file.name.replace('.epdf', '.pdf'); // Restore pdf extension for display

      return fileRecord;
    } catch (e) {
      console.error("Import failed", e);
      alert("Failed to open .ePDF file. File might be corrupted.");
      return null;
    }
  }
};
