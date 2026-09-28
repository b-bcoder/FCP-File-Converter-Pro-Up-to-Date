FILE CONVERTER PRO (FCP)
Comprehensive overview of features, capabilities, and supporting engines
Version: 1.1.0

======================================================================
1. OVERVIEW
======================================================================

File Converter Pro (FCP) is a local Windows desktop application for converting,
processing, transcribing, bundling, and securing files.

Key features:

- Runs locally on the computer.
- Files are not uploaded to an online conversion service.
- Conversions can be run individually or in batches.
- Individual files and entire folders can be added.
- Conversions can be run without setting an output folder.
- Results can be downloaded individually or bundled into a ZIP archive.
- The app supports multiple engines for different file types.
- The application is built for Windows as an Electron desktop app.
- The current release is version 1.1.0.

Internet access is only used for the optional check for new FCP updates via the
GitHub Releases page. Updates are not downloaded or installed without
confirmation.

FCP's Windows file locations:

- Update files and downloaded update data:
  %LOCALAPPDATA%\bestandsconverter-updater
- Installed program files:
  %LOCALAPPDATA%\Programs\bestandsconverter
- Application settings and user data:
  %APPDATA%\bestandsconverter

For a Windows account named username, these paths would be:

  C:\Users\username\AppData\Local\bestandsconverter-updater
  C:\Users\username\AppData\Local\Programs\bestandsconverter
  C:\Users\username\AppData\Roaming\bestandsconverter

These locations are separate from the output folder configured in FCP and from
the temporary conversion folders under %LOCALAPPDATA%\Temp.

======================================================================
2. SUPPORTED CONVERSION CATEGORIES
======================================================================

FCP supports the following main categories:

- Images
- Video
- Audio
- PDF documents
- Audio transcription
- 3D models
- ZIP export and secure storage

======================================================================
3. IMAGE CONVERSION
======================================================================

Supported image input formats:

- JPG / JPEG
- PNG
- WEBP
- HEIC
- HEIF
- AVIF
- ICO
- BMP
- TIFF
- SVG

Supported output formats:

- JPG
- PNG
- WEBP
- HEIC
- AVIF
- PDF
- ICO
- SVG

Capabilities:

- Convert images to common raster formats.
- Convert images to PDF.
- Vectorize images to SVG.
- Convert images to ICO icons.
- Process multiple images at once.
- Combine multiple images into a single PDF document.
- Automatically choose landscape or portrait PDF orientation.
- Preserve images using local object URL processing to limit unnecessary
  memory usage.

Note:

- HEIC, HEIF, and AVIF use the native media/FFmpeg route when needed, because
  the browser canvas cannot always read or write these formats directly.

======================================================================
4. VIDEO CONVERSION
======================================================================

Supported video input formats:

- MP4
- WEBM
- WMV
- MKV
- AVI
- MOV
- FLV
- GIF as an animated image/media format

Supported video output formats:

- MP4
- WEBM
- WMV
- MKV

Additional capabilities:

- Convert video to audio.
- Process videos in batches.
- Receive native progress updates.
- Show estimated time remaining.
- Cancel a conversion if a process hangs or takes too long.
- Detect hardware and GPU information for improved native processing.

======================================================================
5. AUDIO CONVERSION
======================================================================

Supported audio input formats:

- MP3
- WAV
- FLAC
- OGG
- M4A
- AAC

Supported audio output formats:

- MP3
- WAV
- FLAC
- OGG

Additional capabilities:

- Convert audio to other audio formats.
- Transcribe audio locally to text.
- Save transcripts as TXT.
- Save transcripts as SRT subtitles.
- Process audio in batches.
- Show progress and time remaining.
- WAV input is automatically normalized for Whisper when needed for the
  transcription process.

======================================================================
6. AUDIO TRANSCRIPTION
======================================================================

Supported transcription output formats:

- TXT
- SRT

Transcription runs locally using the included Whisper.cpp runtime and base
model. No online transcription service is required.

Capabilities:

- Select audio.
- Choose TXT or SRT as the output format.
- Track transcription progress.
- Save transcripts directly or include them in a ZIP export.
- Process transcripts in a batch.

======================================================================
7. PDF FEATURES
======================================================================

Supported PDF features:

- Read PDF files.
- Extract text from PDF files.
- Export PDF text as TXT.
- Convert images to PDF.
- Combine multiple images into a PDF.
- Include PDF results in downloads and ZIP exports.

======================================================================
8. 3D MODEL CONVERSION
======================================================================

Starting with version 1.1.0, FCP includes a separate mode: 3D Model Conversion.

Supported 3D formats:

- STL
- OBJ
- FBX
- GLTF
- GLB
- SKP (SketchUp)

Supported 3D output formats:

- STL
- OBJ
- GLTF
- GLB

Common automatic conversion routes:

- STL -> OBJ
- OBJ -> GLB
- FBX -> GLTF
- GLTF -> GLB
- GLB -> GLTF
- SKP -> GLB

SKP-specific routes:

- SKP -> GLB
- SKP -> OBJ
- SKP -> STL

3D engine capabilities:

- Parse meshes.
- Process vertices and faces.
- Convert between 3D model representations.
- Recalculate normals.
- Calculate tangents when UV data is available.
- Include materials where supported by the source format.
- Preserve UV data and related information where possible.
- Triangulate using the loaders/exporters in use.
- Process model structure and scene information.
- Apply uniform unit scaling.
- Show conversion progress.
- Download 3D results through the same queue as other files.

Available scaling settings:

- 1x - preserve scale.
- 0.001x - millimeters to meters.
- 0.01x - centimeters to meters.
- 1000x - meters to millimeters.

SKP limitation:

- SKP is supported as an input format.
- SKP can currently be converted to GLB, OBJ, and STL.
- Converting OBJ, GLB, or other formats back to SKP is not available because
  the open-source parser in use does not provide a public SKP writer.

======================================================================
9. CONVERSION QUEUE AND BATCH PROCESSING
======================================================================

The central conversion queue supports:

- Add multiple files at once.
- Drag and drop files and folders.
- Traverse folders recursively.
- Preserve relative folder structures during ZIP export.
- Choose an output format for each file.
- Process conversions in parallel using multiple workers.
- Show the status of each file:
  - Pending
  - Reading
  - Converting
  - Succeeded
  - Failed
- Show read progress.
- Show conversion progress.
- Show estimated time remaining.
- Retry individual files.
- Retry all failed files.
- Remove files from the queue.
- Clear the entire queue.
- Cancel an active conversion when available.

Bulk actions:

- Apply an image format to all images.
- Apply a video format to all videos.
- Apply an audio format to all audio files.
- Combine images into a PDF using a bulk option.

======================================================================
10. DOWNLOADS AND ZIP EXPORT
======================================================================

Capabilities:

- Download individual conversion results.
- Download all successful results as a ZIP archive.
- Set a custom ZIP file name.
- Choose an output folder for automatic saving.
- Password-protect ZIP files.
- Track ZIP progress.
- Preserve file names and relative folders during ZIP export.
- Automatically make duplicate paths unique by appending a number.

If no output folder is set, Windows opens a location picker for saving
individual files or ZIP archives.

======================================================================
11. SECURE VAULT
======================================================================

An output folder can be configured as an encrypted vault.

Capabilities:

- Configure an output folder as a vault.
- Set a vault password.
- Enforce a minimum password length of 10 characters.
- Set a maximum storage quota from 0.1 to 1024 GB.
- Store ZIP results encrypted in the vault.
- Unlock the vault from FCP.
- View vault files.
- Export vault files.
- Delete vault files.
- Disable the vault from Settings.
- Check the quota before saving new content.

Security model:

- File contents are encrypted with AES-256-GCM.
- The key is derived using Argon2id.
- Vault files are stored as .fcpv containers.
- Files are stored in a hidden .fcp-vault folder in the output folder.
- Windows Explorer can see the containers but cannot read or decrypt them.
- The app does not store the password.
- A forgotten password cannot be recovered.

ZIP password protection uses AES-256 encryption via zip.js.

======================================================================
12. DELETE SOURCE FILES
======================================================================

FCP can optionally delete source files after a successful conversion.

Safety measures:

- The option is off by default.
- Source files are first copied to local temporary storage.
- Deletion only takes place after the output has been written successfully.
- The user must explicitly confirm deletion.
- Source files are not deleted automatically when no output folder is set.
- This action cannot be undone.

======================================================================
13. SETTINGS AND USER INTERFACE
======================================================================

Available interface features:

- Light theme.
- Dark theme.
- Language selection.
- First-run onboarding.
- Multilingual interface.
- Adjustable UI transparency.
- Set a custom background image.
- Change the background image.
- Disable the background.
- Choose an output folder.
- Clear the output folder.
- Open the vault from Settings.
- Show GPU detection.
- Show engine status at the bottom of the app.
- Use full-screen mode.
- Use F11 to toggle full-screen mode.
- Check for updates automatically.
- Install available updates later or immediately.

Available interface languages:

- Nederlands
- English
- Deutsch
- French
- Turkish
- 中文
- 日本語

======================================================================
14. SUPPORTING ENGINES AND LIBRARIES
======================================================================

14.1 FFmpeg / Native Media Engine

Responsible for:

- Video conversion.
- Audio conversion.
- Native HEIC/HEIF/AVIF conversion when needed.
- Native progress reporting.
- Estimated time remaining for media conversions.
- Native Windows conversion via ffmpeg-static and the Electron main process.

Key packages:

- @ffmpeg/ffmpeg
- @ffmpeg/core
- @ffmpeg/util
- ffmpeg
- ffmpeg-static
- fluent-ffmpeg

14.2 Three.js 3D Model Engine

Responsible for:

- OBJ import.
- FBX import.
- GLTF import.
- GLB import.
- STL import.
- OBJ export.
- STL export.
- GLTF/GLB export.
- Scene and mesh processing.
- Normal, tangent, UV data, and scale processing.

Three.js components in use:

- OBJLoader
- FBXLoader
- GLTFLoader
- STLLoader
- OBJExporter
- STLExporter
- GLTFExporter

Key package:

- three

14.3 OpenSKP Engine

Responsible for:

- Parse SketchUp SKP files.
- Read scene information from SKP files.
- Process materials and geometry from SKP where available.
- Export SKP to GLB.
- Export SKP to OBJ.
- Export SKP to binary STL.

Key package:

- openskp

14.4 Browser Image / Canvas Engine

Responsible for:

- JPG-conversie.
- PNG-conversie.
- WEBP-conversie.
- Basic image processing.
- Drawing images on canvas.
- Local image preview.

14.5 Sharp

Sharp is included as a local image-processing dependency for native, high-
performance image processing and future extensions to the image engine.

14.6 ImageTracer

Responsible for:

- Convert raster images to SVG vector images.

Key package:

- imagetracerjs

14.7 PDF.js Engine

Responsible for:

- Open PDF files.
- Process PDF pages.
- Extract text and text items from PDF pages.

Key package:

- pdfjs-dist

14.8 jsPDF Engine

Responsible for:

- Create PDF files from images.
- Combine multiple images into a PDF.
- Assemble PDF pages and orientation.

Key package:

- jspdf

14.9 Whisper.cpp Transcription Engine

Responsible for:

- Local audio transcription.
- TXT output.
- SRT output.
- Transcription progress.
- Local processing without a cloud service.

Key components:

- whisper-node
- whisper-runtime
- whisper-cli.exe op Windows
- ggml-base.en.bin

14.10 zip.js Archive Engine

Responsible for:

- Create ZIP archives.
- Bundle multiple conversion results.
- Report ZIP progress.
- AES-256 ZIP encryption.
- Preserve file structures within ZIP archives.

Key package:

- @zip.js/zip.js

14.11 Electron Security and Native Bridge

Electron provides:

- The Windows desktop container.
- Native file dialogs.
- Saving to local output folders.
- Temporary file storage.
- Native FFmpeg calls.
- Vault storage.
- AES-256-GCM encryption.
- Argon2id key derivation.
- GPU detection.
- Update checks and installation.
- The preload bridge between the renderer and native main process.

======================================================================
15. LOCAL TEMPORARY FILES
======================================================================

During conversions, FCP uses local temporary storage for reliability:

- Temporary batch folders:
  %LOCALAPPDATA%\\Temp\\fcp-batches\\<batch-naam>
- Temporary staging folder:
  %LOCALAPPDATA%\\Temp\\fcp-staging

Staged source files are automatically cleaned up after processing is complete.

======================================================================
16. ERROR HANDLING AND RECOVERY
======================================================================

FCP supports:

- Per-file error statuses.
- Report read errors.
- Detect damaged or unsupported source files.
- Summarize FFmpeg errors in understandable messages.
- Retry failed conversions.
- Retry all failed items.
- Detect stalled media conversions.
- Cancel an active conversion.
- Track conversion statistics and performance reports.
- Write a debug.txt report to the output folder when available.

======================================================================
17. UPDATE AND DISTRIBUTION OPTIONS
======================================================================

For developers:

- npm install - install dependencies.
- npm run dev - start Vite and Electron in development mode.
- npm run lint - check TypeScript.
- npm run build - create a production web build.
- npm run dist - create the web build and Windows installer.
- npm run preview - preview the production build locally.

For distribution:

- Windows NSIS installer.
- Electron Builder configuration.
- Whisper runtime is included.
- Whisper base model is included.
- FFmpeg runtime is included.
- End users do not need Node.js.
- End users do not need a separate Whisper or FFmpeg installation.

======================================================================
18. KNOWN LIMITATIONS
======================================================================

- SKP is supported only as an input format; SKP output is not available.
- Actual support for less common media codecs depends on FFmpeg and the source
  files in use.
- Very large video, audio, and 3D files can use substantial RAM, CPU, and
  temporary disk space.
- The browser canvas cannot process every HEIC, HEIF, or AVIF file directly;
  the native media engine is used for those files.
- Materials and textures available during conversion depend on what the source
  format and loader provide.
- ZIP and vault files are intended for use within the FCP workflow.
- A forgotten vault password cannot be recovered.
- Automatic source deletion cannot be undone after confirmation.
- The production build may contain large JavaScript bundles due to the
  combination of media, PDF, and 3D engines.

======================================================================
19. PRIVACY AND SECURITY SUMMARY
======================================================================

- Conversions run locally.
- Transcriptions run locally.
- The app does not use a cloud backend for the normal conversion workflow.
- Internet access is only needed for the optional update check.
- Vault contents are encrypted locally.
- The vault password is not stored.
- Source files are deleted only when the user enables and confirms this option.