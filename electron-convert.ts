import * as ffmpeg from 'fluent-ffmpeg';
import * as ffmpegStatic from 'ffmpeg-static';
import * as fs from 'fs';
import * as path from 'path';

// Set the path to the FFmpeg binary
if (ffmpegStatic.path) {
  ffmpeg.setFfmpegPath(ffmpegStatic.path);
}

export const convertMediaLocal = (
  inputPath: string,
  outputPath: string,
  format: string,
  targetDimensions?: { width: number; height: number },
  onProgress?: (progress: number) => void
): Promise<void> => {
  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);

    // Handle video-specific options
    if (['mp4', 'webm', 'wmv', 'mkv'].includes(format.toLowerCase())) {
      if (targetDimensions) {
        command = command.size(`${targetDimensions.width}x${targetDimensions.height}`);
      }
      command = command
        .videoBitrate('2500k')
        .videoCodec('libx264')
        .audioCodec('aac')
        .audioBitrate('192k');
    }

    // Handle audio-specific options
    if (['mp3', 'wav', 'flac', 'ogg'].includes(format.toLowerCase())) {
      if (format.toLowerCase() === 'mp3') {
        command = command.audioCodec('libmp3lame').audioBitrate('192k');
      } else if (format.toLowerCase() === 'wav') {
        command = command.audioCodec('pcm_s16le');
      } else if (format.toLowerCase() === 'flac') {
        command = command.audioCodec('flac');
      } else if (format.toLowerCase() === 'ogg') {
        command = command.audioCodec('libvorbis').audioBitrate('192k');
      }
    }

    // Set output format
    const ext = format.toLowerCase();
    command = command.format(ext === 'mkv' ? 'matroska' : ext);

    command
      .on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.min(progress.percent, 100));
        }
      })
      .on('end', () => {
        resolve();
      })
      .on('error', (err) => {
        reject(new Error(`FFmpeg conversion failed: ${err.message}`));
      })
      .save(outputPath);
  });
};
