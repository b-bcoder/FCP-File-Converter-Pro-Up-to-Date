# Changelog

All major changes to File Converter Pro are recorded in this file.

This project uses the structure of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.7-patch2] - 2026-09-15

### Changed

- Improved conversion error handling so FFmpeg failures are summarized into short, readable messages instead of long raw error dumps
- Reduced noisy conversion failure output to make troubleshooting faster and clearer for end users

## [1.0.7-patch1] - 2026-09-15

### Changed

- Improved language text consistency across the onboarding flow and settings screens
- Fixed remaining untranslated and incorrect UI wording so the selected language is applied consistently throughout the app

## [1.0.7] - 2026-09-10

### Added

- Automatic background installation of updates after explicit user confirmation
- Improved GPU detection and hardware-aware video conversion handling
- Additional UI refinements and onboarding polish for a smoother first-run experience
- Continued conversion performance improvements, including batch ETA tracking and clearer processing feedback

### Changed

- Update checks now surface an install prompt and launch the Windows installer without requiring manual download steps
- GPU-assisted video conversion now uses detected hardware capabilities more consistently for compatible output formats
- The user interface has been refined in several areas to improve readability, flow, and usability during batch conversions

## [1.0.6‑patch1] - 2026-09-10

### Added

- Temporary batch folders in the system temp directory (%LOCALAPPDATA%\Temp\fcp-batches) for each conversion run
- Automatic per-batch backup copies of converted files while processing
- Explicit confirmation step before deleting source files after a successful ZIP export

### Changed

- Source files are no longer deleted immediately after conversion output is written
- `Delete source files after successful conversion` now defers deletion until the user confirms removal after ZIP export completes
- Batch folders are named using the conversion date and batch number, and remain unchanged after the app finishes

## [1.0.6] - 2026-09-07

### Added

- Live estimated remaining time for the complete conversion batch
- `debug.txt` performance report with per-file durations and the average seconds per file

## [1.0.5] - 2026-09-07

### Added

- Optional encrypted vault storage linked to the configured output folder
- AES-256-GCM encryption with Argon2id password-based key derivation
- Encrypted vault containers with per-file authentication tags and random storage names
- Vault browser inside the app for listing, exporting and deleting stored ZIP files
- Encrypted original ZIP filenames stored inside new vault containers
- Release update checking against the current FCP GitHub repository

### Changed

- ZIP export can target either the normal output folder or the encrypted vault
- Individual converted files are not written as plaintext to the output folder while a vault is active
- Vault passwords must contain at least 10 characters and are never stored in local storage
- Existing legacy `.fcpv` containers remain readable as unnamed encrypted ZIP files

## [1.0.3-patch1] - 2026-09-07

### Changed

- Downloads now save directly to the configured output folder without opening a Windows save dialog
- Downloads continue to use the Windows save dialog when no output folder is configured
- Conversions can run without an output folder; source files are only deleted when a configured output folder receives the converted files successfully

## [1.0.3] - 2026-09-06

### Added

- Configurable output folder saved between sessions
- Retry actions for individual failed conversions and all failed conversions
- Native FFmpeg progress percentage and estimated remaining time
- Temporary local staging during conversion, with optional deletion of sources after successful output
- GitHub Release update checking for Windows installers

### Removed

- Resolution controls that added padding instead of true image upscaling

## [1.0.2] - 2026-09-03

### Added

- Self-contained Windows Whisper runtime, including the executable, runtime libraries and base English model
- Audio transcription to both TXT and SRT output

### Fixed

- Audio transcription no longer depends on an MSYS2 installation on the user's computer
- WAV input is normalized to a separate temporary file instead of being overwritten in place by FFmpeg
- Whisper runtime files are included in the Windows installer

### Changed

- Audio transcription now works offline on computers without a development environment

## [1.0.0] - 2026-08-31

### Added

- Whisper.cpp integration for converting audio files to text transcripts in TXT format
- Audio-to-text support alongside the existing media and PDF conversion workflow
- App version bumped to 1.0.0 for the first production release milestone

### Changed

- Audio queue output format selection now includes TXT transcription output
- The app now supports a dedicated transcription path for local, offline speech-to-text workflows

## [0.0.6] - 2026-08-30

### Added

- Adjustable UI transparency for the main conversion panel so the wallpaper remains visible behind the interface
- Cancel option for stalled conversions after a 60-second inactivity timeout
- Automatic fallback from GPU-accelerated FFmpeg video encoding to software encoding when GPU processing appears to stall

### Fixed

- Large video conversions no longer need a full app restart when they get stuck at low progress for a long time
- Reduced the visual obstruction of custom wallpapers by the conversion panel and settings area

### Changed

- Video conversion now retries with software encoding if hardware acceleration hangs or stalls during encoding
- The conversion workflow is more resilient during long-running media jobs and remains user-cancelable

## [0.0.5.1] - 2026-08-30

### Added

- Parallel processing of queued image conversions to speed up batch conversion jobs
- Limited concurrent conversion workers to improve throughput without overloading the app

### Changed

- Conversion workflow now processes multiple image files in parallel instead of strictly sequentially
- Progress tracking remains per file while overall batch processing is faster

## [0.0.5] - 2026-08-30

### Added

- Extract video to MP3, WAV, FLAC, and OGG  
- Set, change, and disable background image via Settings  
- Save wallpaper configuration in `config.json` with verification for moved or deleted files  
- Limit scrolling behavior of the conversion list to the list and app shell

### Fixed

- Resolved HEIC conversion failure caused by a non-existent `libheif-js` encoder
- Ensured HEIC output compatibility with the included FFmpeg build using HEVC, `hvc1`, and the HEIC format

### Changed

- HEIC and AVIF conversion now uses the native FFmpeg engine in Electron
- Unused `libheif-js` dependency and corresponding bundle configuration removed

## [0.0.4] - 2026-08-28

### Added

- GPU detection for integrated and dedicated graphics adapters
- Hardware-accelerated video conversion for compatible NVIDIA and AMD GPUs

### Changed

- Electron hardware acceleration is enabled or disabled based on the detected GPU

## [0.0.3] - 2026-08-28

### Added

- Windows Electron desktop application with NSIS installer
- Local and offline processing of images, video, audio, and PDF files
- Image conversion to JPG, PNG, WEBP, HEIC, AVIF, PDF, ICO, and SVG
- Video conversion to MP4, WEBM, WMV, and MKV
- Audio conversion to MP3, WAV, FLAC, and OGG
- PDF to text conversion
- Combine multiple images into a single PDF
- Bulk addition and processing of files and folders
- Adjustable output resolutions
- ZIP export for converted files
- Optional AES-256 password protection for ZIP files
- Multilingual interface for Dutch, English, German, French, Turkish, Chinese, and Japanese
- First-start onboarding with language selection and user guidance
- Dark and light display modes
- Borderless fullscreen on startup
- `F11` shortcut to toggle fullscreen
- Custom application icon via `assets/icon.ico`
- Secure Electron preload API with `contextIsolation` and disabled `nodeIntegration`
- Native FFmpeg conversion within Electron
- Relative Vite assets for proper functionality from an installed Electron app
- Local FFmpeg-WASM, PDF.js, ZIP, HEIF, and SVG assets for offline use
- Local Tailwind CSS build without reliance on a CDN
- Comprehensive README documentation in multiple languages

### Fixed

- Added missing Electron main process entry  
- Added missing preload integration  
- Resolved white page after installation from the release folder using relative Vite paths  
- Fixed incorrect Vite dependency optimization for PDF.js and FFmpeg workers  
- Bypassed `RuntimeError: memory access out of bounds` during browser-WASM media conversion by using native FFmpeg in Electron  
- Resolved `Media engine not loaded` during audio and video conversion  
- Restored missing `ffmpeg.exe` via the `ffmpeg-static` installation script  
- Removed Electron menu bar  
- Removed incorrect reference to the missing `index.css` file and linked styling locally  
- Resolved fallback to the default Electron icon  
- Added TypeScript declarations for `imagetracerjs` and `libheif-js`  
- Rebuilt installer after an incomplete NSIS installer was created

### Changed

- Electron uses `ffmpeg-static` outside `app.asar` for native execution
- Production build is stored in `dist`
- Windows installer is stored in `release`
- Electron-builder uses `File Converter Pro` as the product name
- The application uses version `0.0.3`

## [0.0.2]

### Added

- First Electron installer with Windows NSIS target
- Basic configuration for Electron-builder
- Local preload and main process structure

## [0.0.1]

### Added

- First Electron installer with Windows NSIS target
- Basic configuration for Electron-builder
- Local preload and main process structure

[Unreleased]: https://github.com/uihorsewolf-design/FCP-File-Converter-Pro-Up-to-Date/compare/v0.0.3...HEAD
[1.0.7]: https://github.com/uihorsewolf-design/FCP-File-Converter-Pro-Up-to-Date/releases/tag/v1.0.7
[1.0.6]: https://github.com/uihorsewolf-design/FCP-File-Converter-Pro-Up-to-Date/releases/tag/v1.0.6
[1.0.5]: https://github.com/uihorsewolf-design/FCP-File-Converter-Pro-Up-to-Date/releases/tag/v1.0.5
[1.0.4]: https://github.com/uihorsewolf-design/FCP-File-Converter-Pro-Up-to-Date/releases/tag/v1.0.4
[0.0.3]: https://github.com/uihorsewolf-design/FCP-File-Converter-Pro-Up-to-Date/releases/tag/v0.0.3
