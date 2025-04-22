/**
 * 生成指定长度的随机 ID
 */
export function getRandomId(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 获取文件类型图标
 */
export function getFileIcon(filename) {
  if (!filename) return '📄';
  
  const ext = filename.split('.').pop().toLowerCase();
  
  const iconMap = {
    // 图片文件
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'png': '🖼️',
    'gif': '🖼️',
    'webp': '🖼️',
    'svg': '🖼️',
    'bmp': '🖼️',
    'tiff': '🖼️',
    'tif': '🖼️',
    'ico': '🖼️',
    'heic': '🖼️',
    'heif': '🖼️',
    'avif': '🖼️',
    
    // 视频文件
    'mp4': '🎬',
    'avi': '🎬',
    'mov': '🎬',
    'wmv': '🎬',
    'flv': '🎬',
    'mkv': '🎬',
    'webm': '🎬',
    'm4v': '🎬',
    '3gp': '🎬',
    'mpeg': '🎬',
    'mpg': '🎬',
    'ts': '🎬',
    
    // 音频文件
    'mp3': '🎵',
    'wav': '🎵',
    'ogg': '🎵',
    'flac': '🎵',
    'aac': '🎵',
    'm4a': '🎵',
    'wma': '🎵',
    'opus': '🎵',
    'mid': '🎵',
    'midi': '🎵',
    
    // 文档文件
    'pdf': '📄',
    'doc': '📝',
    'docx': '📝',
    'xls': '📊',
    'xlsx': '📊',
    'ppt': '📊',
    'pptx': '📊',
    'txt': '📝',
    'rtf': '📝',
    'md': '📝',
    'csv': '📊',
    'json': '📋',
    'xml': '📋',
    'html': '🌐',
    'htm': '🌐',
    'css': '🌐',
    'js': '📜',
    
    // 压缩文件
    'zip': '🗜️',
    'rar': '🗜️',
    '7z': '🗜️',
    'tar': '🗜️',
    'gz': '🗜️',
    'bz2': '🗜️',
    'xz': '🗜️',
    
    // 可执行文件
    'exe': '⚙️',
    'msi': '⚙️',
    'apk': '📱',
    'app': '📱',
    'dmg': '💿',
    'iso': '💿',
    
    // 字体文件
    'ttf': '🔤',
    'otf': '🔤',
    'woff': '🔤',
    'woff2': '🔤',
    'eot': '🔤',
    
    // 3D和设计文件
    'obj': '🎮',
    'fbx': '🎮',
    'blend': '🎮',
    'stl': '🎮',
    'psd': '🎨',
    'ai': '🎨',
    'eps': '🎨',
    'sketch': '🎨',
    'fig': '🎨',
    
    // 其他常见文件
    'torrent': '🔗',
    'srt': '🗣️',
    'vtt': '🗣️',
    'ass': '🗣️',
    'ssa': '🗣️'
  };
  
  return iconMap[ext] || '📄';
}

/**
 * 根据MIME类型获取文件类型图标
 */
export function getFileIconByMimeType(mimeType) {
  if (!mimeType) return '📄';
  
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('msword') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('sheet')) return '📊';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📊';
  if (mimeType.includes('text/')) return '📝';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '🗜️';
  if (mimeType.includes('html')) return '🌐';
  
  return '📄';
}

/**
 * 格式化日期
 */
export function formatDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) return '';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 获取文件类型分类
 */
export function getFileCategory(mimeType, fileName) {
  if (!mimeType && !fileName) return 'other';
  
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf')) return 'document';
    if (mimeType.includes('msword') || mimeType.includes('document')) return 'document';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'document';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'document';
    if (mimeType.includes('text/')) return 'document';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'archive';
    if (mimeType.includes('html')) return 'web';
  }
  
  if (fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    
    // 图片文件
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif', 'ico', 'heic', 'heif', 'avif'].includes(ext)) {
      return 'image';
    }
    
    // 视频文件
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v', '3gp', 'mpeg', 'mpg', 'ts'].includes(ext)) {
      return 'video';
    }
    
    // 音频文件
    if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus', 'mid', 'midi'].includes(ext)) {
      return 'audio';
    }
    
    // 文档文件
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'md', 'csv', 'json', 'xml'].includes(ext)) {
      return 'document';
    }
    
    // 压缩文件
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
      return 'archive';
    }
    
    // 可执行文件
    if (['exe', 'msi', 'apk', 'app', 'dmg', 'iso'].includes(ext)) {
      return 'executable';
    }
    
    // 网页文件
    if (['html', 'htm', 'css', 'js'].includes(ext)) {
      return 'web';
    }
  }
  
  return 'other';
}
