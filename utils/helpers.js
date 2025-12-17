const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration to human readable format
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Sanitize filename to be safe across all operating systems
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 255);
}

/**
 * Check if file exists and has content
 */
async function fileExistsAndValid(filePath) {
  try {
    if (!await fs.pathExists(filePath)) {
      return false;
    }
    const stats = await fs.stat(filePath);
    return stats.size > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Create directory if it doesn't exist
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.ensureDir(dirPath);
    return true;
  } catch (error) {
    console.error(chalk.red(`Failed to create directory: ${dirPath}`));
    return false;
  }
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType) {
  const mimeMap = {
    // Images
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/bmp': '.bmp',
    
    // Videos
    'video/mp4': '.mp4',
    'video/avi': '.avi',
    'video/mpeg': '.mpeg',
    'video/quicktime': '.mov',
    'video/x-msvideo': '.avi',
    'video/x-matroska': '.mkv',
    'video/webm': '.webm',
    
    // Audio
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'audio/webm': '.weba',
    'audio/aac': '.aac',
    'audio/flac': '.flac',
    
    // Documents
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'application/json': '.json',
    'application/xml': '.xml',
    'text/html': '.html',
    
    // Archives
    'application/zip': '.zip',
    'application/x-rar-compressed': '.rar',
    'application/x-7z-compressed': '.7z',
    'application/x-tar': '.tar',
    'application/gzip': '.gz',
    
    // Other
    'application/octet-stream': '.bin'
  };
  
  return mimeMap[mimeType] || '';
}

/**
 * Calculate download speed
 */
function calculateSpeed(bytes, seconds) {
  if (seconds === 0) return '0 B/s';
  const speed = bytes / seconds;
  return formatBytes(speed) + '/s';
}

/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(chalk.yellow(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms...`));
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Sleep/delay function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse date string to timestamp
 */
function parseDate(dateString) {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return null;
    }
    return Math.floor(date.getTime() / 1000);
  } catch (error) {
    return null;
  }
}

/**
 * Validate channel ID
 */
function isValidChannelId(channelId) {
  if (!channelId) return false;
  
  const numericId = typeof channelId === 'string' 
    ? channelId.replace(/[^0-9-]/g, '') 
    : channelId;
    
  return !isNaN(numericId) && numericId.toString().length > 0;
}

/**
 * Get media type from media object
 */
function getMediaType(media) {
  if (!media) return 'unknown';
  
  const className = media.className || media.constructor.name;
  
  if (className === 'MessageMediaPhoto') {
    return 'photo';
  } else if (className === 'MessageMediaDocument' && media.document) {
    const mimeType = media.document.mimeType || '';
    
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'photo';
    return 'document';
  }
  
  return 'unknown';
}

/**
 * Create a progress reporter
 */
function createProgressReporter() {
  let lastUpdate = Date.now();
  const updateInterval = 1000; // Update every second
  
  return {
    report: (current, total) => {
      const now = Date.now();
      if (now - lastUpdate >= updateInterval) {
        const percentage = total > 0 ? ((current / total) * 100).toFixed(1) : 0;
        process.stdout.write(`\rProgress: ${current}/${total} (${percentage}%)`);
        lastUpdate = now;
      }
    },
    finish: () => {
      process.stdout.write('\n');
    }
  };
}

/**
 * Load JSON file safely
 */
async function loadJSON(filePath, defaultValue = {}) {
  try {
    if (await fs.pathExists(filePath)) {
      return await fs.readJson(filePath);
    }
    return defaultValue;
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Could not load ${filePath}, using default value`));
    return defaultValue;
  }
}

/**
 * Save JSON file safely
 */
async function saveJSON(filePath, data, spaces = 2) {
  try {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeJson(filePath, data, { spaces });
    return true;
  } catch (error) {
    console.error(chalk.red(`Failed to save ${filePath}:`, error.message));
    return false;
  }
}

module.exports = {
  formatBytes,
  formatDuration,
  sanitizeFilename,
  fileExistsAndValid,
  ensureDirectory,
  getExtensionFromMimeType,
  calculateSpeed,
  retryWithBackoff,
  sleep,
  parseDate,
  isValidChannelId,
  getMediaType,
  createProgressReporter,
  loadJSON,
  saveJSON
};