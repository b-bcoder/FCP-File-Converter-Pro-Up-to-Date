export enum ConversionTarget {
  // Image formats
  JPG = 'JPG',
  PNG = 'PNG',
  WEBP = 'WEBP',
  HEIC = 'HEIC',
  AVIF = 'AVIF',
  PDF = 'PDF',
  ICO = 'ICO',
  SVG = 'SVG',
  // Video formats
  MP4 = 'MP4',
  WEBM = 'WEBM',
  WMV = 'WMV',
  MKV = 'MKV',
  // Audio formats
  MP3 = 'MP3',
  WAV = 'WAV',
  FLAC = 'FLAC',
  OGG = 'OGG',
  // Document formats
  TXT = 'TXT',
}

export type FileStatus = 'pending' | 'reading' | 'converting' | 'success' | 'error';

export interface ConversionFile {
  id: string;
  file: File;
  status: FileStatus;
  targetFormat: ConversionTarget | null;
  targetDimensions?: { width: number; height: number; };
  readProgress: number;
  progress: number;
  convertedFileUrl: string | null;
  error: string | null;
  relativePath?: string;
}