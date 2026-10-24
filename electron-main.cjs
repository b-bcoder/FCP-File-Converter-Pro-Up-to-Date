const { app, BrowserWindow, ipcMain, dialog, Menu, protocol } = require('electron');
const fs = require('node:fs/promises');
const { createReadStream, createWriteStream, constants: fsConstants } = require('node:fs');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const crypto = require('node:crypto');
const { randomUUID } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const ffmpegPath = require('ffmpeg-static');
const lzma = require('lzma-native');
const { hashRaw } = require('@node-rs/argon2');

protocol.registerSchemesAsPrivileged([{
  scheme: 'fcp-wallpaper',
  privileges: { standard: true, secure: true, stream: true }
}]);

const sevenZipPath = app.isPackaged
  ? require('7zip-bin').path7za.replace('app.asar', 'app.asar.unpacked')
  : require('7zip-bin').path7za;

const isDevelopment = !app.isPackaged;
const developmentUrl = 'http://localhost:3000';
const updateRepository = 'b-bcoder/FCP-File-Converter-Pro-Up-to-Date';
const iconPath = path.join(__dirname, 'assets', 'icon.zip');
const whisperRuntimePath = app.isPackaged
  ? path.join(process.resourcesPath, 'whisper-runtime')
  : path.join(__dirname, 'whisper-runtime');
const whisperRootPath = path.join(__dirname, 'node_modules', 'whisper-node', 'lib', 'whisper.cpp').replace('app.asar', 'app.asar.unpacked');
const whisperExecutablePath = process.platform === 'win32'
  ? path.join(whisperRuntimePath, 'whisper-cli.exe')
  : path.join(whisperRootPath, 'main');
const whisperModelPath = process.platform === 'win32'
  ? path.join(whisperRuntimePath, 'ggml-base.bin')
  : path.join(whisperRootPath, 'models', 'ggml-base.bin');
const gpuInfo = detectGpu();
const nativeFfmpegPath = app.isPackaged
  ? ffmpegPath.replace('app.asar', 'app.asar.unpacked')
  : ffmpegPath;

function summarizeFfmpegError(output) {
  const text = String(output || '').replace(/\r/g, '').trim();

  if (!text) {
    return 'Conversion failed. The file could not be converted.';
  }

  const lower = text.toLowerCase();

  if (/no sequence header|bitstream not supported by this decoder|corrupt frame detected|failed to decode frame|error while decoding/i.test(lower)) {
    return 'Conversion failed: the source file appears to be corrupted or uses an unsupported codec/encoding.';
  }

  if (/invalid data found when processing input|moov atom|is not a supported file|could not find codec parameters|unable to decode/i.test(lower)) {
    return 'Conversion failed: the source file is damaged or in an unsupported format.';
  }

  if (/stalled for over 60 seconds|timed out|sigkill/i.test(lower)) {
    return 'Conversion failed: the conversion stalled and could not finish.';
  }

  if (/no such file or directory|could not open|not found/i.test(lower)) {
    return 'Conversion failed: the source file could not be found or opened.';
  }

  if (/unsupported codec|unknown codec|codec not currently supported/i.test(lower)) {
    return 'Conversion failed: the selected output format is not supported for this source file.';
  }

  const usefulLines = text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^ffmpeg version/i.test(line))
    .filter(line => !/^libav/i.test(line))
    .filter(line => !/^configuration:/i.test(line))
    .filter(line => !/^built with/i.test(line))
    .filter(line => !/^input #/i.test(line))
    .filter(line => !/^output #/i.test(line))
    .filter(line => !/^stream mapping:/i.test(line))
    .filter(line => !/^\[.*\]$/.test(line));

  const meaningfulLine = usefulLines.find(line => !/copyright|all rights reserved|freely distributed/i.test(line));

  if (meaningfulLine) {
    const cleanMessage = meaningfulLine.replace(/^error:/i, '').trim();
    return cleanMessage.length > 120 ? 'Conversion failed. The file could not be converted with the current settings.' : `Conversion failed: ${cleanMessage}.`;
  }

  return 'Conversion failed. The file could not be converted with the current settings.';
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.fcp.fileconverter');
}

if (!gpuInfo.hasDedicatedGpu) {
  app.disableHardwareAcceleration();
}

Menu.setApplicationMenu(null);

function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 560,
    height: 300,
    frame: false,
    resizable: false,
    movable: false,
    center: true,
    show: false,
    alwaysOnTop: true,
    backgroundColor: '#0b1220',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const version = app.getVersion();
  const splashHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <style>
      * { box-sizing: border-box; }
      html, body { height: 100%; margin: 0; }
      body {
        display: grid;
        place-items: center;
        overflow: hidden;
        background: #0b1220;
        color: #f8fafc;
        font-family: "Segoe UI", sans-serif;
        animation: splash-in 3500ms ease-out both;
      }
      main { text-align: center; }
      .mark {
        width: 64px;
        height: 64px;
        margin: 0 auto 22px;
        border: 2px solid #22d3ee;
        border-radius: 16px;
        display: grid;
        place-items: center;
        color: #22d3ee;
        font-size: 21px;
        font-weight: 700;
        letter-spacing: 1px;
        box-shadow: 0 0 30px rgba(34, 211, 238, 0.2);
      }
      h1 { margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 0.2px; }
      p { margin: 12px 0 0; color: #94a3b8; font-size: 14px; }
      .fade-out { animation: splash-out 3500ms ease-in forwards; }
      @keyframes splash-in { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
      @keyframes splash-out { from { opacity: 1; } to { opacity: 0; } }
    </style>
  </head>
  <body>
    <main>
      <div class="mark">FCP</div>
      <h1>FCP - File Converter Pro</h1>
      <p>Author: B&amp;B Coder | v${version}</p>
    </main>
  </body>
</html>`;

  splash.show();
  splash.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(splashHtml)}`).catch(() => undefined);
  return splash;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    icon: iconPath,
    autoHideMenuBar: true,
    fullscreen: true,
    show: false,
    opacity: 0,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      window.setFullScreen(!window.isFullScreen());
    }
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    void finishOperationLogBatch('failed', {
        event: 'rendererCrash',
        functionName: 'webContents.render-process-gone',
        reason: details.reason,
        exitCode: details.exitCode,
      });
  });

  if (isDevelopment) {
    loadDevelopmentPage(window);
  } else {
    window.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  let hasRevealed = false;
  const revealWindow = () => {
    if (hasRevealed) return;
    hasRevealed = true;
    const splash = window.splashWindow;
    const showMainWindow = () => {
      if (window.isDestroyed()) return;
      window.setOpacity(0);
      window.show();
      window.focus();

      const fadeStart = Date.now();
      const fadeDuration = 1500;
      const fadeIn = () => {
        if (window.isDestroyed()) return;
        const progress = Math.min(1, (Date.now() - fadeStart) / fadeDuration);
        window.setOpacity(progress);
        if (progress < 1) setTimeout(fadeIn, 16);
      };
      fadeIn();
    };

    if (!splash || splash.isDestroyed()) {
      showMainWindow();
      return;
    }

    splash.webContents.executeJavaScript("document.body.classList.add('fade-out')").catch(() => undefined);
    setTimeout(() => {
      if (!splash.isDestroyed()) splash.close();
      showMainWindow();
    }, 2500);
  };

  window.webContents.once('did-finish-load', revealWindow);
  window.once('ready-to-show', revealWindow);
  setTimeout(revealWindow, 15000);

  return window;
}

const wallpaperConfigPath = path.join(app.getPath('userData'), 'config.json');
const vaultConfigPath = path.join(app.getPath('userData'), 'vault-config.json');
const crashLogLanguagePath = path.join(app.getPath('userData'), 'crash-log-language.json');
const activeConversionProcesses = new Set();
const cancelledConversionProcesses = new WeakSet();
let conversionCancellationGeneration = 0;
let crashLogLanguage = 'en';
let crashLogWriteQueue = Promise.resolve();
let activeOperationLogBatch = null;

const crashLogTranslations = {
  en: {
    header: 'File Converter Pro diagnostic log',
    successHeader: 'File Converter Pro success log',
    date: 'Date', duration: 'Duration', fileSize: 'File size', fromFormat: 'FromFormat', toFormat: 'ToFormat',
    mediaConversion: 'Media conversion',
    time: 'Time', event: 'Event', function: 'Function', file: 'File', files: 'Files',
    count: 'File count', succeededCount: 'Succeeded', failedCount: 'Failed', format: 'Format', destination: 'Destination',
    status: 'Status', error: 'Error', stack: 'Stack trace', exitCode: 'Process exit code',
    stderr: 'Process stderr', details: 'Details', reason: 'Reason',
    unexpectedException: 'Unexpected main-process exception', unhandledRejection: 'Unhandled promise rejection',
    rendererCrash: 'Renderer process crashed', rendererException: 'Unexpected renderer error',
    rendererRejection: 'Unhandled renderer promise rejection', childProcessCrash: 'Child process crashed',
    operationStarted: 'Operation started', operationCompleted: 'Operation completed',
    operationFailed: 'Operation failed', conversionStarted: 'Conversion batch started',
    conversionCompleted: 'Conversion batch completed', zipStarted: 'ZIP creation started',
    zipCompleted: 'ZIP creation completed', vaultExportStarted: 'Vault export started',
    vaultExportCompleted: 'Vault export completed', vaultSaveStarted: 'Vault save started',
    vaultSaveCompleted: 'Vault save completed', mediaStarted: 'Media conversion started',
    mediaCompleted: 'Media conversion completed', archiveStarted: 'Archive extraction started',
    archiveCompleted: 'Archive extraction completed', folderCompressionStarted: 'Folder compression started',
    folderCompressionCompleted: 'Folder compression completed',
    success: 'Success', failed: 'Failed', cancelled: 'Cancelled', unknown: 'Unknown',
  },
  nl: {
    header: 'Diagnoselogboek van File Converter Pro',
    successHeader: 'Succeslogboek van File Converter Pro',
    date: 'Datum', duration: 'Duur', fileSize: 'Bestandsgrootte', fromFormat: 'Van formaat', toFormat: 'Naar formaat',
    mediaConversion: 'Mediaconversie',
    time: 'Tijdstip', event: 'Gebeurtenis', function: 'Functie', file: 'Bestand', files: 'Bestanden',
    count: 'Aantal bestanden', succeededCount: 'Geslaagd', failedCount: 'Mislukt', format: 'Formaat', destination: 'Bestemming',
    status: 'Status', error: 'Foutmelding', stack: 'Stacktrace', exitCode: 'Procesafsluitcode',
    stderr: 'Proces-stderr', details: 'Details', reason: 'Reden',
    unexpectedException: 'Onverwachte fout in hoofdproces', unhandledRejection: 'Niet-afgevangen promise-afwijzing',
    rendererCrash: 'Rendererproces is gecrasht', rendererException: 'Onverwachte fout in renderer',
    rendererRejection: 'Niet-afgevangen promise-afwijzing in renderer', childProcessCrash: 'Onderliggend proces is gecrasht',
    operationStarted: 'Bewerking gestart', operationCompleted: 'Bewerking voltooid',
    operationFailed: 'Bewerking mislukt', conversionStarted: 'Conversiebatch gestart',
    conversionCompleted: 'Conversiebatch voltooid', zipStarted: 'ZIP-aanmaak gestart',
    zipCompleted: 'ZIP-aanmaak voltooid', vaultExportStarted: 'Kluisexport gestart',
    vaultExportCompleted: 'Kluisexport voltooid', vaultSaveStarted: 'Opslaan in kluis gestart',
    vaultSaveCompleted: 'Opslaan in kluis voltooid', mediaStarted: 'Mediaconversie gestart',
    mediaCompleted: 'Mediaconversie voltooid', archiveStarted: 'Archief uitpakken gestart',
    archiveCompleted: 'Archief uitpakken voltooid', folderCompressionStarted: 'Mapcompressie gestart',
    folderCompressionCompleted: 'Mapcompressie voltooid',
    success: 'Geslaagd', failed: 'Mislukt', cancelled: 'Geannuleerd', unknown: 'Onbekend',
  },
  de: {
    header: 'Diagnoseprotokoll von File Converter Pro',
    successHeader: 'Erfolgsprotokoll von File Converter Pro',
    date: 'Datum', duration: 'Dauer', fileSize: 'Dateigröße', fromFormat: 'Ausgangsformat', toFormat: 'Zielformat',
    mediaConversion: 'Medienkonvertierung',
    time: 'Zeitpunkt', event: 'Ereignis', function: 'Funktion', file: 'Datei', files: 'Dateien',
    count: 'Dateianzahl', succeededCount: 'Erfolgreich', failedCount: 'Fehlgeschlagen', format: 'Format', destination: 'Ziel',
    status: 'Status', error: 'Fehlermeldung', stack: 'Stacktrace', exitCode: 'Prozess-Exitcode',
    stderr: 'Prozess-stderr', details: 'Details', reason: 'Ursache',
    unexpectedException: 'Unerwarteter Fehler im Hauptprozess', unhandledRejection: 'Nicht behandelte Promise-Ablehnung',
    rendererCrash: 'Renderer-Prozess abgestürzt', rendererException: 'Unerwarteter Renderer-Fehler',
    rendererRejection: 'Nicht behandelte Promise-Ablehnung im Renderer', childProcessCrash: 'Unterprozess abgestürzt',
    operationStarted: 'Vorgang gestartet', operationCompleted: 'Vorgang abgeschlossen',
    operationFailed: 'Vorgang fehlgeschlagen', conversionStarted: 'Konvertierungsbatch gestartet',
    conversionCompleted: 'Konvertierungsbatch abgeschlossen', zipStarted: 'ZIP-Erstellung gestartet',
    zipCompleted: 'ZIP-Erstellung abgeschlossen', vaultExportStarted: 'Tresorexport gestartet',
    vaultExportCompleted: 'Tresorexport abgeschlossen', vaultSaveStarted: 'Speichern im Tresor gestartet',
    vaultSaveCompleted: 'Speichern im Tresor abgeschlossen', mediaStarted: 'Medienkonvertierung gestartet',
    mediaCompleted: 'Medienkonvertierung abgeschlossen', archiveStarted: 'Archivextraktion gestartet',
    archiveCompleted: 'Archivextraktion abgeschlossen', folderCompressionStarted: 'Ordnerkomprimierung gestartet',
    folderCompressionCompleted: 'Ordnerkomprimierung abgeschlossen',
    success: 'Erfolgreich', failed: 'Fehlgeschlagen', cancelled: 'Abgebrochen', unknown: 'Unbekannt',
  },
  fr: {
    header: 'Journal de diagnostic de File Converter Pro',
    successHeader: 'Journal de réussite de File Converter Pro',
    date: 'Date', duration: 'Durée', fileSize: 'Taille du fichier', fromFormat: 'Format source', toFormat: 'Format cible',
    mediaConversion: 'Conversion multimédia',
    time: 'Heure', event: 'Événement', function: 'Fonction', file: 'Fichier', files: 'Fichiers',
    count: 'Nombre de fichiers', succeededCount: 'Réussis', failedCount: 'Échoués', format: 'Format', destination: 'Destination',
    status: 'État', error: 'Erreur', stack: 'Trace de pile', exitCode: 'Code de sortie du processus',
    stderr: 'stderr du processus', details: 'Détails', reason: 'Motif',
    unexpectedException: 'Exception inattendue du processus principal', unhandledRejection: 'Promesse rejetée non gérée',
    rendererCrash: 'Le processus de rendu a planté', rendererException: 'Erreur inattendue du moteur de rendu',
    rendererRejection: 'Promesse rejetée non gérée dans le moteur de rendu', childProcessCrash: 'Un processus enfant a planté',
    operationStarted: 'Opération démarrée', operationCompleted: 'Opération terminée',
    operationFailed: 'Échec de l’opération', conversionStarted: 'Lot de conversions démarré',
    conversionCompleted: 'Lot de conversions terminé', zipStarted: 'Création du ZIP démarrée',
    zipCompleted: 'Création du ZIP terminée', vaultExportStarted: 'Exportation du coffre démarrée',
    vaultExportCompleted: 'Exportation du coffre terminée', vaultSaveStarted: 'Enregistrement dans le coffre démarré',
    vaultSaveCompleted: 'Enregistrement dans le coffre terminé', mediaStarted: 'Conversion multimédia démarrée',
    mediaCompleted: 'Conversion multimédia terminée', archiveStarted: 'Extraction de l’archive démarrée',
    archiveCompleted: 'Extraction de l’archive terminée', folderCompressionStarted: 'Compression du dossier démarrée',
    folderCompressionCompleted: 'Compression du dossier terminée',
    success: 'Réussi', failed: 'Échec', cancelled: 'Annulé', unknown: 'Inconnu',
  },
  tr: {
    header: 'File Converter Pro tanılama günlüğü',
    successHeader: 'File Converter Pro başarı günlüğü',
    date: 'Tarih', duration: 'Süre', fileSize: 'Dosya boyutu', fromFormat: 'Kaynak biçim', toFormat: 'Hedef biçim',
    mediaConversion: 'Medya dönüştürme',
    time: 'Zaman', event: 'Olay', function: 'İşlev', file: 'Dosya', files: 'Dosyalar',
    count: 'Dosya sayısı', succeededCount: 'Başarılı', failedCount: 'Başarısız', format: 'Biçim', destination: 'Hedef',
    status: 'Durum', error: 'Hata', stack: 'Yığın izi', exitCode: 'Süreç çıkış kodu',
    stderr: 'Süreç stderr', details: 'Ayrıntılar', reason: 'Neden',
    unexpectedException: 'Ana süreçte beklenmeyen özel durum', unhandledRejection: 'İşlenmeyen promise reddi',
    rendererCrash: 'Görüntüleyici süreci çöktü', rendererException: 'Görüntüleyicide beklenmeyen hata',
    rendererRejection: 'Görüntüleyicide işlenmeyen promise reddi', childProcessCrash: 'Alt süreç çöktü',
    operationStarted: 'İşlem başladı', operationCompleted: 'İşlem tamamlandı',
    operationFailed: 'İşlem başarısız oldu', conversionStarted: 'Dönüştürme grubu başladı',
    conversionCompleted: 'Dönüştürme grubu tamamlandı', zipStarted: 'ZIP oluşturma başladı',
    zipCompleted: 'ZIP oluşturma tamamlandı', vaultExportStarted: 'Kasa dışa aktarımı başladı',
    vaultExportCompleted: 'Kasa dışa aktarımı tamamlandı', vaultSaveStarted: 'Kasaya kaydetme başladı',
    vaultSaveCompleted: 'Kasaya kaydetme tamamlandı', mediaStarted: 'Medya dönüştürme başladı',
    mediaCompleted: 'Medya dönüştürme tamamlandı', archiveStarted: 'Arşiv çıkarma başladı',
    archiveCompleted: 'Arşiv çıkarma tamamlandı', folderCompressionStarted: 'Klasör sıkıştırma başladı',
    folderCompressionCompleted: 'Klasör sıkıştırma tamamlandı',
    success: 'Başarılı', failed: 'Başarısız', cancelled: 'İptal edildi', unknown: 'Bilinmiyor',
  },
  ja: {
    header: 'File Converter Pro 診断ログ',
    successHeader: 'File Converter Pro 成功ログ',
    date: '日付', duration: '所要時間', fileSize: 'ファイルサイズ', fromFormat: '変換元形式', toFormat: '変換先形式',
    mediaConversion: 'メディア変換',
    time: '時刻', event: 'イベント', function: '機能', file: 'ファイル', files: 'ファイル数',
    count: '対象ファイル数', succeededCount: '成功', failedCount: '失敗', format: '形式', destination: '保存先',
    status: '状態', error: 'エラー', stack: 'スタックトレース', exitCode: 'プロセス終了コード',
    stderr: 'プロセス stderr', details: '詳細', reason: '理由',
    unexpectedException: 'メインプロセスで予期しない例外', unhandledRejection: '未処理の Promise 拒否',
    rendererCrash: 'レンダラープロセスがクラッシュしました', rendererException: 'レンダラーで予期しないエラー',
    rendererRejection: 'レンダラーで未処理の Promise 拒否', childProcessCrash: '子プロセスがクラッシュしました',
    operationStarted: '処理を開始しました', operationCompleted: '処理が完了しました',
    operationFailed: '処理に失敗しました', conversionStarted: '変換バッチを開始しました',
    conversionCompleted: '変換バッチが完了しました', zipStarted: 'ZIP の作成を開始しました',
    zipCompleted: 'ZIP の作成が完了しました', vaultExportStarted: '保管庫のエクスポートを開始しました',
    vaultExportCompleted: '保管庫のエクスポートが完了しました', vaultSaveStarted: '保管庫への保存を開始しました',
    vaultSaveCompleted: '保管庫への保存が完了しました', mediaStarted: 'メディア変換を開始しました',
    mediaCompleted: 'メディア変換が完了しました', archiveStarted: 'アーカイブの展開を開始しました',
    archiveCompleted: 'アーカイブの展開が完了しました', folderCompressionStarted: 'フォルダー圧縮を開始しました',
    folderCompressionCompleted: 'フォルダー圧縮が完了しました',
    success: '成功', failed: '失敗', cancelled: 'キャンセル', unknown: '不明',
  },
  zh: {
    header: 'File Converter Pro 诊断日志',
    successHeader: 'File Converter Pro 成功日志',
    date: '日期', duration: '耗时', fileSize: '文件大小', fromFormat: '源格式', toFormat: '目标格式',
    mediaConversion: '媒体转换',
    time: '时间', event: '事件', function: '功能', file: '文件', files: '文件数',
    count: '文件数量', succeededCount: '成功', failedCount: '失败', format: '格式', destination: '目标位置',
    status: '状态', error: '错误', stack: '堆栈跟踪', exitCode: '进程退出代码',
    stderr: '进程标准错误', details: '详细信息', reason: '原因',
    unexpectedException: '主进程发生意外异常', unhandledRejection: '未处理的 Promise 拒绝',
    rendererCrash: '渲染进程崩溃', rendererException: '渲染器发生意外错误',
    rendererRejection: '渲染器中存在未处理的 Promise 拒绝', childProcessCrash: '子进程崩溃',
    operationStarted: '操作已开始', operationCompleted: '操作已完成',
    operationFailed: '操作失败', conversionStarted: '转换批次已开始',
    conversionCompleted: '转换批次已完成', zipStarted: 'ZIP 创建已开始',
    zipCompleted: 'ZIP 创建已完成', vaultExportStarted: '保险库导出已开始',
    vaultExportCompleted: '保险库导出已完成', vaultSaveStarted: '保险库存储已开始',
    vaultSaveCompleted: '保险库存储已完成', mediaStarted: '媒体转换已开始',
    mediaCompleted: '媒体转换已完成', archiveStarted: '压缩包提取已开始',
    archiveCompleted: '压缩包提取已完成', folderCompressionStarted: '文件夹压缩已开始',
    folderCompressionCompleted: '文件夹压缩已完成',
    success: '成功', failed: '失败', cancelled: '已取消', unknown: '未知',
  },
};

function currentCrashLogTranslations() {
  return crashLogTranslations[crashLogLanguage] || crashLogTranslations.en;
}

function getLogPath(type, date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  const prefix = type === 'success' ? 'FCP-Succes' : 'FCP_Crash';
  const fileName = `${prefix}_${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${pad(date.getFullYear() % 100)}_${pad(date.getHours())}-${pad(date.getMinutes())}.txt`;
  return path.join(app.getPath('documents'), 'FCP_Logs', fileName);
}

async function writeLog(record, type, date = new Date()) {
  const filePath = getLogPath(type, date);
  const translations = currentCrashLogTranslations();
  const header = type === 'success' ? translations.successHeader : translations.header;
  if (record.event === 'conversionBatchSummary' && Array.isArray(record.groups)) {
    const startedAt = new Date(record.startedAt);
    const finishedAt = new Date(record.finishedAt);
    const pad = value => String(value).padStart(2, '0');
    const formatTime = value => `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
    const formatDate = value => `${pad(value.getDate())}-${pad(value.getMonth() + 1)}-${value.getFullYear()}`;
    const formatSize = bytes => `${new Intl.NumberFormat(crashLogLanguage, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(bytes / 1024 ** 2)}MB`;
    const paragraphs = record.groups.map(group => {
      const lines = [
        `${translations.date}: ${formatDate(startedAt)}`,
        `${translations.duration}: ${formatTime(startedAt)} - ${formatTime(finishedAt)}`,
        `${translations.event}: ${translations.mediaConversion}`,
        `${translations.function}: ${group.functionName || record.functionName || 'handleConvertAll'}`,
      ];
      if (group.fileName) lines.push(`${translations.file}: ${group.fileName}`);
      lines.push(
        `${translations.count}: ${group.count}`,
        `${translations.fileSize}: ${formatSize(group.totalBytes)}`,
        `${translations.fromFormat}: ${group.fromFormat}`,
        `${translations.toFormat}: ${group.toFormat}`,
        `${translations.status}: ${translations[group.status] || group.status}`,
      );
      for (const failure of group.failures || []) {
        lines.push(`${translations.error}: ${failure.message}`);
        if (failure.stack) lines.push(`${translations.stack}:\n${failure.stack}`);
        if (failure.exitCode !== undefined && failure.exitCode !== null) lines.push(`${translations.exitCode}: ${failure.exitCode}`);
        if (failure.stderr) lines.push(`${translations.stderr}:\n${String(failure.stderr).trim()}`);
      }
      return lines.join('\n');
    });
    return appendLogText(filePath, header, paragraphs.join('\n\n'), type);
  }
  const eventText = typeof record.event === 'string'
    ? translations[record.event] || record.event
    : translations.operationFailed;
  const lines = [
    `${translations.time}: ${date.toISOString()}`,
    `${translations.event}: ${eventText}`,
  ];
  if (record.functionName) lines.push(`${translations.function}: ${record.functionName}`);
  if (record.fileName) lines.push(`${translations.file}: ${record.fileName}`);
  if (record.fileNames?.length) lines.push(`${translations.files}: ${record.fileNames.join(', ')}`);
  if (record.count !== undefined) lines.push(`${translations.count}: ${record.count}`);
  if (record.succeededCount !== undefined) lines.push(`${translations.succeededCount}: ${record.succeededCount}`);
  if (record.failedCount !== undefined) lines.push(`${translations.failedCount}: ${record.failedCount}`);
  if (record.format) lines.push(`${translations.format}: ${record.format}`);
  if (record.destination) lines.push(`${translations.destination}: ${record.destination}`);
  if (record.status) lines.push(`${translations.status}: ${translations[record.status] || record.status}`);
  if (record.details) lines.push(`${translations.details}: ${record.details}`);
  if (record.reason) lines.push(`${translations.reason}: ${record.reason}`);

  const error = record.error;
  if (error) {
    const errorMessage = error instanceof Error ? error.message : error.message || String(error);
    lines.push(`${translations.error}: ${errorMessage}`);
    if (error.stack) lines.push(`${translations.stack}:\n${error.stack}`);
    if (error?.exitCode !== undefined && error.exitCode !== null) lines.push(`${translations.exitCode}: ${error.exitCode}`);
    if (error?.stderr) lines.push(`${translations.stderr}:\n${String(error.stderr).trim()}`);
  }
  if (record.exitCode !== undefined && record.exitCode !== null) lines.push(`${translations.exitCode}: ${record.exitCode}`);
  if (record.stderr) lines.push(`${translations.stderr}:\n${String(record.stderr).trim()}`);

  return appendLogText(filePath, header, lines.join('\n'), type);
}

async function appendLogText(filePath, header, text, type) {
  const append = async () => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    try {
      await fs.access(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await fs.writeFile(filePath, `${header}\n${'='.repeat(header.length)}\n\n`, { flag: 'wx' });
    }
    await fs.appendFile(filePath, `${text}\n\n`, 'utf8');
  };

  const pendingWrite = crashLogWriteQueue.then(append, append);
  crashLogWriteQueue = pendingWrite.catch(error => {
    process.stderr.write(`Failed to write FCP ${type} log: ${error?.stack || error}\n`);
  });
  try {
    await pendingWrite;
    return true;
  } catch (error) {
    return false;
  }
}

function writeCrashLog(record) {
  return writeLog(record, 'crash');
}

function writeSuccessLog(record) {
  return writeLog(record, 'success');
}

function recordOperationLog(record, type = 'crash') {
  if (activeOperationLogBatch) {
    activeOperationLogBatch.records.push({ record, type });
    return Promise.resolve(true);
  }
  return type === 'success' ? writeSuccessLog(record) : writeCrashLog(record);
}

async function finishOperationLogBatch(status, finalRecord, summary) {
  const batch = activeOperationLogBatch;
  activeOperationLogBatch = null;
  if (!batch) return finalRecord ? writeCrashLog(finalRecord) : true;
  if (status === 'cancelled' && !finalRecord) return true;
  if (finalRecord) batch.records.push({ record: finalRecord, type: 'crash' });
  const hasFailure = status === 'failed' || batch.records.some(({ record }) =>
    record.status === 'failed' || Boolean(record.error)
  );
  const type = hasFailure ? 'crash' : 'success';
  if (summary && Array.isArray(summary.groups)) {
    if (!summary.groups.length) return true;
    const groups = summary.groups.map(group => ({
      ...group,
      failures: Array.isArray(group.failures) ? [...group.failures] : [],
    }));
    for (const { record } of batch.records) {
      if (!record.error) continue;
      const fileNames = new Set([record.fileName, ...(record.fileNames || [])].filter(Boolean));
      const matchingGroups = groups.filter(group =>
        group.fileNames?.some(fileName => fileNames.has(fileName)) || (group.fileName && fileNames.has(group.fileName))
      );
      const targetGroups = matchingGroups.length ? matchingGroups : [groups[0]];
      const error = record.error;
      const failure = {
        message: error instanceof Error ? error.message : error.message || String(error),
        stack: error.stack,
        exitCode: error.exitCode,
        stderr: error.stderr,
      };
      for (const group of targetGroups) {
        if (!group.failures.some(existing => existing.message === failure.message)) group.failures.push(failure);
        group.status = 'failed';
      }
    }
    return writeLog({
      event: 'conversionBatchSummary',
      functionName: 'handleConvertAll',
      startedAt: summary.startedAt || batch.startedAt,
      finishedAt: summary.finishedAt || new Date(),
      groups,
    }, type, batch.startedAt);
  }
  for (const { record } of batch.records) {
    await writeLog(record, type, batch.startedAt);
  }
  return true;
}

function isSuccessLogRecord(record) {
  if (record.error || record.status === 'failed') return false;
  return record.status === 'success';
}

function isCancellationError(error) {
  return /cancelled by the user|extraction was cancelled|operation was cancelled/i.test(
    String(error?.message || error)
  );
}

function getIpcCrashLogContext(channel, args) {
  const context = { functionName: channel };
  const options = args[0] && typeof args[0] === 'object' && !ArrayBuffer.isView(args[0]) ? args[0] : null;
  const fileName = options?.fileName || options?.requestedFileName ||
    (channel === 'fcp:convert-media' || channel === 'fcp:transcribe-audio' ? args[1] : null) ||
    (channel === 'fcp:extract-archive' ? args[2] : null) ||
    (channel === 'fcp:stage-file' ? args[1] : null) ||
    (channel === 'fcp:delete-source-file' ? args[0] : null);
  if (fileName) context.fileName = path.basename(String(fileName));
  const targetFormat = options?.targetFormat ||
    (channel === 'fcp:convert-media' || channel === 'fcp:transcribe-audio' ? args[2] : null);
  if (targetFormat) context.format = String(targetFormat);
  if (Number.isFinite(options?.count)) context.count = Number(options.count);
  if (channel === 'fcp:export-vault-file') context.count = 1;
  if (['fcp:convert-media', 'fcp:transcribe-audio', 'fcp:extract-archive'].includes(channel)) context.count = 1;
  if (channel === 'fcp:compress-folders' && Array.isArray(args[0])) {
    context.fileNames = args[0].map(folderPath => path.basename(String(folderPath)));
    context.count = args[0].length;
  }
  return context;
}

const registerIpcHandler = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, listener) => registerIpcHandler(channel, async (event, ...args) => {
  if (['fcp:set-crash-log-language', 'fcp:write-crash-log', 'fcp:begin-operation-log-batch', 'fcp:complete-operation-log-batch'].includes(channel)) return listener(event, ...args);
  const context = getIpcCrashLogContext(channel, args);
  const operationLifecycle = {
    'fcp:convert-media': ['mediaStarted', 'mediaCompleted'],
    'fcp:transcribe-audio': ['mediaStarted', 'mediaCompleted'],
    'fcp:extract-archive': ['archiveStarted', 'archiveCompleted'],
    'fcp:compress-folders': ['folderCompressionStarted', 'folderCompressionCompleted'],
    'fcp:save-vault-file': ['vaultSaveStarted', 'vaultSaveCompleted'],
    'fcp:export-vault-file': ['vaultExportStarted', 'vaultExportCompleted'],
  }[channel];

  try {
    const result = await listener(event, ...args);
    const passwordPromptRequired = channel === 'fcp:extract-archive' && result?.passwordRequired === true;
    if (operationLifecycle && channel !== 'fcp:compress-folders' && !passwordPromptRequired && result !== null) {
      await recordOperationLog({ ...context, event: operationLifecycle[0], status: 'success' }, 'success');
      await recordOperationLog({
        ...context,
        event: operationLifecycle[1],
        status: 'success',
      }, 'success');
    }
    if (channel === 'fcp:compress-folders' && Array.isArray(result)) {
      const failed = result.filter(item => item.error);
      const logType = failed.length ? 'crash' : 'success';
      if (!failed.length) await recordOperationLog({ ...context, event: 'folderCompressionStarted', status: 'success' }, logType);
      await recordOperationLog({
        ...context,
        event: 'folderCompressionCompleted',
        status: failed.length ? 'failed' : 'success',
        succeededCount: result.length - failed.length,
        failedCount: failed.length,
        details: failed.length ? failed.map(item => `${path.basename(item.folderPath)} (${item.error})`).join('; ') : undefined,
      }, logType);
    }
    return result;
  } catch (error) {
    if (!isCancellationError(error)) {
      await recordOperationLog({ ...context, event: 'operationFailed', status: 'failed', error }, 'crash');
    }
    throw error;
  }
});

ipcMain.handle('fcp:set-crash-log-language', async (_event, language) => setCrashLogLanguage(language));
ipcMain.handle('fcp:begin-operation-log-batch', async () => {
  if (activeOperationLogBatch) await finishOperationLogBatch('failed');
  activeOperationLogBatch = { startedAt: new Date(), records: [] };
  return true;
});
ipcMain.handle('fcp:complete-operation-log-batch', async (_event, status, summary) => {
  const finalStatus = status === 'failed' || status === 'cancelled' ? status : 'success';
  return finishOperationLogBatch(finalStatus, undefined, summary);
});
ipcMain.handle('fcp:write-crash-log', async (_event, record) => {
  if (!record || typeof record !== 'object') throw new Error('Invalid crash log event.');
  const logRecord = {
    event: String(record.event || 'operationFailed'),
    functionName: record.functionName ? String(record.functionName) : undefined,
    fileName: record.fileName ? path.basename(String(record.fileName)) : undefined,
    fileNames: Array.isArray(record.fileNames) ? record.fileNames.map(name => path.basename(String(name))) : undefined,
    count: Number.isFinite(record.count) ? Number(record.count) : undefined,
    succeededCount: Number.isFinite(record.succeededCount) ? Number(record.succeededCount) : undefined,
    failedCount: Number.isFinite(record.failedCount) ? Number(record.failedCount) : undefined,
    format: record.format ? String(record.format) : undefined,
    destination: record.destination ? String(record.destination) : undefined,
    status: record.status ? String(record.status) : undefined,
    details: record.details ? String(record.details) : undefined,
    reason: record.reason ? String(record.reason) : undefined,
    error: record.error && typeof record.error === 'object'
      ? {
        name: String(record.error.name || 'Error'),
        message: String(record.error.message || ''),
        stack: record.error.stack ? String(record.error.stack) : undefined,
        exitCode: record.error.exitCode,
        stderr: record.error.stderr ? String(record.error.stderr) : undefined,
      }
      : record.error ? String(record.error) : undefined,
  };
  if (logRecord.status === 'cancelled') return true;
  return recordOperationLog(logRecord, isSuccessLogRecord(logRecord) ? 'success' : 'crash');
});

process.on('uncaughtException', (error, origin) => {
  void finishOperationLogBatch('failed', {
    event: 'unexpectedException',
    functionName: 'process.uncaughtException',
    reason: origin,
    error,
  }).finally(() => app.exit(1));
});

process.on('unhandledRejection', reason => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  void finishOperationLogBatch('failed', {
    event: 'unhandledRejection',
    functionName: 'process.unhandledRejection',
    error,
  });
});

app.on('child-process-gone', (_event, details) => {
  void writeCrashLog({
    event: 'childProcessCrash',
    functionName: 'app.child-process-gone',
    reason: `${details.type}: ${details.reason}`,
    exitCode: details.exitCode,
  });
});

async function setCrashLogLanguage(language) {
  const normalizedLanguage = String(language || '').toLowerCase().split('-')[0];
  if (!Object.hasOwn(crashLogTranslations, normalizedLanguage)) throw new Error('Unsupported crash log language.');
  crashLogLanguage = normalizedLanguage;
  await fs.writeFile(crashLogLanguagePath, JSON.stringify({ language: normalizedLanguage }), 'utf8');
  return true;
}

async function loadCrashLogLanguage() {
  try {
    const settings = JSON.parse(await fs.readFile(crashLogLanguagePath, 'utf8'));
    if (Object.hasOwn(crashLogTranslations, settings.language)) crashLogLanguage = settings.language;
  } catch (error) {
    if (error.code !== 'ENOENT') process.stderr.write(`Could not load crash log language: ${error.message}\n`);
  }
}

function assertConversionNotCancelled(generation) {
  if (generation !== conversionCancellationGeneration) throw new Error('Conversion cancelled by the user.');
}

const VAULT_MAGIC = 'FCPVAULT1';
const VAULT_VERSION = 1;
const VAULT_BINARY_MAGIC = Buffer.from('FCPVLT2\0');
const VAULT_KDF_OPTIONS = { algorithm: 2, memoryCost: 65536, timeCost: 3, parallelism: 1, outputLen: 32 };

async function readVaultConfig() {
  try {
    return JSON.parse(await fs.readFile(vaultConfigPath, 'utf8'));
  } catch {
    return null;
  }
}

async function deriveVaultKey(password, salt) {
  if (typeof password !== 'string' || password.length < 10) throw new Error('Vault password must contain at least 10 characters.');
  return hashRaw(password, { ...VAULT_KDF_OPTIONS, salt: Buffer.from(salt, 'base64') });
}

function encryptVaultPayload(data, key) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()]);
  return { magic: VAULT_MAGIC, version: VAULT_VERSION, nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') };
}

function decryptVaultPayload(container, key) {
  if (container?.magic !== VAULT_MAGIC || container.version !== VAULT_VERSION) throw new Error('Unsupported vault container.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(container.nonce, 'base64'));
  decipher.setAuthTag(Buffer.from(container.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(container.data, 'base64')), decipher.final()]);
}

async function saveVaultFileFromZipPath(config, key, sourcePath, fileName) {
  const zipPath = resolveTempZipPath(sourcePath);
  const zipStats = await fs.stat(zipPath);
  const vaultDirectory = path.join(config.outputDirectory, '.fcp-vault');
  await fs.mkdir(vaultDirectory, { recursive: true });
  const entries = (await fs.readdir(vaultDirectory)).filter(name => name.endsWith('.fcpv'));
  const currentSize = (await Promise.all(entries.map(async name => (await fs.stat(path.join(vaultDirectory, name))).size))).reduce((sum, size) => sum + size, 0);
  const token = randomUUID();
  const containerTempPath = path.join(vaultDirectory, `${token}.container.tmp`);
  const encryptedPayloadPath = path.join(vaultDirectory, `${token}.payload.tmp`);
  const storagePath = path.join(vaultDirectory, `${token}.fcpv`);
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);

  try {
    await pipeline(createReadStream(zipPath), cipher, createWriteStream(encryptedPayloadPath, { flags: 'wx' }));
    const header = Buffer.from(JSON.stringify({
      magic: VAULT_MAGIC,
      version: 2,
      fileName: encryptVaultPayload(Buffer.from(fileName, 'utf8'), key),
      nonce: nonce.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
    }), 'utf8');
    const headerLength = Buffer.alloc(4);
    headerLength.writeUInt32BE(header.length);
    await fs.writeFile(containerTempPath, Buffer.concat([VAULT_BINARY_MAGIC, headerLength, header]), { flag: 'wx' });
    await pipeline(createReadStream(encryptedPayloadPath), createWriteStream(containerTempPath, { flags: 'a' }));

    const containerStats = await fs.stat(containerTempPath);
    if (currentSize + containerStats.size > config.quotaBytes) throw new Error('The vault quota has been reached.');
    await fs.rename(containerTempPath, storagePath);
    return { storagePath, bytes: zipStats.size };
  } finally {
    await Promise.all([
      fs.rm(encryptedPayloadPath, { force: true }),
      fs.rm(containerTempPath, { force: true }),
    ]);
  }
}

ipcMain.handle('fcp:get-vault-status', async () => {
  const config = await readVaultConfig();
  return config ? { enabled: true, outputDirectory: config.outputDirectory, quotaBytes: config.quotaBytes } : { enabled: false };
});

ipcMain.handle('fcp:create-vault', async (_event, options) => {
  const requestedDirectory = String(options?.outputDirectory || '').trim();
  if (!requestedDirectory) throw new Error('Choose an output directory before creating a vault.');
  const outputDirectory = path.resolve(requestedDirectory);
  const password = String(options?.password || '');
  const quotaGb = Number(options?.quotaGb);
  if (!outputDirectory || !Number.isFinite(quotaGb) || quotaGb <= 0 || quotaGb > 1024) throw new Error('Invalid vault settings.');
  const salt = crypto.randomBytes(16).toString('base64');
  const key = await deriveVaultKey(password, salt);
  const verifier = encryptVaultPayload(Buffer.from('FCP vault verifier'), key);
  await fs.mkdir(path.join(outputDirectory, '.fcp-vault'), { recursive: true });
  const quotaBytes = Math.floor(quotaGb * 1024 ** 3);
  await fs.writeFile(vaultConfigPath, JSON.stringify({ version: VAULT_VERSION, outputDirectory, quotaBytes, salt, verifier }), 'utf8');
  return { enabled: true, outputDirectory, quotaBytes };
});

ipcMain.handle('fcp:disable-vault', async () => {
  await fs.rm(vaultConfigPath, { force: true });
  return true;
});

ipcMain.handle('fcp:save-vault-file', async (_event, options) => {
  const config = await readVaultConfig();
  if (!config) throw new Error('No vault is configured.');
  const key = await deriveVaultKey(String(options?.password || ''), config.salt);
  decryptVaultPayload(config.verifier, key);
  const fileName = path.basename(String(options?.fileName || 'converted-files.zip'));
  if (options?.filePath) return saveVaultFileFromZipPath(config, key, options.filePath, fileName);
  const data = Buffer.from(options?.data || []);
  const vaultDirectory = path.join(config.outputDirectory, '.fcp-vault');
  await fs.mkdir(vaultDirectory, { recursive: true });
  const entries = (await fs.readdir(vaultDirectory)).filter(fileName => fileName.endsWith('.fcpv'));
  const currentSize = (await Promise.all(entries.map(async fileName => (await fs.stat(path.join(vaultDirectory, fileName))).size))).reduce((sum, size) => sum + size, 0);
  const payload = Buffer.from(JSON.stringify({ fileName, data: data.toString('base64') }), 'utf8');
  const containerData = Buffer.from(JSON.stringify(encryptVaultPayload(payload, key)), 'utf8');
  if (currentSize + containerData.length > config.quotaBytes) throw new Error('The vault quota has been reached.');
  const storagePath = path.join(vaultDirectory, `${randomUUID()}.fcpv`);
  await fs.writeFile(storagePath, containerData, { flag: 'wx' });
  return { storagePath, bytes: data.length };
});

ipcMain.handle('fcp:list-vault-files', async (_event, options) => {
  const config = await readVaultConfig();
  if (!config) throw new Error('No vault is configured.');
  const key = await deriveVaultKey(String(options?.password || ''), config.salt);
  decryptVaultPayload(config.verifier, key);
  const vaultDirectory = path.join(config.outputDirectory, '.fcp-vault');
  await fs.mkdir(vaultDirectory, { recursive: true });
  const fileNames = (await fs.readdir(vaultDirectory)).filter(fileName => fileName.endsWith('.fcpv'));
  const files = await Promise.all(fileNames.map(async storageName => {
    const storagePath = path.join(vaultDirectory, storageName);
    const stats = await fs.stat(storagePath);
    let fileName = storageName;
    try {
      const fileHandle = await fs.open(storagePath, 'r');
      try {
        const marker = Buffer.alloc(VAULT_BINARY_MAGIC.length);
        const { bytesRead } = await fileHandle.read(marker, 0, marker.length, 0);
        if (bytesRead === marker.length && marker.equals(VAULT_BINARY_MAGIC)) {
          const lengthBuffer = Buffer.alloc(4);
          await fileHandle.read(lengthBuffer, 0, lengthBuffer.length, VAULT_BINARY_MAGIC.length);
          const headerLength = lengthBuffer.readUInt32BE();
          if (headerLength > 64 * 1024) throw new Error('Invalid vault header.');
          const headerBuffer = Buffer.alloc(headerLength);
          await fileHandle.read(headerBuffer, 0, headerBuffer.length, VAULT_BINARY_MAGIC.length + 4);
          const header = JSON.parse(headerBuffer.toString('utf8'));
          if (header.magic !== VAULT_MAGIC || header.version !== 2) throw new Error('Unsupported vault container.');
          if (header.fileName) fileName = path.basename(decryptVaultPayload(header.fileName, key).toString('utf8'));
        } else if (stats.size <= 16 * 1024 * 1024) {
          const container = JSON.parse(await fs.readFile(storagePath, 'utf8'));
          const payload = decryptVaultPayload(container, key);
          const metadata = JSON.parse(payload.toString('utf8'));
          if (metadata?.fileName) fileName = path.basename(metadata.fileName);
        }
      } finally {
        await fileHandle.close();
      }
    } catch {
      // Keep damaged or legacy containers visible so the user can still attempt export.
    }
    return { storageName, fileName, bytes: stats.size, modifiedAt: stats.mtimeMs };
  }));
  return files.sort((left, right) => right.modifiedAt - left.modifiedAt);
});

ipcMain.handle('fcp:export-vault-file', async (_event, options) => {
  const config = await readVaultConfig();
  if (!config) throw new Error('No vault is configured.');
  const key = await deriveVaultKey(String(options?.password || ''), config.salt);
  decryptVaultPayload(config.verifier, key);
  const storageName = path.basename(String(options?.storageName || ''));
  if (!storageName.endsWith('.fcpv')) throw new Error('Invalid vault file.');
  const storagePath = path.join(config.outputDirectory, '.fcp-vault', storageName);
  const fileName = path.basename(String(options?.fileName || 'converted-files.zip'));
  const result = await dialog.showSaveDialog({ defaultPath: fileName });
  if (result.canceled || !result.filePath) return null;

  const temporaryPath = path.join(path.dirname(result.filePath), `.${path.basename(result.filePath)}.${randomUUID()}.tmp`);
  const handle = await fs.open(storagePath, 'r');
  try {
    const marker = Buffer.alloc(VAULT_BINARY_MAGIC.length);
    const { bytesRead } = await handle.read(marker, 0, marker.length, 0);
    if (bytesRead === marker.length && marker.equals(VAULT_BINARY_MAGIC)) {
      const lengthBuffer = Buffer.alloc(4);
      await handle.read(lengthBuffer, 0, lengthBuffer.length, VAULT_BINARY_MAGIC.length);
      const headerLength = lengthBuffer.readUInt32BE();
      if (!headerLength || headerLength > 64 * 1024) throw new Error('Invalid vault header.');
      const headerBuffer = Buffer.alloc(headerLength);
      await handle.read(headerBuffer, 0, headerBuffer.length, VAULT_BINARY_MAGIC.length + 4);
      const header = JSON.parse(headerBuffer.toString('utf8'));
      if (header.magic !== VAULT_MAGIC || header.version !== 2) throw new Error('Unsupported vault container.');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(header.nonce, 'base64'));
      decipher.setAuthTag(Buffer.from(header.tag, 'base64'));
      await pipeline(
        createReadStream(storagePath, { start: VAULT_BINARY_MAGIC.length + 4 + headerLength }),
        decipher,
        createWriteStream(temporaryPath, { flags: 'wx' }),
      );
    } else {
      await pipeline(
        createReadStream(storagePath),
        createLegacyVaultDecryptTransform(key),
        createLegacyVaultPayloadTransform(),
        createWriteStream(temporaryPath, { flags: 'wx' }),
      );
    }
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  } finally {
    await handle.close();
  }

  try {
    await fs.copyFile(temporaryPath, result.filePath);
    return result.filePath;
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
});

function createLegacyVaultDecryptTransform(key) {
  let headerText = '';
  let decipher = null;
  let ciphertextRemainder = '';
  const marker = ',"data":"';

  return new Transform({
    transform(chunk, _encoding, callback) {
      try {
        if (!decipher) {
          headerText += chunk.toString('utf8');
          const markerIndex = headerText.indexOf(marker);
          if (markerIndex === -1) {
            if (headerText.length > 64 * 1024) throw new Error('Invalid legacy vault container.');
            callback();
            return;
          }
          const container = JSON.parse(`${headerText.slice(0, markerIndex)}}`);
          if (container.magic !== VAULT_MAGIC || container.version !== VAULT_VERSION) throw new Error('Unsupported vault container.');
          decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(container.nonce, 'base64'));
          decipher.setAuthTag(Buffer.from(container.tag, 'base64'));
          const remainder = headerText.slice(markerIndex + marker.length);
          headerText = '';
          pushCiphertext(remainder, this);
          callback();
          return;
        }
        pushCiphertext(chunk.toString('ascii'), this);
        callback();
      } catch (error) {
        callback(error);
      }
    },
    flush(callback) {
      try {
        if (!decipher) throw new Error('Invalid legacy vault container.');
        if (ciphertextRemainder) this.push(decipher.update(Buffer.from(ciphertextRemainder, 'base64')));
        this.push(decipher.final());
        callback();
      } catch (error) {
        callback(error);
      }
    },
  });

  function pushCiphertext(text, stream) {
    const base64 = text.replace(/[^A-Za-z0-9+/=]/g, '');
    const combined = ciphertextRemainder + base64;
    const completeLength = combined.length - combined.length % 4;
    if (completeLength) stream.push(decipher.update(Buffer.from(combined.slice(0, completeLength), 'base64')));
    ciphertextRemainder = combined.slice(completeLength);
  }
}

function createLegacyVaultPayloadTransform() {
  let mode = null;
  let prefix = Buffer.alloc(0);
  let markerRemainder = '';
  const marker = ',"data":"';

  return new Transform({
    transform(chunk, _encoding, callback) {
      if (mode === 'raw') {
        this.push(chunk);
        callback();
        return;
      }
      if (mode === 'base64') {
        decodePayloadBase64(chunk.toString('ascii'), this);
        callback();
        return;
      }

      prefix = prefix.length ? Buffer.concat([prefix, chunk]) : chunk;
      const prefixText = prefix.toString('utf8');
      if (!prefixText.startsWith('{') && prefix.length >= 1) {
        mode = 'raw';
        this.push(prefix);
        prefix = Buffer.alloc(0);
        callback();
        return;
      }
      const markerIndex = prefixText.indexOf(marker);
      if (markerIndex !== -1) {
        mode = 'base64';
        decodePayloadBase64(prefixText.slice(markerIndex + marker.length), this);
        prefix = Buffer.alloc(0);
      } else if (prefix.length > 64 * 1024) {
        mode = 'raw';
        this.push(prefix);
        prefix = Buffer.alloc(0);
      }
      callback();
    },
    flush(callback) {
      if (mode === null) this.push(prefix);
      if (mode === 'base64' && markerRemainder) this.push(Buffer.from(markerRemainder, 'base64'));
      callback();
    },
  });

  function decodePayloadBase64(text, stream) {
    const base64 = text.replace(/[^A-Za-z0-9+/=]/g, '');
    const combined = markerRemainder + base64;
    const completeLength = combined.length - combined.length % 4;
    if (completeLength) stream.push(Buffer.from(combined.slice(0, completeLength), 'base64'));
    markerRemainder = combined.slice(completeLength);
  }
}

ipcMain.handle('fcp:delete-vault-file', async (_event, options) => {
  const config = await readVaultConfig();
  if (!config) throw new Error('No vault is configured.');
  const key = await deriveVaultKey(String(options?.password || ''), config.salt);
  decryptVaultPayload(config.verifier, key);
  const storageName = path.basename(String(options?.storageName || ''));
  if (!storageName.endsWith('.fcpv')) throw new Error('Invalid vault file.');
  await fs.rm(path.join(config.outputDirectory, '.fcp-vault', storageName), { force: true });
  return true;
});

async function readWallpaperConfig() {
  try {
    const config = JSON.parse(await fs.readFile(wallpaperConfigPath, 'utf8'));
    const wallpaper = config?.Configurations?.Wallpaper;
    if (wallpaper?.Wallpaper_on_off !== 'On' || !wallpaper.Wallpaperpath) {
      return { enabled: false, path: null, type: null, dataUrl: null, videoUrl: null };
    }
    const extension = path.extname(wallpaper.Wallpaperpath).toLowerCase();
    if (extension === '.mp4' || extension === '.webm') {
      return { enabled: true, path: wallpaper.Wallpaperpath, type: 'video', dataUrl: null, videoUrl: 'fcp-wallpaper://wallpaper/background' };
    }
    const imageData = await fs.readFile(wallpaper.Wallpaperpath);
    const mimeType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
    return { enabled: true, path: wallpaper.Wallpaperpath, type: 'image', dataUrl: `data:${mimeType};base64,${imageData.toString('base64')}`, videoUrl: null };
  } catch {
    return { enabled: false, path: null, type: null, dataUrl: null, videoUrl: null };
  }
}

function registerWallpaperProtocol() {
  protocol.handle('fcp-wallpaper', async request => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const url = new URL(request.url);
    if (url.hostname !== 'wallpaper' || url.pathname !== '/background') {
      return new Response(null, { status: 404 });
    }

    try {
      const config = JSON.parse(await fs.readFile(wallpaperConfigPath, 'utf8'));
      const wallpaperPath = config?.Configurations?.Wallpaper?.Wallpaperpath;
      const extension = path.extname(String(wallpaperPath || '')).toLowerCase();
      if (config?.Configurations?.Wallpaper?.Wallpaper_on_off !== 'On' || !['.mp4', '.webm'].includes(extension)) {
        return new Response(null, { status: 404 });
      }

      const { size } = await fs.stat(wallpaperPath);
      const mimeType = extension === '.webm' ? 'video/webm' : 'video/mp4';
      const rangeHeader = request.headers.get('range');
      const headers = new Headers({
        'Accept-Ranges': 'bytes',
        'Content-Type': mimeType,
        'Cache-Control': 'no-store'
      });

      if (request.method === 'HEAD') {
        headers.set('Content-Length', String(size));
        return new Response(null, { status: 200, headers });
      }

      if (rangeHeader) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
        if (!match || (!match[1] && !match[2])) {
          headers.set('Content-Range', `bytes */${size}`);
          return new Response(null, { status: 416, headers });
        }
        const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
        const end = match[2] && match[1] ? Math.min(Number(match[2]), size - 1) : size - 1;
        if (start >= size || start > end) {
          headers.set('Content-Range', `bytes */${size}`);
          return new Response(null, { status: 416, headers });
        }

        headers.set('Content-Length', String(end - start + 1));
        headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
        const stream = createReadStream(wallpaperPath, { start, end });
        return new Response(Readable.toWeb(stream), { status: 206, headers });
      }

      headers.set('Content-Length', String(size));
      return new Response(Readable.toWeb(createReadStream(wallpaperPath)), { status: 200, headers });
    } catch (error) {
      console.error('Failed to serve background video', error);
      return new Response(null, { status: 404 });
    }
  });
}

async function writeWallpaperConfig(enabled, wallpaperPath = '') {
  const config = { Configurations: { Wallpaper: {
    Wallpaperset: Boolean(wallpaperPath), Wallpaperpath: wallpaperPath,
    Wallpaper_on_off: enabled && wallpaperPath ? 'On' : 'Off'
  } } };
  await fs.mkdir(path.dirname(wallpaperConfigPath), { recursive: true });
  await fs.writeFile(wallpaperConfigPath, JSON.stringify(config, null, 2), 'utf8');
}

ipcMain.handle('fcp:get-ffmpeg-path', () => ffmpegPath);
ipcMain.handle('fcp:get-gpu-info', () => gpuInfo);
ipcMain.handle('fcp:check-for-update', async () => {
  try {
    const response = await fetch(`https://api.github.com/repos/${updateRepository}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'File-Converter-Pro' }
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const release = await response.json();
    const latestVersion = String(release.tag_name || '').match(/\d+(?:\.\d+){2,}/)?.[0] || '';
    const currentVersion = app.getVersion().replace(/^v/i, '');
    const parseVersion = version => (version.match(/\d+(?:\.\d+){2,}/)?.[0] || '0.0.0').split('.').map(Number);
    const current = parseVersion(currentVersion);
    const latest = parseVersion(latestVersion);
    const firstDifference = latest.findIndex((value, index) => value !== (current[index] || 0));
    const isNewer = firstDifference >= 0 && latest[firstDifference] > (current[firstDifference] || 0);
    const installer = Array.isArray(release.assets) ? release.assets.find(asset => /\.exe$/i.test(asset.name) && asset.browser_download_url) : null;
    if (!isNewer || !installer) return null;
    return { version: latestVersion, releaseUrl: release.html_url, downloadUrl: installer.browser_download_url, fileName: installer.name };
  } catch (error) {
    console.warn('Update check failed:', error.message || error);
    return null;
  }
});
ipcMain.handle('fcp:download-and-install-update', async (_event, update) => {
  if (!update?.downloadUrl || !/^https:\/\/github\.com\//i.test(update.downloadUrl)) throw new Error('Invalid update source.');
  const response = await fetch(update.downloadUrl, { headers: { 'User-Agent': 'File-Converter-Pro' } });
  if (!response.ok) throw new Error(`Update download failed with status ${response.status}`);
  const installerPath = path.join(os.tmpdir(), update.fileName || 'File-Converter-Pro-update.exe');
  await fs.writeFile(installerPath, Buffer.from(await response.arrayBuffer()));
  if (process.platform !== 'win32') throw new Error('Automatic installation is currently supported on Windows only.');
  spawn(installerPath, [], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
  setTimeout(() => app.quit(), 250);
  return true;
});
ipcMain.handle('fcp:cancel-conversion', async () => {
  conversionCancellationGeneration += 1;
  for (const childProcess of activeConversionProcesses) {
    cancelledConversionProcesses.add(childProcess);
    if (!childProcess.killed) childProcess.kill('SIGKILL');
  }
  return true;
});
ipcMain.handle('fcp:get-wallpaper', () => readWallpaperConfig());
ipcMain.handle('fcp:transcribe-audio', async (event, fileData, fileName, targetFormat) => {
  const cancellationGeneration = conversionCancellationGeneration;
  const format = String(targetFormat || 'TXT').toUpperCase();
  const workDir = path.join(app.getPath('temp'), 'fcp-whisper', randomUUID());
  const extension = path.extname(fileName) || '.wav';
  const inputPath = path.join(workDir, `input${extension}`);
  const normalizedPath = path.join(workDir, 'normalized.wav');

  await fs.mkdir(workDir, { recursive: true });
  await fs.writeFile(inputPath, Buffer.from(fileData));

  try {
    if (process.platform === 'win32') {
      const runtimeFiles = ['whisper-cli.exe', 'whisper.dll', 'ggml.dll', 'ggml-base.dll', 'ggml-cpu.dll', 'ggml-base.bin'];
      await Promise.all(runtimeFiles.map(fileName => fs.access(path.join(whisperRuntimePath, fileName))));
    }

    const ffmpegArgs = ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', normalizedPath];
    assertConversionNotCancelled(cancellationGeneration);
    await new Promise((resolve, reject) => {
      const childProcess = spawn(nativeFfmpegPath, ffmpegArgs, { windowsHide: true });
      activeConversionProcesses.add(childProcess);
      let stderr = '';
      childProcess.stderr.on('data', data => { stderr += data.toString(); });
      childProcess.on('error', error => {
        activeConversionProcesses.delete(childProcess);
        reject(error);
      });
      childProcess.on('close', code => {
        activeConversionProcesses.delete(childProcess);
        if (cancelledConversionProcesses.has(childProcess)) return reject(new Error('Conversion cancelled by the user.'));
        if (code === 0) resolve();
        else {
          const error = new Error(stderr.trim() || `FFmpeg exited with code ${code}`);
          error.exitCode = code;
          error.stderr = stderr.trim();
          reject(error);
        }
      });
    });

    const whisperArgs = [
      '-m', whisperModelPath,
      '-f', normalizedPath,
      '-l', 'auto',
      '-pp',
      format === 'SRT' ? '-osrt' : '-otxt'
    ];
    assertConversionNotCancelled(cancellationGeneration);
    const result = await new Promise((resolve, reject) => {
      const childProcess = spawn(whisperExecutablePath, whisperArgs, {
        cwd: whisperRootPath,
        windowsHide: true,
        env: {
          ...process.env,
          PATH: process.platform === 'win32'
            ? `${whisperRuntimePath};${process.env.PATH || ''}`
            : process.env.PATH
        }
      });
      activeConversionProcesses.add(childProcess);
      let stdout = '';
      let stderr = '';
      let stderrProgressBuffer = '';
      const reportProgress = data => {
        const text = data.toString();
        const lines = `${stderrProgressBuffer}${text}`.split(/\r?\n/);
        stderrProgressBuffer = lines.pop() || '';
        for (const line of lines) {
          const match = line.match(/progress\s*=\s*(\d{1,3})%/i);
          if (match) {
            event.sender.send('fcp:transcription-progress', Number(match[1]));
          }
        }
        stderr += text;
      };
      childProcess.stdout.on('data', data => {
        const text = data.toString();
        stdout += text;
      });
      childProcess.stderr.on('data', reportProgress);
      childProcess.on('error', error => {
        activeConversionProcesses.delete(childProcess);
        reject(error);
      });
      childProcess.on('close', code => {
        activeConversionProcesses.delete(childProcess);
        if (cancelledConversionProcesses.has(childProcess)) return reject(new Error('Conversion cancelled by the user.'));
        if (code === 0) resolve(stdout);
        else {
          const error = new Error(stderr.trim() || stdout.trim() || `Whisper exited with code ${code}`);
          error.exitCode = code;
          error.stderr = stderr.trim();
          reject(error);
        }
      });
    });

    assertConversionNotCancelled(cancellationGeneration);
    const outputExtension = format === 'SRT' ? '.srt' : '.txt';
    const outputFile = (await fs.readdir(workDir)).find(name => name.toLowerCase().endsWith(outputExtension));

    if (outputFile) {
      return await fs.readFile(path.join(workDir, outputFile), 'utf8');
    }

    if (Array.isArray(result) && result.length > 0) {
      return result
        .map((item) => item.speech ?? '')
        .filter(Boolean)
        .join('\n');
    }

    throw new Error('Whisper finished without producing a transcript file.');
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
});
ipcMain.handle('fcp:choose-wallpaper', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Images and videos', extensions: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm'] }] });
  if (result.canceled || !result.filePaths[0]) return readWallpaperConfig();
  await writeWallpaperConfig(true, result.filePaths[0]);
  return readWallpaperConfig();
});
ipcMain.handle('fcp:choose-output-directory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  return result.canceled ? null : result.filePaths[0] || null;
});
ipcMain.handle('fcp:get-temp-directory', async () => app.getPath('temp'));
function resolveTempZipPath(filePath) {
  const zipDirectory = path.resolve(app.getPath('temp'), 'fcp-zips');
  const resolvedPath = path.resolve(String(filePath || ''));
  if (path.dirname(resolvedPath) !== zipDirectory || path.extname(resolvedPath).toLowerCase() !== '.zip') {
    throw new Error('Invalid temporary ZIP path.');
  }
  return resolvedPath;
}
ipcMain.handle('fcp:create-zip-file', async () => {
  const zipDirectory = path.join(app.getPath('temp'), 'fcp-zips');
  const zipPath = path.join(zipDirectory, `${randomUUID()}.zip`);
  await fs.mkdir(zipDirectory, { recursive: true });
  await fs.writeFile(zipPath, Buffer.alloc(0), { flag: 'wx' });
  return zipPath;
});
ipcMain.handle('fcp:append-zip-file', async (_event, filePath, data) => {
  await fs.appendFile(resolveTempZipPath(filePath), Buffer.from(data));
  return true;
});
ipcMain.handle('fcp:cleanup-zip-file', async (_event, filePath) => {
  await fs.rm(resolveTempZipPath(filePath), { force: true });
  return true;
});
ipcMain.handle('fcp:write-output-file', async (_event, filePath, data) => {
  const resolvedPath = path.resolve(String(filePath));
  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.writeFile(resolvedPath, Buffer.from(data));
  return resolvedPath;
});
ipcMain.handle('fcp:write-debug-report', async (_event, options) => {
  const requestedDirectory = String(options?.outputDirectory || '').trim();
  const reportDirectory = requestedDirectory ? path.resolve(requestedDirectory) : app.getPath('userData');
  const reportPath = path.join(reportDirectory, 'debug.txt');
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(reportPath, String(options?.report || ''), 'utf8');
  return reportPath;
});
ipcMain.handle('fcp:stage-file', async (_event, fileData, fileName) => {
  const stagingDirectory = path.join(app.getPath('temp'), 'fcp-staging');
  const stagedPath = path.join(stagingDirectory, `${randomUUID()}-${path.basename(String(fileName || 'input.bin'))}`);
  await fs.mkdir(stagingDirectory, { recursive: true });
  if (typeof fileData === 'string') {
    await fs.copyFile(fileData, stagedPath);
  } else {
    await fs.writeFile(stagedPath, Buffer.from(fileData));
  }
  return stagedPath;
});
ipcMain.handle('fcp:cleanup-staged-file', async (_event, filePath) => {
  await fs.rm(String(filePath), { force: true });
  return true;
});
ipcMain.handle('fcp:compress-folders', async (_event, requestedFolderPaths, requestedFormat, requestedOutputDirectory) => {
  const formats = {
    ZIP: { extension: '.zip', type: 'zip' },
    '7Z': { extension: '.7z', type: '7z' },
    TAR: { extension: '.tar', type: 'tar' },
    'GZ/TGZ': { extension: '.tar.gz', type: 'gzip', tar: true },
    'BZ2/TBZ': { extension: '.tar.bz2', type: 'bzip2', tar: true },
    'XZ/TXZ': { extension: '.tar.xz', type: 'xz', tar: true },
    LZMA: { extension: '.tar.lzma', type: 'lzma', tar: true },
    CAB: { extension: '.cab', type: 'cab' },
  };
  const format = formats[String(requestedFormat || '')];
  if (!format) throw new Error('Unsupported folder archive format.');
  if (!Array.isArray(requestedFolderPaths) || requestedFolderPaths.length === 0) {
    throw new Error('No folders were provided for compression.');
  }

  let outputDirectory = String(requestedOutputDirectory || '').trim();
  if (!outputDirectory) {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths[0]) throw new Error('Folder compression was cancelled.');
    outputDirectory = result.filePaths[0];
  }
  outputDirectory = path.resolve(outputDirectory);
  await fs.mkdir(outputDirectory, { recursive: true });

  const runSevenZip = (args, cwd) => new Promise((resolve, reject) => {
    const process = spawn(sevenZipPath, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    process.stdout.on('data', chunk => { if (stdout.length < 1024 * 1024) stdout += chunk.toString(); });
    process.stderr.on('data', chunk => { if (stderr.length < 1024 * 1024) stderr += chunk.toString(); });
    process.on('error', reject);
    process.on('close', code => {
      if (code !== 0) return reject(new Error(`7-Zip failed with code ${code}: ${(stderr || stdout).trim().slice(-800)}`));
      resolve();
    });
  });

  const runSystemCommand = (command, args, cwd, env = process.env) => new Promise((resolve, reject) => {
    const process = spawn(command, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    process.stdout.on('data', chunk => { if (stdout.length < 1024 * 1024) stdout += chunk.toString(); });
    process.stderr.on('data', chunk => { if (stderr.length < 1024 * 1024) stderr += chunk.toString(); });
    process.on('error', reject);
    process.on('close', code => {
      if (code !== 0) return reject(new Error(`${path.basename(command)} failed with code ${code}: ${(stderr || stdout).trim().slice(-800)}`));
      resolve(stdout);
    });
  });

  const createCabArchive = async (folderPath, archivePath, workDirectory) => {
    if (process.platform !== 'win32') throw new Error('CAB folder compression is only available on Windows.');
    const folderName = path.basename(folderPath);
    const entries = [];
    const collectFiles = async (directoryPath, relativePath = '') => {
      const children = await fs.readdir(directoryPath, { withFileTypes: true });
      for (const child of children) {
        const sourcePath = path.join(directoryPath, child.name);
        const childRelativePath = path.join(relativePath, child.name);
        if (child.isDirectory()) {
          await collectFiles(sourcePath, childRelativePath);
        } else if (child.isFile()) {
          entries.push({
            sourcePath,
            archivePath: path.join(folderName, childRelativePath).replace(/\//g, '\\'),
          });
          if (entries.length > 65535) throw new Error('CAB archives cannot contain more than 65,535 files.');
        } else {
          throw new Error(`CAB archives cannot include symbolic links or special files: ${sourcePath}`);
        }
      }
    };
    await collectFiles(folderPath);
    if (entries.length === 0) throw new Error('CAB archives cannot store an empty folder.');

    const cabinetFileName = path.basename(archivePath);
    const quote = String.fromCharCode(34);
    const directives = [
      `.Set CabinetNameTemplate=${cabinetFileName}`,
      '.Set DiskDirectoryTemplate=.',
      '.Set CompressionType=MSZIP',
      '.Set Cabinet=ON',
      '.Set Compress=ON',
      '.Set MaxDiskSize=0',
      '.Set CabinetFileCountThreshold=0',
      ...entries.map(entry => `${quote}${entry.sourcePath}${quote} ${quote}${entry.archivePath}${quote}`),
    ];
    const ddfPath = path.join(workDirectory, `${randomUUID()}.ddf`);
    const ansiDdfPath = path.join(workDirectory, `${randomUUID()}.ansi.ddf`);
    await fs.writeFile(ddfPath, directives.join('\r\n'), 'utf8');

    const conversionScript = [
      '$ErrorActionPreference = "Stop"',
      '$encoding = [System.Text.Encoding]::GetEncoding([System.Globalization.CultureInfo]::CurrentCulture.TextInfo.ANSICodePage, [System.Text.EncoderExceptionFallback]::new(), [System.Text.DecoderExceptionFallback]::new())',
      '$text = [System.IO.File]::ReadAllText($env:FCP_DDF_SOURCE, [System.Text.Encoding]::UTF8)',
      '[System.IO.File]::WriteAllText($env:FCP_DDF_TARGET, $text, $encoding)',
    ].join('; ');
    const encodedConversionScript = Buffer.from(conversionScript, 'utf16le').toString('base64');
    await runSystemCommand('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedConversionScript], workDirectory, {
      ...process.env,
      FCP_DDF_SOURCE: ddfPath,
      FCP_DDF_TARGET: ansiDdfPath,
    });
    await runSystemCommand('makecab.exe', ['/F', path.basename(ansiDdfPath)], workDirectory);
  };

  const workDirectory = await fs.mkdtemp(path.join(app.getPath('temp'), 'fcp-folder-archive-'));
  const results = [];
  try {
    for (const requestedFolderPath of requestedFolderPaths) {
      const folderPath = path.resolve(String(requestedFolderPath || ''));
      let archivePath;
      try {
        if (!requestedFolderPath || folderPath === path.parse(folderPath).root) {
          throw new Error('The selected folder path is invalid.');
        }
        const folderStat = await fs.lstat(folderPath);
        if (!folderStat.isDirectory() || folderStat.isSymbolicLink()) {
          throw new Error('The selected path is not a regular folder.');
        }

        const folderName = path.basename(folderPath).replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').replace(/[. ]+$/g, '') || 'folder';
        const temporaryArchivePath = path.join(workDirectory, `${randomUUID()}${format.extension}`);
        const sourceArgument = `.${path.sep}${path.basename(folderPath)}`;

        if (format.type === 'cab') {
          await createCabArchive(folderPath, temporaryArchivePath, workDirectory);
        } else if (format.tar) {
          const tarPath = path.join(workDirectory, `${randomUUID()}.tar`);
          await runSevenZip(['a', '-y', '-bso0', '-bsp0', '-ttar', tarPath, sourceArgument], path.dirname(folderPath));
          if (format.type === 'lzma') {
            await pipeline(
              createReadStream(tarPath),
              lzma.createStream('aloneEncoder', { preset: 6 }),
              createWriteStream(temporaryArchivePath)
            );
          } else {
            await runSevenZip(['a', '-y', '-bso0', '-bsp0', `-t${format.type}`, temporaryArchivePath, path.basename(tarPath)], workDirectory);
          }
          await fs.rm(tarPath, { force: true });
        } else {
          await runSevenZip(['a', '-y', '-bso0', '-bsp0', `-t${format.type}`, temporaryArchivePath, sourceArgument], path.dirname(folderPath));
        }

        await fs.mkdir(outputDirectory, { recursive: true });
        for (let suffix = 0; ; suffix += 1) {
          const fileName = `${folderName}${suffix ? ` (${suffix})` : ''}${format.extension}`;
          const candidatePath = path.join(outputDirectory, fileName);
          try {
            await fs.copyFile(temporaryArchivePath, candidatePath, fsConstants.COPYFILE_EXCL);
            archivePath = candidatePath;
            break;
          } catch (error) {
            if (error.code !== 'EEXIST') throw error;
          }
        }
        results.push({ folderPath, outputPath: archivePath });
      } catch (error) {
        results.push({ folderPath, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return results;
  } finally {
    await fs.rm(workDirectory, { recursive: true, force: true });
  }
});
ipcMain.handle('fcp:extract-archive', async (_event, requestedPath, requestedOutputDirectory, requestedFileName, requestedPassword) => {
  const cancellationGeneration = conversionCancellationGeneration;
  const password = typeof requestedPassword === 'string' ? requestedPassword : '';
  const passwordRequiredResult = (invalidPassword = false) => ({ passwordRequired: true, invalidPassword });
  const isArchivePasswordError = error => /wrong password|password.*incorrect|data error in encrypted file|cannot open encrypted archive|can not open encrypted archive|encrypted archive|break signaled/i.test(
    `${error?.message || error}\n${error?.stderr || ''}`
  );
  const stagingDirectory = path.resolve(app.getPath('temp'), 'fcp-staging');
  const sourcePath = path.resolve(String(requestedPath || ''));
  if (path.dirname(sourcePath) !== stagingDirectory) throw new Error('Invalid staged archive path.');

  let outputDirectory = String(requestedOutputDirectory || '').trim();
  if (!outputDirectory) {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths[0]) throw new Error('Archive extraction was cancelled.');
    outputDirectory = result.filePaths[0];
  }
  outputDirectory = path.resolve(outputDirectory);
  await fs.mkdir(outputDirectory, { recursive: true });

  const runSevenZip = (args) => new Promise((resolve, reject) => {
    assertConversionNotCancelled(cancellationGeneration);
    const processArgs = password ? [...args, `-p${password}`] : args;
    const childProcess = spawn(sevenZipPath, processArgs, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    activeConversionProcesses.add(childProcess);
    let stdout = '';
    let stderr = '';
    let stdoutExceededLimit = false;
    childProcess.stdout.on('data', chunk => {
      if (stdout.length + chunk.length > 4 * 1024 * 1024) stdoutExceededLimit = true;
      else stdout += chunk.toString();
    });
    childProcess.stderr.on('data', chunk => { if (stderr.length < 1024 * 1024) stderr += chunk.toString(); });
    childProcess.on('error', error => {
      activeConversionProcesses.delete(childProcess);
      reject(error);
    });
    childProcess.on('close', code => {
      activeConversionProcesses.delete(childProcess);
      if (cancelledConversionProcesses.has(childProcess)) {
        const error = new Error('Archive extraction was cancelled by the user.');
        error.exitCode = code;
        error.stderr = stderr.trim();
        return reject(error);
      }
      if (code !== 0) {
        const error = new Error(`7-Zip failed with code ${code}: ${(stderr || stdout).trim().slice(-800)}`);
        error.exitCode = code;
        error.stderr = stderr.trim();
        error.code = code;
        return reject(error);
      }
      if (stdoutExceededLimit) return reject(new Error('Archive listing exceeds the 4 MB safety limit.'));
      resolve(stdout);
    });
  });

  const validateArchive = async archivePath => {
    const listing = await runSevenZip(['l', '-slt', '-sccUTF-8', archivePath]);
    const entrySection = String(listing).split(/^-{10,}\r?$/m).slice(1).join('\n');
    const listingRecords = entrySection.split(/\r?\n\r?\n/);
    let entryCount = 0;
    let expandedBytes = 0;
    let hasEncryptedEntries = false;
    for (const record of listingRecords) {
      const entryPath = record.match(/^Path = (.*)$/m)?.[1];
      if (!entryPath) continue;
      entryCount += 1;
      if (/^Encrypted = \+$/m.test(record)) hasEncryptedEntries = true;
      const normalizedEntryPath = entryPath.replace(/\\/g, '/');
      const normalizedPath = path.posix.normalize(normalizedEntryPath);
      if (normalizedPath === '..' || normalizedPath.startsWith('../') || normalizedPath.startsWith('/') || /^[a-z]:/i.test(normalizedPath)) {
        throw new Error(`Unsafe archive path rejected: ${entryPath}`);
      }
      if (/^(?:Symbolic Link|Hard Link) = /m.test(record)) throw new Error(`Archive links are not supported: ${entryPath}`);
      const entrySize = Number(record.match(/^Size = (\d+)$/m)?.[1] || 0);
      expandedBytes += entrySize;
      if (entryCount > 50000) throw new Error('Archive contains more than 50,000 entries.');
      if (expandedBytes > 100 * 1024 ** 3) throw new Error('Archive expands to more than 100 GB.');
    }
    return hasEncryptedEntries;
  };
  let hasEncryptedEntries;
  try {
    hasEncryptedEntries = await validateArchive(sourcePath);
  } catch (error) {
    if (isArchivePasswordError(error)) return passwordRequiredResult(Boolean(password));
    throw error;
  }
  if (hasEncryptedEntries && !password) return passwordRequiredResult();

  const archiveFileName = path.basename(String(requestedFileName || sourcePath));
  const archiveBaseName = archiveFileName.replace(/\.(?:tar\.(?:gz|bz2|xz|lzma)|tgz|tbz|tbz2|txz)$/i, '').replace(/\.[^.]+$/, '')
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
    .replace(/[. ]+$/g, '') || 'extracted-files';
  let extractionPath = path.join(outputDirectory, archiveBaseName);
  for (let suffix = 1; await fs.stat(extractionPath).then(() => true, () => false); suffix += 1) {
    extractionPath = path.join(outputDirectory, `${archiveBaseName} (${suffix})`);
  }
  await fs.mkdir(extractionPath, { recursive: false });

  const containsTarLayer = /\.(?:tar\.(?:gz|bz2|xz|lzma)|tgz|tbz|tbz2|txz)$/i.test(archiveFileName);
  const intermediateDirectory = path.join(app.getPath('temp'), 'fcp-archive-nested', randomUUID());
  try {
    assertConversionNotCancelled(cancellationGeneration);
    if (containsTarLayer) {
      await fs.mkdir(intermediateDirectory, { recursive: true });
      await runSevenZip(['x', '-y', '-bso0', '-bsp0', `-o${intermediateDirectory}`, sourcePath]);
      const innerArchives = (await fs.readdir(intermediateDirectory)).filter(name => name.toLowerCase().endsWith('.tar'));
      if (innerArchives.length !== 1) throw new Error('Could not locate the TAR contents inside this compressed archive.');
      const innerArchivePath = path.join(intermediateDirectory, innerArchives[0]);
      await validateArchive(innerArchivePath);
      await runSevenZip(['x', '-y', '-bso0', '-bsp0', `-o${extractionPath}`, innerArchivePath]);
    } else {
      await runSevenZip(['x', '-y', '-bso0', '-bsp0', `-o${extractionPath}`, sourcePath]);
    }
    return extractionPath;
  } catch (error) {
    await fs.rm(extractionPath, { recursive: true, force: true });
    if (isArchivePasswordError(error)) return passwordRequiredResult(Boolean(password));
    throw error;
  } finally {
    await fs.rm(intermediateDirectory, { recursive: true, force: true });
  }
});
ipcMain.handle('fcp:delete-source-file', async (_event, filePath) => {
  const sourcePath = path.resolve(String(filePath));
  if (!sourcePath || sourcePath === path.parse(sourcePath).root) throw new Error('Refusing to delete an invalid source path.');
  await fs.rm(sourcePath, { force: false });
  return true;
});
ipcMain.handle('fcp:disable-wallpaper', async () => {
  const current = await readWallpaperConfig();
  await writeWallpaperConfig(false, current.path || '');
  return { enabled: false, path: current.path, type: null, dataUrl: null, videoUrl: null };
});
ipcMain.handle('fcp:convert-media', async (event, fileData, fileName, targetFormat) => {
  const cancellationGeneration = conversionCancellationGeneration;
  const workDir = path.join(app.getPath('temp'), 'fcp', randomUUID());
  const extension = path.extname(fileName) || '.bin';
  const inputPath = typeof fileData === 'string' ? fileData : path.join(workDir, `input${extension}`);
  const outputPath = path.join(workDir, `output.${String(targetFormat).toLowerCase()}`);

  await fs.mkdir(workDir, { recursive: true });
  if (typeof fileData !== 'string') {
    await fs.writeFile(inputPath, Buffer.from(fileData));
  }

  try {
    const args = ['-y', '-i', inputPath];
    const targetFormatUpper = String(targetFormat).toUpperCase();
    const isVideoOutput = ['MP4', 'WEBM', 'WMV', 'MKV'].includes(targetFormatUpper);
    const isAudioOutput = ['MP3', 'WAV', 'FLAC', 'OGG'].includes(targetFormatUpper);
    const canUseGpuEncoder = gpuInfo.hasDedicatedGpu && isVideoOutput && ['MP4', 'MKV'].includes(targetFormatUpper) && gpuInfo.encoder;

    const buildArgs = (useGpu = true) => {
      const finalArgs = [...args];

      if (useGpu && canUseGpuEncoder) {
        finalArgs.push('-c:v', gpuInfo.encoder);
        finalArgs.push('-preset', gpuInfo.vendor === 'nvidia' ? 'p4' : 'medium');
        finalArgs.push('-pix_fmt', 'yuv420p');
        finalArgs.push('-movflags', '+faststart');
      }

      if (targetFormatUpper === 'HEIC') {
        finalArgs.push('-c:v', 'libx265', '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p', '-f', 'mp4', '-brand', 'heic');
      }

      if (isAudioOutput) {
        finalArgs.push('-map', '0:a:0', '-vn', '-map_metadata', '-1', '-map_chapters', '-1');
      }

      finalArgs.push('-progress', 'pipe:2', '-nostats');
      finalArgs.push(outputPath);
      return finalArgs;
    };

    const runFfmpeg = async (ffmpegArgs, useGpu = true) => {
      assertConversionNotCancelled(cancellationGeneration);
      await new Promise((resolve, reject) => {
        const childProcess = spawn(nativeFfmpegPath, ffmpegArgs, { windowsHide: true });
        activeConversionProcesses.add(childProcess);
        let errorOutput = '';
        let lastOutputAt = Date.now();
        let durationSeconds = 0;
        const startedAt = Date.now();

        const timeoutId = setInterval(() => {
          if (Date.now() - lastOutputAt > 60000) {
            if (!childProcess.killed) childProcess.kill('SIGKILL');
            clearInterval(timeoutId);
            const error = new Error(useGpu ? 'Conversion stalled for over 60 seconds, switching to software encoding.' : 'Conversion stalled for over 60 seconds and was cancelled.');
            error.stderr = errorOutput.trim();
            reject(error);
          }
        }, 2000);

        childProcess.stderr.on('data', data => {
          const text = data.toString();
          errorOutput += text;
          lastOutputAt = Date.now();
          const durationMatch = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
          if (durationMatch) {
            durationSeconds = Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]);
          }
          const timeMatch = text.match(/out_time_ms=(\d+)/);
          if (timeMatch && durationSeconds > 0) {
            const currentSeconds = Number(timeMatch[1]) / 1000000;
            const progress = Math.min(100, Math.max(0, Math.round((currentSeconds / durationSeconds) * 100)));
            const elapsedSeconds = (Date.now() - startedAt) / 1000;
            const etaSeconds = progress > 0 ? Math.max(0, Math.round((elapsedSeconds / (progress / 100)) - elapsedSeconds)) : null;
            event.sender.send('fcp:media-progress', { fileName, progress, etaSeconds });
          }
        });
        childProcess.on('error', error => {
          clearInterval(timeoutId);
          activeConversionProcesses.delete(childProcess);
          reject(error);
        });
        childProcess.on('close', code => {
          clearInterval(timeoutId);
          activeConversionProcesses.delete(childProcess);
          if (cancelledConversionProcesses.has(childProcess)) return reject(new Error('Conversion cancelled by the user.'));
          if (code === 0) resolve();
          else {
            const error = new Error(summarizeFfmpegError(errorOutput) || `FFmpeg exited with code ${code}`);
            error.exitCode = code;
            error.stderr = errorOutput.trim();
            reject(error);
          }
        });
      });
    };

    try {
      await runFfmpeg(buildArgs(true), true);
    } catch (error) {
      assertConversionNotCancelled(cancellationGeneration);
      const message = String(error || '');
      if (canUseGpuEncoder && /stalled for over 60 seconds|SIGKILL|timed out/i.test(message)) {
        await runFfmpeg(buildArgs(false), false);
      } else {
        throw error;
      }
    }

    assertConversionNotCancelled(cancellationGeneration);
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
});
ipcMain.handle('fcp:read-file', (_event, filePath) => fs.readFile(filePath));
ipcMain.handle('fcp:write-file', async (_event, filePath, data) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, Buffer.from(data));
  return true;
});
ipcMain.handle('fcp:save-file', async (_event, options) => {
  const saveOptions = options || {};
  const data = saveOptions.data;
  const fileName = path.basename(String(saveOptions.fileName || saveOptions.defaultPath || 'download'));
  let filePath;

  if (saveOptions.outputDirectory) {
    filePath = path.join(saveOptions.outputDirectory, fileName);
  } else {
    const dialogOptions = { ...saveOptions, defaultPath: fileName };
    delete dialogOptions.data;
    delete dialogOptions.filePath;
    delete dialogOptions.outputDirectory;
    const result = await dialog.showSaveDialog(dialogOptions);
    if (result.canceled) return null;
    filePath = result.filePath;
  }

  if (saveOptions.filePath) {
    const sourcePath = resolveTempZipPath(saveOptions.filePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.copyFile(sourcePath, filePath);
  } else if (data !== undefined) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.from(data));
  }

  return filePath;
});

function loadDevelopmentPage(window, attempt = 0) {
  window.loadURL(developmentUrl).catch(() => {
    if (attempt < 50) {
      setTimeout(() => loadDevelopmentPage(window, attempt + 1), 200);
    }
  });
}

app.whenReady().then(async () => {
  await loadCrashLogLanguage();
  registerWallpaperProtocol();
  await fs.rm(path.join(app.getPath('temp'), 'fcp-staging'), { recursive: true, force: true });
  const splash = createSplashWindow();
  const window = createWindow();
  window.splashWindow = splash;

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function detectGpu() {
  if (process.platform !== 'win32') {
    return { hasDedicatedGpu: true, vendor: 'unknown', name: 'system GPU', encoder: null };
  }

  const result = spawnSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress"
  ], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
  const rawNames = result.status === 0 ? result.stdout.trim() : '';
  let names;
  try {
    names = rawNames ? JSON.parse(rawNames) : [];
  } catch {
    names = [];
  }
  if (!Array.isArray(names)) names = [names];

  const gpuNames = names.filter(Boolean).map(String);
  const dedicated = gpuNames.find(name =>
    /NVIDIA|GeForce|RTX|GTX|Quadro|Tesla|Radeon RX|Radeon Pro|Arc|Intel.*Arc|Intel.*UHD|Intel.*Iris/i.test(name)
  );

  const encoder = dedicated && /NVIDIA|GeForce|RTX|GTX|Quadro|Tesla/i.test(dedicated)
    ? 'h264_nvenc'
    : dedicated && /AMD|Radeon/i.test(dedicated)
      ? 'h264_amf'
      : dedicated && /Intel|Arc/i.test(dedicated)
        ? 'h264_qsv'
        : null;

  const vendor = dedicated && /NVIDIA|GeForce|RTX|GTX|Quadro|Tesla/i.test(dedicated)
    ? 'nvidia'
    : dedicated && /AMD|Radeon/i.test(dedicated)
      ? 'amd'
      : dedicated && /Intel|Arc/i.test(dedicated)
        ? 'intel'
        : 'integrated';

  return {
    hasDedicatedGpu: Boolean(dedicated),
    vendor,
    name: dedicated || gpuNames[0] || 'unknown',
    encoder
  };
}