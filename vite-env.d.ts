/// <reference types="vite/client" />

declare module '*.mjs?url' {
  const url: string;
  export default url;
}

declare module '*?url' {
  const url: string;
  export default url;
}

declare module 'imagetracerjs' {
  interface ImageTracerApi {
    imageToSVG(
      imageData: string,
      callback: (svg: string) => void,
      options?: string | Record<string, unknown>
    ): void;
  }

  const ImageTracer: ImageTracerApi;
  export default ImageTracer;
}

declare global {
  interface Window {
    electronAPI: {
      getFfmpegPath: () => Promise<string>;
      getGpuInfo: () => Promise<{ hasDedicatedGpu: boolean; vendor: string; name: string; encoder: string | null }>;
      checkForUpdate: () => Promise<{ version: string; releaseUrl: string; downloadUrl: string; fileName: string } | null>;
      downloadAndInstallUpdate: (update: { version: string; releaseUrl: string; downloadUrl: string; fileName: string }) => Promise<boolean>;
      cancelConversion: () => Promise<boolean>;
      getWallpaper: () => Promise<{ enabled: boolean; path: string | null; dataUrl: string | null }>;
      chooseWallpaper: () => Promise<{ enabled: boolean; path: string | null; dataUrl: string | null }>;
      disableWallpaper: () => Promise<{ enabled: boolean; path: string | null; dataUrl: string | null }>;
      getFilePath: (file: File) => string;
      convertMedia: (fileData: ArrayBuffer | string, fileName: string, targetFormat: string) => Promise<ArrayBuffer>;
      transcribeAudio: (fileData: ArrayBuffer, fileName: string, targetFormat: string) => Promise<string>;
      onTranscriptionProgress: (callback: (progress: number) => void) => () => void;
      readFile: (filePath: string) => Promise<ArrayBuffer>;
      writeFile: (filePath: string, data: ArrayBuffer) => Promise<boolean>;
      setCrashLogLanguage: (language: string) => Promise<boolean>;
      beginOperationLogBatch: () => Promise<boolean>;
      completeOperationLogBatch: (status: 'success' | 'failed' | 'cancelled', summary: {
        startedAt: string;
        finishedAt: string;
        groups: Array<{
          fromFormat: string;
          toFormat: string;
          functionName: string;
          fileNames: string[];
          fileName?: string;
          count: number;
          totalBytes: number;
          status: 'success' | 'failed';
          failures: Array<{ message: string; stack?: string }>;
        }>;
      }) => Promise<boolean>;
      writeCrashLog: (record: {
        event: string;
        functionName?: string;
        fileName?: string;
        fileNames?: string[];
        count?: number;
        succeededCount?: number;
        failedCount?: number;
        format?: string;
        destination?: string;
        status?: string;
        details?: string;
        reason?: string;
        error?: { name?: string; message?: string; stack?: string; exitCode?: number; stderr?: string } | string;
      }) => Promise<boolean>;
      stageFile: (fileData: ArrayBuffer | string, fileName: string) => Promise<string>;
      cleanupStagedFile: (filePath: string) => Promise<boolean>;
      deleteSourceFile: (filePath: string) => Promise<boolean>;
      compressFolders: (folderPaths: string[], format: string, outputDirectory?: string) => Promise<Array<{ folderPath: string; outputPath?: string; error?: string }>>;
      saveFile: (options: any) => Promise<string | null>;
      getVaultStatus: () => Promise<{ enabled: boolean; outputDirectory?: string; quotaBytes?: number }>;
      createVault: (options: { outputDirectory: string; password: string; quotaGb: number }) => Promise<{ enabled: boolean; outputDirectory: string; quotaBytes: number }>;
      disableVault: () => Promise<boolean>;
      saveVaultFile: (options: { data?: ArrayBuffer; filePath?: string; fileName: string; password: string; count?: number }) => Promise<{ storagePath: string; bytes: number }>;
      listVaultFiles: (options: { password: string }) => Promise<Array<{ storageName: string; fileName: string; bytes: number; modifiedAt: number }>>;
      exportVaultFile: (options: { storageName: string; fileName: string; password: string }) => Promise<string | null>;
      deleteVaultFile: (options: { storageName: string; password: string }) => Promise<boolean>;
      extractArchive: (filePath: string, outputDirectory?: string, fileName?: string, password?: string) => Promise<string | { passwordRequired: true; invalidPassword?: boolean }>;
    };
  }
}
