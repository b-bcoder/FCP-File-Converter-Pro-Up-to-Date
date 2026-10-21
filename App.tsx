import React, { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import { ConversionTarget, FileStatus, ConversionFile } from './types';
import { convertImage, convertPdfToText } from './services/fileConverter';
import { convertMediaElectron, isElectronApp } from './services/electronService';
import { resolutions } from './resolutions';
import { t } from './i18n';

interface FileSystemEntry {
    isFile: boolean;
    isDirectory: boolean;
    name: string;
    fullPath: string;
    file: (success: (file: File) => void, error: (error: any) => void) => void;
    createReader: () => {
        readEntries: (success: (entries: FileSystemEntry[]) => void, error: (error: any) => void) => void;
    };
}

const getMediaType = (file: File) => {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    
    // We strictly define what needs the Media Engine (FFmpeg)
    // GIFs are included here because FFmpeg is used for high-quality GIF resizing/conversion
    const isVideo = type.startsWith('video/') || /\.(mp4|webm|wmv|mkv|avi|mov|flv|gif)$/.test(name);
    const isAudio = type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a|aac)$/.test(name);
    const isPdf = type === 'application/pdf' || /\.pdf$/i.test(name);
    
    // Images that can be handled by the browser's Canvas/HEIF engine
    const isImage = (type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif|avif|ico|bmp|tiff|svg)$/.test(name)) && !isVideo;
    
    return { isImage, isVideo, isAudio, isPdf, isSupported: isImage || isVideo || isAudio || isPdf };
};

// Helper to check if a file is supported
const isSupportedMedia = (file: File): boolean => getMediaType(file).isSupported;

// Helper function to recursively traverse directories and collect files with their relative paths
async function traverseDirectory(entry: FileSystemEntry, currentPath: string = ''): Promise<{ file: File; relativePath: string }[]> {
    if (!entry) return [];

    const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

    if (entry.isFile) {
        return new Promise<{ file: File; relativePath: string }[]>((resolve, reject) => {
            entry.file(
                (file: File) => {
                    if (isSupportedMedia(file)) {
                         resolve([{ file, relativePath: newPath }]);
                    } else {
                         resolve([]);
                    }
                },
                (err: any) => reject(err)
            );
        });
    }

    if (entry.isDirectory) {
        return new Promise<{ file: File; relativePath: string }[]>((resolve, reject) => {
            const dirReader = entry.createReader();
            const allEntries: FileSystemEntry[] = [];

            const readEntries = () => {
                dirReader.readEntries(
                    async (entries: FileSystemEntry[]) => {
                        if (entries.length === 0) {
                            // All entries for this directory have been read
                            const nestedFiles = await Promise.all(allEntries.map(e => traverseDirectory(e, newPath)));
                            resolve(nestedFiles.flat());
                        } else {
                            allEntries.push(...entries);
                            readEntries(); // Read the next batch of entries
                        }
                    },
                    (err: any) => reject(err)
                );
            };
            readEntries();
        });
    }
    return [];
}


function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const PasswordModal: React.FC<{ onConfirm: (password: string | null) => void; onCancel: () => void, lang: string }> = ({ onConfirm, onCancel, lang }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (password !== confirmPassword) {
            setError(t('passwords_dont_match', lang));
            return;
        }
        setError('');
        onConfirm(password ? password : null);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity duration-300">
            <div className="bg-gray-200 dark:bg-gray-800 rounded-lg p-8 shadow-xl space-y-4 w-full max-w-sm transform transition-all duration-300 scale-95 animate-scale-in">
                <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{t('password_modal_title', lang)}</h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{t('password_modal_info', lang)}</p>
                <div>
                    <label htmlFor="password-input" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('password_label', lang)}</label>
                    <input
                        id="password-input"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        autoFocus
                    />
                </div>
                <div>
                    <label htmlFor="confirm-password-input" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('confirm_password_label', lang)}</label>
                    <input
                        id="confirm-password-input"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                    />
                </div>
                {error && <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>}
                <div className="flex justify-end space-x-4 pt-4">
                    <button onClick={onCancel} className="bg-gray-500 dark:bg-gray-600 text-white font-bold py-2 px-4 rounded hover:bg-gray-600 dark:hover:bg-gray-700 transition">{t('cancel', lang)}</button>
                    <button onClick={handleSubmit} className="bg-cyan-500 text-white font-bold py-2 px-4 rounded hover:bg-cyan-600 transition">{t('confirm_download', lang)}</button>
                </div>
            </div>
        </div>
    );
};

const EncryptionInfoAlert: React.FC<{ onClose: () => void; lang: string }> = ({ onClose, lang }) => {
    return (
        <div className="fixed bottom-4 right-4 max-w-md w-full bg-gray-200 dark:bg-gray-800 border border-blue-500 rounded-lg shadow-lg p-4 z-50 animate-fade-in-up">
            <div className="flex items-start">
                <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-blue-500 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div className="ml-3 w-0 flex-1">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        {t('zip_error_modal_title', lang)}
                    </p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {t('zip_error_modal_text', lang).split('7-Zip')[0]}
                        <a href="https://www.7-zip.org/" target="_blank" rel="noopener noreferrer" className="font-bold text-cyan-600 dark:text-cyan-400 hover:underline">7-Zip</a>
                        {t('zip_error_modal_text', lang).split('7-Zip')[1]}
                    </p>
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                    <button onClick={onClose} className="bg-transparent rounded-md inline-flex text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500">
                        <span className="sr-only">Close</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};


const App: React.FC = () => {
  const [files, setFiles] = useState<ConversionFile[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedCount, setConvertedCount] = useState(0);
  const [totalToConvert, setTotalToConvert] = useState(0);
  const [isFfmpegReady, setIsFfmpegReady] = useState(isElectronApp());
  const [isHeifReady, setIsHeifReady] = useState(false);
  const [isPdfReady, setIsPdfReady] = useState(false);
  const [isSvgReady, setIsSvgReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [zipFileName, setZipFileName] = useState('converted-files');
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [bulkImageFormat, setBulkImageFormat] = useState('');
  const [bulkVideoFormat, setBulkVideoFormat] = useState('');
  const [bulkAudioFormat, setBulkAudioFormat] = useState('');
  const [isTraversing, setIsTraversing] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [showEncryptionInfo, setShowEncryptionInfo] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'nl');
  const [combineToPdf, setCombineToPdf] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    // Also update the class on the html element immediately for better responsiveness
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('gpu-override', String(gpuOverrideEnabled));
  }, [gpuOverrideEnabled]);

  useEffect(() => {
    let isActive = true;
    const detectGpu = async () => {
      try {
        const hasDedicatedGpu = await detectDedicatedGpu();
        if (isActive) {
          setGpuStatus(hasDedicatedGpu ? 'available' : 'unavailable');
        }
      } catch {
        if (isActive) {
          setGpuStatus('unavailable');
        }
      }
    };

    detectGpu();
    return () => {
      isActive = false;
    };
  }, []);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };

  // Browser libraries (for image/PDF/SVG conversions)
  useEffect(() => {
    const heicInterval = setInterval(() => {
      if ((window as any).libheif) {
        clearInterval(heicInterval);
        setIsHeifReady(true);
      }
    }, 100);

    const pdfInterval = setInterval(() => {
        if ((window as any).jspdf) {
          clearInterval(pdfInterval);
          setIsPdfReady(true);
        }
    }, 100);

    const svgInterval = setInterval(() => {
        if ((window as any).ImageTracer || (window as any).imagetracer) {
          clearInterval(svgInterval);
          setIsSvgReady(true);
        }
    }, 100);

    return () => {
      clearInterval(heicInterval);
      clearInterval(pdfInterval);
      clearInterval(svgInterval);
    };
  }, []);

  const hasVideoInQueue = useMemo(() => files.some(f => {
      const { isVideo } = getMediaType(f.file);
      return isVideo;
  }), [files]);

  const hasImageInQueue = useMemo(() => files.some(f => {
      const { isImage } = getMediaType(f.file);
      return isImage;
  }), [files]);

  const hasAudioInQueue = useMemo(() => files.some(f => {
      const { isAudio } = getMediaType(f.file);
      return isAudio;
  }), [files]);

  const hasPdfInQueue = useMemo(() => files.some(f => {
    const { isPdf } = getMediaType(f.file);
    return isPdf;
  }), [files]);

  const canUseMediaConversion = isFfmpegReady;
  const gpuStatusLabel = isElectronApp() ? t('electron_ready', language) : t('browser_mode', language);
  
  const updateFileState = useCallback((id: string, newProps: Partial<ConversionFile>) => {
    setFiles(prevFiles =>
      prevFiles.map(f => (f.id === id ? { ...f, ...newProps } : f))
    );
  }, []);

  const addFiles = useCallback((newFiles: { file: File, relativePath: string }[]) => {
    const filesToAdd: ConversionFile[] = newFiles
    .filter(item => isSupportedMedia(item.file))
    .map(item => {
      const { file, relativePath } = item;
      const { isImage, isVideo, isAudio, isPdf } = getMediaType(file);
      
      let defaultFormat: ConversionTarget | null = null;
      if (isVideo) defaultFormat = ConversionTarget.MP4;
      else if (isImage) defaultFormat = ConversionTarget.PNG;
      else if (isAudio) defaultFormat = ConversionTarget.MP3;
      else if (isPdf) defaultFormat = ConversionTarget.TXT;

      return {
        id: crypto.randomUUID(),
        file,
        status: 'pending',
        targetFormat: defaultFormat,
        readProgress: 0,
        progress: 0,
        convertedFileUrl: null,
        error: null,
        relativePath: relativePath,
      };
    });
    setFiles(prev => [...prev, ...filesToAdd]);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const isFolderInput = e.target.id === 'folder-upload' || e.target.id === 'folder-upload-more';

      const filesWithPaths = filesArray.map(file => ({
        file,
        relativePath: isFolderInput && (file as any).webkitRelativePath ? (file as any).webkitRelativePath : (file as any).name
      }));
      
      addFiles(filesWithPaths);
      e.target.value = '';
    }
  };

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);
  
  const handleConvertAll = async () => {
    if (isConverting) return;
    setIsConverting(true);
    setConvertedCount(0);
  
    // Special handling for combining images into a single PDF
    const pdfImageFiles = files.filter(f => {
        const { isImage } = getMediaType(f.file);
        return isImage && f.targetFormat === ConversionTarget.PDF && f.status === 'pending';
    });

    const filesToConvert = files.filter(f => f.status === 'pending' && f.targetFormat && !(combineToPdf && pdfImageFiles.includes(f)));
    const total = (combineToPdf && pdfImageFiles.length > 1 ? 1 : 0) + filesToConvert.length;
    setTotalToConvert(total);
    let currentConverted = 0;

    if (combineToPdf && pdfImageFiles.length > 1) {
      try {
        if (typeof (window as any).jspdf === 'undefined') {
          throw new Error('PDF library not loaded.');
        }
        const { jsPDF } = (window as any).jspdf;
        const doc = new jsPDF();
        pdfImageFiles.forEach(() => doc.deletePage(1)); // Clear initial page
  
        for (let i = 0; i < pdfImageFiles.length; i++) {
          const fileItem = pdfImageFiles[i];
          updateFileState(fileItem.id, { status: 'converting', progress: Math.round((i / pdfImageFiles.length) * 100) });
          
          let imageUrl: string;
          try {
            imageUrl = URL.createObjectURL(fileItem.file);
          } catch (err: any) {
            throw new Error(`Failed to access file "${fileItem.file.name}": ${err.message || 'File might have been moved or deleted.'}`);
          }

          const img = new Image();
          img.src = imageUrl;
          
          try {
            await new Promise<void>((resolve, reject) => { 
              img.onload = () => resolve(); 
              img.onerror = () => reject(new Error(`Failed to load image "${fileItem.file.name}".`));
            });
    
            const orientation = img.width > img.height ? 'l' : 'p';
            doc.addPage([img.width, img.height], orientation);
            doc.addImage(img, 'JPEG', 0, 0, img.width, img.height);
          } finally {
            URL.revokeObjectURL(imageUrl);
          }
        }
  
        const combinedPdfBlob = doc.output('blob');
        const url = URL.createObjectURL(combinedPdfBlob);
  
        // Create a virtual file to represent the combined PDF
        const combinedFileEntry: ConversionFile = {
            id: 'combined-pdf-' + crypto.randomUUID(),
            file: new File([combinedPdfBlob], "combined_document.pdf", { type: "application/pdf" }),
            status: 'success',
            targetFormat: ConversionTarget.PDF,
            convertedFileUrl: url,
            progress: 100, readProgress: 100, error: null,
        };
        setFiles(prev => [combinedFileEntry, ...prev]);

        // Mark original files as success
        pdfImageFiles.forEach(f => updateFileState(f.id, { status: 'success', progress: 100, convertedFileUrl: '#' })); // Use # to indicate it's part of a combo
        currentConverted++;
        setConvertedCount(currentConverted);
      } catch(err: any) {
         pdfImageFiles.forEach(f => updateFileState(f.id, { status: 'error', error: String(err) }));
         currentConverted++;
         setConvertedCount(currentConverted);
      }
    }
  
    for (const fileItem of filesToConvert) {
      updateFileState(fileItem.id, { status: 'reading', readProgress: 0, progress: 0, error: null });
  
      const { id, file, targetFormat, targetDimensions } = fileItem;
      const { isImage, isVideo, isAudio, isPdf } = getMediaType(file);
  
      try {
        let convertedBlob: Blob;
        if (isImage && [ConversionTarget.JPG, ConversionTarget.PNG, ConversionTarget.WEBP, ConversionTarget.HEIC, ConversionTarget.AVIF, ConversionTarget.PDF, ConversionTarget.ICO, ConversionTarget.SVG].includes(targetFormat as any)) {
          if (targetFormat === ConversionTarget.SVG) {
              const tracer = (window as any).ImageTracer || (window as any).imagetracer;
              if (!isSvgReady && !tracer) {
                  throw new Error("SVG Engine not loaded yet. Please wait a moment.");
              }
              if (tracer && !isSvgReady) setIsSvgReady(true);
          }
          convertedBlob = await convertImage(file, targetFormat as any, p => updateFileState(id, { readProgress: p }), targetDimensions);
          updateFileState(id, { status: 'converting' });
        } else if ((isVideo || isAudio) && [ConversionTarget.MP4, ConversionTarget.WEBM, ConversionTarget.WMV, ConversionTarget.MKV, ConversionTarget.MP3, ConversionTarget.WAV, ConversionTarget.FLAC, ConversionTarget.OGG].includes(targetFormat as any)) {
          if (!canUseMediaConversion) {
            throw new Error(t('ffmpeg_not_ready', language));
          }
          
          if (isElectronApp()) {
            // Electron path: use local FFmpeg
            const tempDir = await (window as any).electron.getTempDir();
            const ext = (targetFormat as string).toLowerCase();
            const tempOutput = `${tempDir}/conversion_${Date.now()}.${ext}`;
            
            // Read file into buffer
            const buffer = await file.arrayBuffer();
            const tempInput = `${tempDir}/input_${Date.now()}${file.name.substring(file.name.lastIndexOf('.'))}`;
            
            // Write input file (note: in real Electron app this would be handled differently)
            // For now, create blob URL and read from it
            const inputUrl = URL.createObjectURL(file);
            
            await convertMediaElectron(inputUrl, tempOutput, ext, targetDimensions,
              p => updateFileState(id, { progress: p, status: 'converting' })
            );
            
            // Read output file
            const response = await fetch(`file://${tempOutput}`);
            convertedBlob = await response.blob();
            URL.revokeObjectURL(inputUrl);
          } else {
            // Browser fallback (if electron not available)
            throw new Error('Media conversion requires Electron application');
          }
        } else if (isPdf && targetFormat === ConversionTarget.TXT) {
           convertedBlob = await convertPdfToText(file, p => updateFileState(id, { progress: p }));
           updateFileState(id, { status: 'converting' });
        } else {
          throw new Error('Unsupported file type or target format.');
        }
        
        const url = URL.createObjectURL(convertedBlob);
        updateFileState(id, { convertedFileUrl: url, status: 'success', progress: 100 });
        currentConverted++;
        setConvertedCount(currentConverted);
      } catch (err: any) {
        const message = String(err);
        updateFileState(id, { error: message, status: 'error' });
        currentConverted++;
        setConvertedCount(currentConverted);
      }
    }
  
    setIsConverting(false);
  };
  
  
  const reset = () => {
    files.forEach(f => {
      if (f.convertedFileUrl) URL.revokeObjectURL(f.convertedFileUrl);
    });
    setFiles([]);
    setIsConverting(false);
    setShowEncryptionInfo(false);
    setCurrentPage(1);
  };

  const onDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsTraversing(true);
    setShowEncryptionInfo(false);

    const items = event.dataTransfer.items;
    let droppedFiles: { file: File, relativePath: string }[] = [];
    
    if (items && items.length > 0 && (items[0] as any).webkitGetAsEntry) {
        const promises = Array.from(items).map(item => {
            const entry = (item as any).webkitGetAsEntry() as FileSystemEntry;
            if (entry) {
                return traverseDirectory(entry);
            }
            return Promise.resolve([]);
        });

        try {
            const fileArrays = await Promise.all(promises);
            droppedFiles = fileArrays.flat();
        } catch (error: any) {
            console.error("Error processing dropped files:", error);
            const fallbackFiles = (Array.from(event.dataTransfer.files) as File[]).filter(f => isSupportedMedia(f));
            droppedFiles = fallbackFiles.map((f: any) => ({ file: f, relativePath: f.name }));
        }
    } else {
        const fallbackFiles = (Array.from(event.dataTransfer.files) as File[]).filter(f => isSupportedMedia(f));
        droppedFiles = fallbackFiles.map((f: any) => ({ file: f, relativePath: f.name }));
    }

    if (droppedFiles.length > 0) {
        addFiles(droppedFiles);
    }
    setIsTraversing(false);
  }, [addFiles]);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const successfulConversions = useMemo(() => files.filter(f => f.status === 'success' && f.convertedFileUrl && f.convertedFileUrl !== '#'), [files]);

  const openPasswordModal = () => {
    if (successfulConversions.length < 1) return;
    setIsPasswordModalOpen(true);
  };

  const createAndDownloadZip = async (password: string | null) => {
    setIsPasswordModalOpen(false);
    const zip = (window as any).zip;
    if (!zip) {
        console.error("zip.js library is not loaded.");
        alert("Error: Zipping library not found. Please refresh the page.");
        return;
    }
    if (successfulConversions.length < 1) return;

    setIsDownloadingZip(true);
    setShowEncryptionInfo(false);

    let zipWriter: any = null;

    try {
        zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"));
        const usedPaths = new Set<string>();

        for (const fileItem of successfulConversions) {
            const path = fileItem.relativePath || fileItem.file.name;
            const normalizedPath = path.replace(/\\/g, '/');
            
            const lastDotIndex = normalizedPath.lastIndexOf('.');
            const pathWithoutExt = lastDotIndex === -1 ? normalizedPath : normalizedPath.substring(0, lastDotIndex);
            const targetExt = fileItem.targetFormat?.toLowerCase() || 'dat';
            const baseFileName = `${pathWithoutExt}.${targetExt}`;
            
            let finalFileName = baseFileName;
            let counter = 1;

            // Ensure uniqueness in our own tracking set
            while (usedPaths.has(finalFileName)) {
                 const dotIndex = baseFileName.lastIndexOf('.');
                 if (dotIndex !== -1) {
                     finalFileName = `${baseFileName.substring(0, dotIndex)} (${counter})${baseFileName.substring(dotIndex)}`;
                 } else {
                     finalFileName = `${baseFileName} (${counter})`;
                 }
                 counter++;
            }

            let added = false;
            let retryCount = 0;
            const maxRetries = 10; 

            while (!added && retryCount < maxRetries) {
                try {
                    const res = await fetch(fileItem.convertedFileUrl!);
                    if (!res.ok) throw new Error("Fetch failed");
                    const blob = await res.blob();
                    const blobReader = new zip.BlobReader(blob);

                    const options: any = {};
                    if (password) {
                        options.password = password;
                        options.encryption = "AES-256";
                    }

                    await zipWriter.add(finalFileName, blobReader, options);
                    usedPaths.add(finalFileName);
                    added = true;
                } catch (error: any) {
                     console.warn(`Failed to add ${finalFileName} to zip (attempt ${retryCount + 1}):`, error);
                     
                     const dotIndex = baseFileName.lastIndexOf('.');
                     if (dotIndex !== -1) {
                         finalFileName = `${baseFileName.substring(0, dotIndex)} (${counter})${baseFileName.substring(dotIndex)}`;
                     } else {
                         finalFileName = `${baseFileName} (${counter})`;
                     }
                     counter++;
                     retryCount++;
                }
            }
            if (!added) {
                console.error(`Failed to add ${fileItem.file.name} to zip after multiple retries. Skipping.`);
            }
        }

        const zipBlob = await zipWriter.close();
        zipWriter = null; 
        
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${zipFileName || 'converted-files'}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (password) {
            setShowEncryptionInfo(true);
        }

    } catch (err: any) {
        console.error("Error creating ZIP file", err);
        alert("An error occurred while creating the ZIP file. Check console for details.");
    } finally {
        if (zipWriter) {
             try { await zipWriter.close(); } catch(e: any) { /* ignore */ }
        }
        setIsDownloadingZip(false);
    }
  };

  const isAnyHeicOrAvif = useMemo(() => files.some(f => (f.targetFormat === ConversionTarget.HEIC || f.targetFormat === ConversionTarget.AVIF) && f.status === 'pending'), [files]);
  const isAnyPdf = useMemo(() => files.some(f => f.targetFormat === ConversionTarget.PDF && f.status === 'pending'), [files]);
  const isReadyToConvert = useMemo(() => files.some(f => f.status === 'pending'), [files]);

  // Removed isFfmpegReady check from disabled state to allow immediate interaction on fast PCs
  const convertAllDisabled = isConverting || !isReadyToConvert || isTraversing;
  
  const getConvertAllButtonText = () => {
    if (isConverting) {
      return `${t('converting_status', language)} (${convertedCount}/${totalToConvert})`;
    }
    return t('convert_all', language);
  };
  
  const handleApplyBulkImageFormat = () => {
    if (!bulkImageFormat) return;
    setFiles(prevFiles =>
      prevFiles.map(f => {
        const { isImage } = getMediaType(f.file);
        if (isImage) {
          return { ...f, targetFormat: bulkImageFormat as ConversionTarget };
        }
        return f;
      })
    );
  };

  const handleApplyBulkVideoFormat = () => {
    if (!bulkVideoFormat) return;
    setFiles(prevFiles =>
      prevFiles.map(f => {
        const { isVideo } = getMediaType(f.file);
        if (isVideo) {
          return { ...f, targetFormat: bulkVideoFormat as ConversionTarget };
        }
        return f;
      })
    );
  };

  const handleApplyBulkAudioFormat = () => {
    if (!bulkAudioFormat) return;
    setFiles(prevFiles =>
      prevFiles.map(f => {
        const { isAudio } = getMediaType(f.file);
        if (isAudio) {
          return { ...f, targetFormat: bulkAudioFormat as ConversionTarget };
        }
        return f;
      })
    );
  };

  // Pagination Calculation
  const totalPages = Math.ceil(files.length / ITEMS_PER_PAGE);
  
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  useEffect(() => {
    if (listRef.current) {
        listRef.current.scrollTop = 0;
    }
  }, [currentPage]);

  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return files.slice(start, start + ITEMS_PER_PAGE);
  }, [files, currentPage]);


  const UploadArea = () => {
    if (isTraversing) {
        return (
            <div className="border-2 border-dashed border-gray-400 dark:border-gray-600 rounded-lg p-12 text-center">
                <div className="flex justify-center items-center space-x-2 text-gray-600 dark:text-gray-400">
                    <svg className="animate-spin h-5 w-5 text-cyan-600 dark:text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{t('processing_folders', language)}</span>
                </div>
            </div>
        );
    }

    return (
        <div 
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="border-2 border-dashed border-gray-400 dark:border-gray-600 rounded-lg p-12 text-center cursor-pointer hover:border-cyan-500 dark:hover:border-cyan-400 transition"
        >
            <input
              id="file-upload"
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
              accept="image/*,video/*,audio/*,application/pdf"
            />
            <input
                id="folder-upload"
                type="file"
                multiple
                {...{ webkitdirectory: "" }}
                className="hidden"
                onChange={handleFileChange}
            />
             <div className="flex flex-col items-center justify-center space-y-4">
                <p className="text-gray-600 dark:text-gray-400">{t('drop_files_here', language)}</p>
                <p className="text-gray-500 text-sm">{t('or', language)}</p>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                    <label htmlFor="file-upload" className="cursor-pointer bg-cyan-500 text-white font-bold py-2 px-4 rounded hover:bg-cyan-600 transition">
                        {t('browse_files', language)}
                    </label>
                    <label htmlFor="folder-upload" className="cursor-pointer bg-blue-500 text-white font-bold py-2 px-4 rounded hover:bg-blue-600 transition">
                        {t('browse_folder', language)}
                    </label>
                </div>
            </div>
        </div>
    );
  }

  const languages: { code: string, name: string, flag: string }[] = [
    { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
  ];

  return (
    <div className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white min-h-screen flex flex-col items-center p-4 transition-colors duration-300">
      {isPasswordModalOpen && <PasswordModal onConfirm={createAndDownloadZip} onCancel={() => setIsPasswordModalOpen(false)} lang={language} />}
      {showEncryptionInfo && <EncryptionInfoAlert onClose={() => setShowEncryptionInfo(false)} lang={language} />}
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 sm:p-8 space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold text-cyan-600 dark:text-cyan-400">{t('app_title', language)}</h1>
            <div className="flex items-center space-x-4 relative">
                <button onClick={toggleTheme} className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    {theme === 'dark' ? 
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> :
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                    }
                </button>
                <button onClick={() => setShowSettings(prev => !prev)} className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors" aria-label="Settings">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700 dark:text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.3.183 2.573-1.066z" /><circle cx="12" cy="12" r="3" /></svg>
                </button>
                {showSettings && (
                  <div className="absolute right-0 top-12 w-72 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-xl p-4 space-y-3 z-20">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('settings_title', language)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{gpuStatusLabel}</p>
                      </div>
                      <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-200">×</button>
                    </div>
                    <p className="text-[11px] leading-5 text-gray-500 dark:text-gray-400">{t('electron_status', language)}</p>
                  </div>
                )}
                <select value={language} onChange={e => setLanguage(e.target.value)} className="bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-2 pl-3 pr-8 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                    {languages.map(lang => <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>)}
                </select>
            </div>
        </div>
        
        {files.length === 0 ? (
          <UploadArea />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
              <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{t('queue_title', language)} ({files.length})</h2>
              <div className="flex space-x-2">
                <button onClick={handleConvertAll} disabled={convertAllDisabled} className="bg-green-500 text-white font-bold py-2 px-4 rounded hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed transition">
                  {getConvertAllButtonText()}
                </button>
                <button onClick={reset} disabled={isConverting || isTraversing} className="bg-red-500 text-white font-bold py-2 px-4 rounded hover:bg-red-600 disabled:bg-gray-500 transition">
                  {t('clear_all', language)}
                </button>
              </div>
            </div>

            {files.length > 1 && (
              <div className="bg-gray-200 dark:bg-gray-700/50 p-4 rounded-lg space-y-4 border border-gray-300 dark:border-gray-600">
                <h3 className="text-lg font-semibold text-cyan-700 dark:text-cyan-300">
                  {t('bulk_actions', language)}
                  {isConverting && <span className="ml-2 text-sm font-normal text-gray-500">({convertedCount}/{totalToConvert})</span>}
                </h3>
                <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hasImageInQueue && (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-end gap-2">
                            <div className="flex-grow">
                                <label htmlFor="bulk-image-format" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('apply_format_images', language)}</label>
                                <select
                                id="bulk-image-format"
                                value={bulkImageFormat}
                                onChange={(e) => setBulkImageFormat(e.target.value)}
                                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                >
                                <option value="">{t('select_format', language)}</option>
                                {[ConversionTarget.JPG, ConversionTarget.PNG, ConversionTarget.WEBP, ConversionTarget.HEIC, ConversionTarget.AVIF, ConversionTarget.PDF, ConversionTarget.ICO, ConversionTarget.SVG].map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>
                            <button onClick={handleApplyBulkImageFormat} disabled={!bulkImageFormat || isConverting} className="bg-cyan-500 text-white font-bold py-2 px-4 rounded hover:bg-cyan-600 disabled:bg-gray-500 transition h-[42px]">{t('apply', language)}</button>
                        </div>
                        {bulkImageFormat === ConversionTarget.PDF && (
                            <div className="flex items-center space-x-2 mt-2">
                                <input type="checkbox" id="combine-pdf-checkbox" checked={combineToPdf} onChange={e => setCombineToPdf(e.target.checked)} className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-cyan-600 focus:ring-cyan-500 bg-gray-100 dark:bg-gray-900" />
                                <label htmlFor="combine-pdf-checkbox" className="text-sm text-gray-700 dark:text-gray-300">{t('combine_to_pdf', language)}</label>
                            </div>
                        )}
                    </div>
                  )}
                  {hasVideoInQueue && (
                    <div className="flex items-end gap-2">
                      <div className="flex-grow">
                        <label htmlFor="bulk-video-format" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('apply_format_videos', language)}</label>
                        <select
                          id="bulk-video-format"
                          value={bulkVideoFormat}
                          onChange={(e) => setBulkVideoFormat(e.target.value)}
                          disabled={!canUseMediaConversion}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60"
                        >
                          <option value="">{t('select_format', language)}</option>
                          {[ConversionTarget.MP4, ConversionTarget.WEBM, ConversionTarget.WMV, ConversionTarget.MKV].map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <button onClick={handleApplyBulkVideoFormat} disabled={!bulkVideoFormat || isConverting} className="bg-cyan-500 text-white font-bold py-2 px-4 rounded hover:bg-cyan-600 disabled:bg-gray-500 transition h-[42px]">{t('apply', language)}</button>
                    </div>
                  )}
                  {hasAudioInQueue && (
                    <div className="flex items-end gap-2">
                      <div className="flex-grow">
                        <label htmlFor="bulk-audio-format" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('apply_format_audio', language)}</label>
                        <select
                          id="bulk-audio-format"
                          value={bulkAudioFormat}
                          onChange={(e) => setBulkAudioFormat(e.target.value)}
                          disabled={!canUseMediaConversion}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60"
                        >
                          <option value="">{t('select_format', language)}</option>
                          {[ConversionTarget.MP3, ConversionTarget.WAV, ConversionTarget.FLAC, ConversionTarget.OGG].map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <button onClick={handleApplyBulkAudioFormat} disabled={!bulkAudioFormat || isConverting} className="bg-cyan-500 text-white font-bold py-2 px-4 rounded hover:bg-cyan-600 disabled:bg-gray-500 transition h-[42px]">{t('apply', language)}</button>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* ZIP Export Paneel */}
            {successfulConversions.length > 0 && (
              <div className="bg-gray-200 dark:bg-gray-700/50 p-4 rounded-lg space-y-4 border border-gray-300 dark:border-gray-600 animate-scale-in">
                <h3 className="text-lg font-semibold text-cyan-700 dark:text-cyan-300">{t('download_all_zip', language)}</h3>
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-grow w-full">
                    <label htmlFor="zip-name" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('zip_filename', language)}</label>
                    <input
                      id="zip-name"
                      type="text"
                      value={zipFileName}
                      onChange={(e) => setZipFileName(e.target.value)}
                      placeholder="converted-files"
                      className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <button 
                    onClick={openPasswordModal} 
                    disabled={isDownloadingZip} 
                    className="w-full sm:w-auto bg-blue-500 text-white font-bold py-2 px-6 rounded hover:bg-blue-600 disabled:bg-gray-500 transition h-[42px] flex items-center justify-center space-x-2"
                  >
                    {isDownloadingZip ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{t('zipping', language)}</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>{t('download_all_zip', language)}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
            
            {/* Pagination Controls Top */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2 text-sm">
                    <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1 px-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition">
                         &laquo;
                    </button>
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 px-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition">
                        &lsaquo;
                    </button>
                    <span className="text-gray-700 dark:text-gray-300 mx-2">
                        {t('page', language)} {currentPage} {t('of', language)} {totalPages}
                    </span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 px-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition">
                        &rsaquo;
                    </button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1 px-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition">
                        &raquo;
                    </button>
                </div>
            )}

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2" ref={listRef}>
              {paginatedFiles.map(fileItem => <FileItemMemo key={fileItem.id} fileItem={fileItem} isConverting={isConverting} updateFileState={updateFileState} removeFile={removeFile} lang={language} />)}
            </div>

            {/* Pagination Controls Bottom */}
             {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2 text-sm pt-2">
                    <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <span className="text-gray-700 dark:text-gray-300 font-medium px-2">
                        {t('page', language)} {currentPage} {t('of', language)} {totalPages}
                    </span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 15.707a1 1 0 001.414 0l5-5a1 1 0 000-1.414l-5-5a1 1 0 00-1.414 1.414L8.586 10l-4.293 4.293a1 1 0 000 1.414zm6 0a1 1 0 001.414 0l5-5a1 1 0 000-1.414l-5-5a1 1 0 00-1.414 1.414L14.586 10l-4.293 4.293a1 1 0 000 1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            )}
            
            <div 
              onDrop={onDrop}
              onDragOver={onDragOver}
              className="border-2 border-dashed border-gray-400 dark:border-gray-700 rounded-lg p-6 text-center hover:border-cyan-500 dark:hover:border-cyan-400 transition"
            >
              <input id="file-upload-more" type="file" multiple className="hidden" onChange={handleFileChange} accept="image/*,video/*,audio/*,application/pdf" />
              <input
                id="folder-upload-more"
                type="file"
                multiple
                {...{ webkitdirectory: "" }}
                className="hidden"
                onChange={handleFileChange}
              />
              {isTraversing ? (
                  <div className="flex justify-center items-center space-x-2 text-gray-600 dark:text-gray-400">
                    <svg className="animate-spin h-5 w-5 text-cyan-600 dark:text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{t('processing', language)}</span>
                  </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {t('add_more_files_prompt', language)}
                  <label htmlFor="file-upload-more" className="cursor-pointer text-cyan-600 dark:text-cyan-400 hover:underline px-1">
                      {t('add_files_link', language)}
                  </label>
                  {t('or', language)}
                  <label htmlFor="folder-upload-more" className="cursor-pointer text-cyan-600 dark:text-cyan-400 hover:underline pl-1">
                      {t('add_folder_link', language)}
                  </label>.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Engine Status Footer */}
      <div className="mt-6 flex flex-wrap justify-center gap-4 text-[10px] uppercase tracking-widest font-bold opacity-50">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isFfmpegReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
          <span>{t('media_engine', language)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isElectronApp() ? 'bg-green-500' : 'bg-blue-500'}`}></div>
          <span>{isElectronApp() ? 'Electron' : 'Browser'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isHeifReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
          <span>{t('heif_avif_engine', language)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isPdfReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
          <span>{t('pdf_engine', language)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isSvgReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
          <span>{t('svg_engine', language)}</span>
        </div>
      </div>
    </div>
  );
};

interface FileItemProps {
  fileItem: ConversionFile;
  isConverting: boolean;
  updateFileState: (id: string, newProps: Partial<ConversionFile>) => void;
  removeFile: (id: string) => void;
  lang: string;
}

const FileItem = memo<FileItemProps>(({ fileItem, isConverting, updateFileState, removeFile, lang }) => {
  const { id, file, status, targetFormat, readProgress, progress, convertedFileUrl, error, targetDimensions } = fileItem;

  const { isImage, isVideo, isAudio, isPdf } = getMediaType(file);
  const isProcessing = status === 'reading' || status === 'converting';

  const availableFormats = useMemo(() => {
    if (isImage) return [ConversionTarget.JPG, ConversionTarget.PNG, ConversionTarget.WEBP, ConversionTarget.HEIC, ConversionTarget.AVIF, ConversionTarget.PDF, ConversionTarget.ICO, ConversionTarget.SVG];
    if (isVideo) return [ConversionTarget.MP4, ConversionTarget.WEBM, ConversionTarget.WMV, ConversionTarget.MKV];
    if (isAudio) return [ConversionTarget.MP3, ConversionTarget.WAV, ConversionTarget.FLAC, ConversionTarget.OGG];
    if (isPdf) return [ConversionTarget.TXT];
    return [];
  }, [isImage, isVideo, isAudio, isPdf]);

  const handleDimensionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'original') {
        updateFileState(id, { targetDimensions: undefined });
    } else {
        const [width, height] = value.split('x').map(Number);
        updateFileState(id, { targetDimensions: { width, height }});
    }
  };

  return (
    <div className="bg-gray-200 dark:bg-gray-700/50 p-4 rounded-lg space-y-3">
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-3 overflow-hidden">
          <FileIcon type={file.type} name={file.name} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate text-gray-900 dark:text-white">{file.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{formatBytes(file.size)}</p>
          </div>
        </div>
        <button onClick={() => removeFile(id)} disabled={isConverting} className="text-gray-500 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 ml-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {status === 'pending' && (
        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <label htmlFor={`format-${id}`} className="sr-only">{t('select_format', lang)}</label>
            <select
              id={`format-${id}`}
              value={targetFormat ?? ''}
              onChange={e => updateFileState(id, { targetFormat: e.target.value as ConversionTarget })}
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              disabled={isConverting}
            >
              <option value="" disabled>{t('select_format', lang)}</option>
              {availableFormats.map(format => <option key={format} value={format}>{format}</option>)}
            </select>
          </div>
          {(isImage || isVideo) && (
            <div>
              <label htmlFor={`dimensions-${id}`} className="sr-only">{t('resize', lang)}</label>
              <select
                id={`dimensions-${id}`}
                value={targetDimensions ? `${targetDimensions.width}x${targetDimensions.height}` : 'original'}
                onChange={handleDimensionChange}
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                disabled={isConverting}
              >
                <option value="original">{t('original_size', lang)}</option>
                {Object.entries(resolutions).map(([aspectRatio, resList]) => (
                    <optgroup label={aspectRatio} key={aspectRatio}>
                        {resList.map(res => <option key={res.value} value={res.value}>{res.label}</option>)}
                    </optgroup>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {isProcessing && (
        <div className="space-y-2">
          {status === 'reading' && <ProgressBar label={t('loading', lang)} progress={readProgress} color="cyan" />}
          {status === 'converting' && <ProgressBar label={t('converting', lang)} progress={progress} color="green" />}
        </div>
      )}

      {status === 'success' && convertedFileUrl && (
        <div className="space-y-3">
            {convertedFileUrl === '#' ? (
                <div className="text-center p-4 bg-green-100 dark:bg-green-900/50 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-300">✅ {t('combine_to_pdf', lang)}</p>
                </div>
            ) : targetFormat === ConversionTarget.HEIC || targetFormat === ConversionTarget.AVIF || targetFormat === ConversionTarget.PDF ? (
               <div className="bg-gray-300 dark:bg-gray-700 p-4 rounded-lg text-center max-w-xs mx-auto">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                 <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{targetFormat} {t('preview_not_supported', lang)}</p>
               </div>
            ) : isVideo ? (
                <video src={convertedFileUrl} controls loop className="max-w-full max-h-48 mx-auto rounded-lg" />
            ) : isAudio ? (
                <audio src={convertedFileUrl} controls className="w-full" />
            ) : isPdf ? (
                <div className="bg-gray-300 dark:bg-gray-700 p-4 rounded-lg text-center max-w-xs mx-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">Text Extracted</p>
                </div>
            ) : (
                <img src={convertedFileUrl} alt="Converted preview" className="max-w-xs max-h-48 mx-auto rounded-lg" />
            )}
          {convertedFileUrl !== '#' && <a href={convertedFileUrl} download={`${file.name.split('.').slice(0, -1).join('.')}.${targetFormat?.toLowerCase()}`}
            className="block w-full text-center bg-blue-500 text-white font-bold py-2 px-4 rounded hover:bg-blue-600 transition"
          >
            {t('download', lang)}
          </a>}
        </div>
      )}
      
      {status === 'error' && (
        <div className="text-center bg-red-200 dark:bg-red-900/50 border border-red-400 dark:border-red-700 p-2 rounded-lg">
          <p className="text-red-700 dark:text-red-400 text-sm font-semibold">{t('conversion_failed', lang)}</p>
          {error && <p className="text-red-600 dark:text-red-500 text-xs mt-1">{error}</p>}
        </div>
      )}
    </div>
  );
});

const FileItemMemo = FileItem;

const ProgressBar: React.FC<{label: string; progress: number, color: 'cyan' | 'green'}> = ({label, progress, color}) => {
    const progressColor = color === 'cyan' ? 'bg-cyan-500' : 'bg-green-500';
    const textColor = color === 'cyan' ? 'text-cyan-600 dark:text-cyan-400' : 'text-green-600 dark:text-green-400';
    
    return (
        <div className="w-full space-y-1">
            <p className={`text-center text-xs font-semibold ${textColor}`}>{label} {progress >= 0 && progress <= 100 ? `${progress}%` : ''}</p>
            <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2.5 relative overflow-hidden">
                <div
                className={`${progressColor} h-2.5 rounded-full transition-all duration-300`}
                style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
    );
}

const FileIcon: React.FC<{ type: string; name: string }> = ({ type, name }) => {
    const { isImage, isVideo, isAudio, isPdf } = getMediaType(new File([], name, { type }));
    
    const icon = useMemo(() => {
        if (isImage) return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />;
        if (isVideo) return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2-2v8a2 2 0 002 2z" />;
        if (isAudio) return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 6l12-3" />;
        if (isPdf) return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />;
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />;
    }, [isImage, isVideo, isAudio, isPdf]);

    return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {icon}
        </svg>
    )
};

export default App;