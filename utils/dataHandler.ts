
import { DB } from './db';

export const DataHandler = {
  exportData: async () => {
    if (!window.JSZip) {
      alert("JSZip library not loaded.");
      return;
    }

    try {
      const zip = new window.JSZip();
      
      // 1. Fetch All Files
      const files = await DB.getFiles();
      const docsFolder = zip.folder("documents");
      
      files.forEach((file: any) => {
        // We save the raw JSON record. 
        // Note: Uint8Arrays in the 'file' property will be serialized to objects {0:.., 1:..} by JSON.stringify
        // We will handle reconstruction on import.
        docsFolder.file(`${file.name}.json`, JSON.stringify(file));
      });

      // 2. Fetch Settings
      // Since DB doesn't have getAllSettings, we fetch known keys
      const settingsKeys = ['language', 'isHighContrast', 'isNightMode', 'colorBlindMode'];
      const settings: Record<string, any> = {};
      
      for (const key of settingsKeys) {
        const val = await DB.getSetting(key);
        if (val !== undefined) settings[key] = val;
      }

      // 3. Create settings.xml
      let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<settings>\n';
      Object.entries(settings).forEach(([key, value]) => {
        xmlContent += `  <${key}>${value}</${key}>\n`;
      });
      xmlContent += '</settings>';

      zip.file("settings.xml", xmlContent);

      // 4. Generate Zip
      const content = await zip.generateAsync({ type: "blob" });
      
      // 5. Download
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      const date = new Date().toISOString().slice(0, 10);
      link.download = `EasyPDF_Backup_${date}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      return true;
    } catch (e) {
      console.error("Export Failed", e);
      return false;
    }
  },

  importData: async (zipFile: File) => {
    if (!window.JSZip) return false;

    try {
      const zip = await new window.JSZip().loadAsync(zipFile);
      
      // 1. Restore Settings from XML
      const settingsFile = zip.file("settings.xml");
      if (settingsFile) {
        const xmlText = await settingsFile.async("string");
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const settingsNode = xmlDoc.getElementsByTagName("settings")[0];
        
        if (settingsNode) {
          Array.from(settingsNode.children).forEach(async (node) => {
            let value: any = node.textContent;
            // Basic type inference
            if (value === 'true') value = true;
            if (value === 'false') value = false;
            await DB.setSetting(node.tagName, value);
          });
        }
      }

      // 2. Restore Documents
      const docsFolder = zip.folder("documents");
      if (docsFolder) {
        const filePromises: Promise<void>[] = [];
        
        docsFolder.forEach((relativePath: string, fileEntry: any) => {
           filePromises.push((async () => {
              const jsonStr = await fileEntry.async("string");
              const record = JSON.parse(jsonStr);
              
              // Reconstruct Uint8Array from JSON object serialization
              if (record.file && typeof record.file === 'object' && ! (record.file instanceof Uint8Array)) {
                  record.file = new Uint8Array(Object.values(record.file));
              }

              // Save to DB
              await DB.saveFile(record);
           })());
        });

        await Promise.all(filePromises);
      }

      return true;
    } catch (e) {
      console.error("Import Failed", e);
      return false;
    }
  }
};
