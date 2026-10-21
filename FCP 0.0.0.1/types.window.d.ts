export interface ElectronAPI {
  selectFiles: () => Promise<string[]>;
  selectFolder: () => Promise<string>;
  convertMedia: (config: {
    inputPath: string;
    outputPath: string;
    format: string;
    targetDimensions?: { width: number; height: number };
  }) => Promise<{ success: boolean; error?: string }>;
  onConversionProgress: (callback: (data: { progress: number; inputPath: string }) => void) => void;
  removeConversionProgressListener: () => void;
  getHomeDir: () => Promise<string>;
  getTempDir: () => Promise<string>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
