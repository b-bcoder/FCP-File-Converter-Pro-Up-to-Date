import { ConversionTarget } from '../types';

declare const libheif: any;
declare const jspdf: any;
declare const pdfjsLib: any;
declare const ImageTracer: any;

function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  if (!mimeMatch) {
    throw new Error('Invalid data URL');
  }
  const mime = mimeMatch[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export const convertPdfToText = async (
    file: File,
    onProgress: (progress: number) => void
): Promise<Blob> => {
    if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF.js library not loaded.');
    }

    // Set worker source (required for pdf.js)
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }

    let arrayBuffer: ArrayBuffer;
    try {
        arrayBuffer = await file.arrayBuffer();
    } catch (err: any) {
        throw new Error(`Failed to read PDF file "${file.name}": ${err.message || 'File might have been moved or deleted.'}`);
    }
    const loadingTask = pdfjsLib.getDocument(arrayBuffer);
    const pdf = await loadingTask.promise;

    let fullText = "";
    const totalPages = pdf.numPages;

    for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
        
        fullText += `--- Page ${i} ---\n\n${pageText}\n\n`;
        
        onProgress(Math.round((i / totalPages) * 100));
    }

    return new Blob([fullText], { type: 'text/plain' });
};

export const convertImage = (
    file: File, 
    targetFormat: ConversionTarget.JPG | ConversionTarget.PNG | ConversionTarget.WEBP | ConversionTarget.HEIC | ConversionTarget.AVIF | ConversionTarget.PDF | ConversionTarget.ICO | ConversionTarget.SVG, 
    onReadProgress: (progress: number) => void,
    targetDimensions?: { width: number; height: number; }
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // Use createObjectURL instead of FileReader for massive memory savings
    const imageUrl = URL.createObjectURL(file);
    const img = new Image();

    // Safety timeout: if image takes too long to load (e.g. corrupt), fail it so the queue continues
    const timeoutId = setTimeout(() => {
        URL.revokeObjectURL(imageUrl);
        reject(new Error('Image load timed out. File might be corrupt or too large.'));
    }, 10000);

    img.onload = async () => {
      clearTimeout(timeoutId);
      // Simulate read progress since createObjectURL is instant
      onReadProgress(100);

      try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(imageUrl);
            return reject(new Error('Could not get canvas context'));
          }

          if (targetDimensions) {
              canvas.width = targetDimensions.width;
              canvas.height = targetDimensions.height;
              const hRatio = canvas.width / img.width;
              const vRatio = canvas.height / img.height;
              const ratio = Math.min(hRatio, vRatio);
              const centerShift_x = (canvas.width - img.width * ratio) / 2;
              const centerShift_y = (canvas.height - img.height * ratio) / 2;
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, img.width, img.height,
                            centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
          } else {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
          }

          // Free memory immediately after drawing to canvas
          URL.revokeObjectURL(imageUrl);

          if (targetFormat === ConversionTarget.PDF) {
              if (typeof jspdf === 'undefined') {
                  return reject(new Error('PDF library not loaded.'));
              }
              const { jsPDF } = jspdf;
              const orientation = canvas.width > canvas.height ? 'l' : 'p';
              const doc = new jsPDF({
                  orientation,
                  unit: 'px',
                  format: [canvas.width, canvas.height]
              });
              const jpegData = canvas.toDataURL('image/jpeg', 0.95);
              doc.addImage(jpegData, 'JPEG', 0, 0, canvas.width, canvas.height);
              const blob = doc.output('blob');
              return resolve(blob);
          }

          if (targetFormat === ConversionTarget.SVG) {
              const tracer = (window as any).ImageTracer || (window as any).imagetracer;
              if (!tracer) {
                  return reject(new Error('ImageTracer library not loaded.'));
              }
              
              const dataUrl = canvas.toDataURL('image/png');
              tracer.imageToSVG(dataUrl, (svgString: string) => {
                  const blob = new Blob([svgString], { type: 'image/svg+xml' });
                  resolve(blob);
              }, 'posterized2');
              return;
          }

          if (targetFormat === ConversionTarget.ICO) {
              const icoCanvas = document.createElement('canvas');
              const size = 256; 
              icoCanvas.width = size;
              icoCanvas.height = size;
              const icoCtx = icoCanvas.getContext('2d');
              if (!icoCtx) {
                return reject(new Error('Could not get canvas context for ICO.'));
              }
              icoCtx.drawImage(canvas, 0, 0, size, size);

              icoCanvas.toBlob(async (pngBlob) => {
                  if (!pngBlob) return reject(new Error('Failed to create PNG blob for ICO.'));
                  
                  const pngData = await pngBlob.arrayBuffer();
                  const icoHeaderSize = 6;
                  const icoDirEntrySize = 16;
                  const buffer = new ArrayBuffer(icoHeaderSize + icoDirEntrySize + pngData.byteLength);
                  const view = new DataView(buffer);

                  view.setUint16(0, 0, true);
                  view.setUint16(2, 1, true);
                  view.setUint16(4, 1, true);

                  view.setUint8(icoHeaderSize + 0, size === 256 ? 0 : size);
                  view.setUint8(icoHeaderSize + 1, size === 256 ? 0 : size);
                  view.setUint8(icoHeaderSize + 2, 0);
                  view.setUint8(icoHeaderSize + 3, 0);
                  view.setUint16(icoHeaderSize + 4, 1, true);
                  view.setUint16(icoHeaderSize + 6, 32, true);
                  view.setUint32(icoHeaderSize + 8, pngData.byteLength, true);
                  view.setUint32(icoHeaderSize + 12, icoHeaderSize + icoDirEntrySize, true);

                  const icoData = new Uint8Array(buffer);
                  icoData.set(new Uint8Array(pngData), icoHeaderSize + icoDirEntrySize);

                  resolve(new Blob([icoData], { type: 'image/x-icon' }));
              }, 'image/png');
              return;
          }
          
          if (targetFormat === ConversionTarget.HEIC || targetFormat === ConversionTarget.AVIF) {
              if (typeof libheif === 'undefined' || !libheif.Encoder) {
                  return reject(new Error('HEIF/AVIF library not loaded.'));
              }
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const format = targetFormat === ConversionTarget.HEIC ? libheif.Image.Format.HEVC : libheif.Image.Format.AVIS;
              const encoder = new libheif.Encoder(format);
              const { heif: heifFile } = await encoder.encode(
                  [{
                      width: canvas.width,
                      height: canvas.height,
                      data: imageData.data
                  }], { quality: 90 }
              );
              const mimeType = targetFormat === ConversionTarget.HEIC ? 'image/heic' : 'image/avif';
              resolve(new Blob([heifFile as ArrayBuffer], { type: mimeType }));
              return;
          }
          
          let mimeType: string;
          switch (targetFormat) {
            case ConversionTarget.JPG: mimeType = 'image/jpeg'; break;
            case ConversionTarget.PNG: mimeType = 'image/png'; break;
            case ConversionTarget.WEBP: mimeType = 'image/webp'; break;
            default: mimeType = 'image/jpeg';
          }

          canvas.toBlob((blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Canvas toBlob failed'));
          }, mimeType, 0.9);

      } catch(err) {
          URL.revokeObjectURL(imageUrl);
          reject(err);
      }
    };

    img.onerror = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(imageUrl);
        reject(new Error(`Failed to load image "${file.name}". The file might have been moved, deleted, or is in an unsupported format.`));
    };

    img.src = imageUrl;
  });
};

const readFileAsArrayBuffer = async (file: File, onProgress: (progress: number) => void): Promise<ArrayBuffer> => {
    try {
        // Use arrayBuffer() which is more modern and often more reliable than FileReader
        // We simulate progress since arrayBuffer() doesn't provide it natively
        onProgress(10);
        const buffer = await file.arrayBuffer();
        onProgress(100);
        return buffer;
    } catch (err: any) {
        throw new Error(`Failed to read file "${file.name}": ${err.message || 'File might have been moved or deleted.'}`);
    }
};

export const convertMedia = async (
    ffmpeg: any, 
    file: File, 
    targetFormat: ConversionTarget.MP4 | ConversionTarget.WEBM | ConversionTarget.WMV | ConversionTarget.MKV | ConversionTarget.MP3 | ConversionTarget.WAV | ConversionTarget.FLAC | ConversionTarget.OGG, 
    onConvertProgress: (progress: number) => void, 
    onReadProgress: (progress: number) => void,
    targetDimensions?: { width: number; height: number; }
): Promise<Blob> => {
    if (!ffmpeg) {
      throw new Error('FFmpeg instance is not available.');
    }
    
    const fileData = await readFileAsArrayBuffer(file, onReadProgress);
    
    onConvertProgress(0);

    ffmpeg.off('progress');
    ffmpeg.on('progress', ({ progress }: { progress: number }) => {
        if (progress >= 0 && progress <= 1) {
            onConvertProgress(Math.round(progress * 100));
        }
    });

    // Sanitized filenames to prevent ffmpeg errors with special chars
    const inputFileName = `input_${Math.random().toString(36).substring(7)}${file.name.substring(file.name.lastIndexOf('.'))}`;
    const outputFileName = `output_${Math.random().toString(36).substring(7)}.${targetFormat.toLowerCase()}`;

    await ffmpeg.writeFile(inputFileName, new Uint8Array(fileData));
    
    const command = ['-i', inputFileName];
    if (targetDimensions) {
        command.push('-vf', `scale=w=${targetDimensions.width}:h=${targetDimensions.height}:force_original_aspect_ratio=decrease,pad=${targetDimensions.width}:${targetDimensions.height}:-1:-1:color=black`);
    }
    command.push(outputFileName);

    await ffmpeg.exec(command);

    const data = await ffmpeg.readFile(outputFileName);

    // Clean up FS
    try {
        await ffmpeg.deleteFile(inputFileName);
        await ffmpeg.deleteFile(outputFileName);
    } catch(e) { /* ignore cleanup errors */ }

    onConvertProgress(100);

    let mimeType: string;
    switch (targetFormat) {
        case ConversionTarget.MP4: mimeType = 'video/mp4'; break;
        case ConversionTarget.WEBM: mimeType = 'video/webm'; break;
        case ConversionTarget.WMV: mimeType = 'video/x-ms-wmv'; break;
        case ConversionTarget.MKV: mimeType = 'video/x-matroska'; break;
        case ConversionTarget.MP3: mimeType = 'audio/mpeg'; break;
        case ConversionTarget.WAV: mimeType = 'audio/wav'; break;
        case ConversionTarget.FLAC: mimeType = 'audio/flac'; break;
        case ConversionTarget.OGG: mimeType = 'audio/ogg'; break;
        default: mimeType = 'application/octet-stream';
    }

    return new Blob([data], { type: mimeType });
};