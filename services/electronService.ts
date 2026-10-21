/**
 * Electron IPC Service for Local File Conversions
 * Replaces browser-based FFmpeg with local Electron FFmpeg
 */

export const isElectronApp = () => {
  return typeof window !== 'undefined' && !!(window as any).electron;
};

export const selectFiles = async (): Promise<string[]> => {
  if (!isElectronApp()) return [];
  return (window as any).electron.selectFiles();
};

export const selectFolder = async (): Promise<string> => {
  if (!isElectronApp()) return '';
  return (window as any).electron.selectFolder();
};

export const convertMediaElectron = async (
  inputPath: string,
  outputPath: string,
  format: string,
  targetDimensions?: { width: number; height: number },
  onProgress?: (progress: number) => void
): Promise<void> => {
  if (!isElectronApp()) {
    throw new Error('This feature requires Electron');
  }

  // Register progress listener
  if (onProgress) {
    (window as any).electron.onConversionProgress(({ progress, inputPath: filePath }: any) => {
      if (filePath === inputPath) {
        onProgress(progress);
      }
    });
  }

  try {
    const result = await (window as any).electron.convertMedia({
      inputPath,
      outputPath,
      format,
      targetDimensions,
    });

    if (!result.success) {
      throw new Error(result.error || 'Conversion failed');
    }
  } finally {
    // Cleanup listener
    (window as any).electron.removeConversionProgressListener();
  }
};

export const getHomeDir = async (): Promise<string> => {
  if (!isElectronApp()) return '';
  return (window as any).electron.getHomeDir();
};

export const getTempDir = async (): Promise<string> => {
  if (!isElectronApp()) return '';
  return (window as any).electron.getTempDir();
};
