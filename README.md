# File Converter Pro (FCP)

File Converter Pro is a Windows desktop application for converting image, video, audio and PDF files locally on your device. Conversion and transcription run locally and do not upload your files to an online service. Internet access is only used for the optional GitHub update check.

## Overview

FCP is designed for fast local file conversion with support for batch processing, file and folder conversion, and output packaging in ZIP archives.

It is built with Electron, React, Vite and FFmpeg, allowing it to handle a wide range of media conversion tasks without requiring a cloud backend.

## Features

- Convert images to JPG, PNG, WEBP, HEIC, AVIF, PDF, ICO and SVG
- Convert videos to MP4, WEBM, WMV and MKV
- Convert audio to MP3, WAV, FLAC and OGG
- Transcribe audio locally to TXT or SRT with the bundled Whisper engine
- Extract text from PDF files
- Merge multiple images into a single PDF
- Process files and folders in batches
- Choose a local output folder for converted files
- Optionally turn the output folder into an encrypted vault
- Store ZIP exports in the vault and open, export or delete them from inside the app
- Retry failed conversions individually or as a group
- Show native FFmpeg conversion progress and estimated remaining time
- Stage input files in temporary local storage during conversion
- Optionally delete source files only after successful output
- Save individual downloads and ZIP archives directly to the configured output folder
- Check the current FCP GitHub Releases page for available Windows updates
- Download results as ZIP archives
- Protect ZIP archives with AES-256 encryption
- Protect vault contents with AES-256-GCM and Argon2id-based key derivation
- Multilingual interface and first-run guide
- Light and dark mode
- Borderless fullscreen support with F11
- Dedicated GPU detection and native FFmpeg integration

## Technologies

- Electron
- React
- Vite
- TypeScript
- FFmpeg
- Sharp
- PDF.js
- jsPDF

## Installation (for the devs)

Before running the project, install Node.js on your machine. The app uses npm scripts, so Node.js is required for the commands below.

1. Download and install Node.js from: [https://nodejs.org/](https://nodejs.org/).
2. Open a terminal in the project folder.
3. Install dependencies:

```bash
npm install
```

4. Start the app in development mode:

```bash
npm run dev
```

5. To build the project and generate the Windows installer locally:

```bash
npm run dist
```

The generated installer is written to the `release/` folder. It includes Whisper, its runtime files and the base English model, so end users do not need MSYS2, a separate Whisper installation or internet access for transcription.

### Download the Windows app

End users do not need Node.js or the project source code. Download the latest Windows installer from the [FCP GitHub Releases](https://github.com/uihorsewolf-design/FCP-File-Converter-Pro-Up-to-Date/releases) page and run the `.exe` installer.

### Build from source

Developers can install the dependencies and build a new Windows installer locally with `npm run dist`. The local `whisper-runtime/` folder is required during the build but is not committed to the repository because the Whisper model is larger than GitHub's regular file-upload limit. The runtime is bundled inside the generated installer.

## Usage

- Start the app from the desktop shortcut or installed executable.
- Select the source files or folders.
- Choose the desired output format.
- Optionally choose an output folder in Settings.
- Optionally enable `Set output folder as vault` in Settings. Choose a vault password of at least 10 characters and a quota.
- Start the conversion and monitor the per-file progress and estimated remaining time.
- Download individual results or package successful results in a ZIP archive. When the vault is enabled, choose between the output folder and the vault.
- Open the vault from Settings to list stored ZIP files, export them to a normal location, or delete them.
- Retry individual failed conversions or all failed conversions.

When an output folder is configured, individual downloads and ZIP archives are saved there automatically without opening a Windows save dialog. Without an output folder, Windows asks where each download should be saved.

The optional source-file deletion setting is disabled by default. When enabled, files are first copied to temporary local storage and are deleted from their original location only after the converted output has been written successfully. This action cannot be undone and requires confirmation before each conversion run.

Conversions can also run without an output folder. In that case, source files are not deleted automatically, even if the deletion setting is enabled.

The app checks the [FCP GitHub Releases](https://github.com/uihorsewolf-design/FCP-File-Converter-Pro-Up-to-Date/releases) page for a newer Windows installer when an internet connection is available. Updates are never downloaded or installed without user confirmation.

### Encrypted vault

The vault stores each ZIP as an encrypted `.fcpv` container in a hidden `.fcp-vault` folder under the configured output path. File contents and new ZIP filenames are encrypted with AES-256-GCM. The vault key is derived from the password with Argon2id. Windows Explorer can see the container files but cannot read or decrypt them.

To use it, choose an output folder in Settings, enable `Set output folder as vault`, set a password of at least 10 characters and choose the maximum quota. Use `Open vault` in Settings to unlock the vault. From there, stored ZIP files can be exported or deleted. Removing the output folder disables the vault configuration; it does not delete existing vault data.

The password is never saved by the app. Losing the password means the encrypted files cannot be recovered. The quota limits vault contents but does not pre-allocate free disk space in Windows Explorer.

For audio transcription, add an audio file, choose `TXT` or `SRT`, and select `Convert All`. WAV input is automatically normalized before Whisper processes it.

## Project structure

```text
.
├── App.tsx
├── index.tsx
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── metadata.json
├── i18n.ts
├── types.ts
├── preload.js
├── electron-main.cjs
├── services/
│   └── fileConverter.ts
├── README Files & Short Guides/
│   ├── README (Deutsch).md
│   ├── README (English).md
│   ├── README (Francais).md
│   ├── README (Nederlands).md
│   ├── README (Turkce).md
│   ├── README (中文).md
│   ├── README (日本語).md
│   ├── Short Guide (Deutsch).md
│   ├── Short Guide (English).md
│   ├── Short Guide (Francais).md
│   ├── Short Guide (Nederlands).md
│   ├── Short Guide (Turkce).md
│   ├── Short Guide (中文).md
│   └── Short Guide (日本語).md
└── assets/
    └── icon.ico


## Documentation

Additional localized documentation is available in the folder:

- [README Files & Short Guides](README%20Files%20%26%20Short%20Guides)

## Author

B&B Coder

## License

This project is distributed under its project-specific licensing terms. Please review the package and release documentation before distributing or reusing the software.
