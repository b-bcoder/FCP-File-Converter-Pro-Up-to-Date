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
  SRT = 'SRT',
  HTML = 'HTML',
  CSV = 'CSV',
  JSON = 'JSON',
  // Archive actions
  EXTRACT = 'EXTRACT',
  // 3D model formats
  STL = 'STL',
  OBJ = 'OBJ',
  FBX = 'FBX',
  GLTF = 'GLTF',
  GLB = 'GLB',
}

export enum FolderArchiveFormat {
  ZIP = 'ZIP',
  SEVEN_ZIP = '7Z',
  TAR = 'TAR',
  GZ = 'GZ/TGZ',
  BZ2 = 'BZ2/TBZ',
  XZ = 'XZ/TXZ',
  LZMA = 'LZMA',
  CAB = 'CAB',
}

export type FileStatus = 'pending' | 'reading' | 'converting' | 'success' | 'error';

export interface ConversionFile {
  id: string;
  file: File;
  status: FileStatus;
  targetFormat: ConversionTarget | null;
  readProgress: number;
  progress: number;
  etaSeconds?: number | null;
  convertedFileUrl: string | null;
  outputPath?: string;
  error: string | null;
  relativePath?: string;
}