export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  
  // 将request对象添加到env中，以便在其他函数中使用
  env.REQUEST = request;
  
  if (method === 'GET') {
    return handleGet(request, env);
  } else if (method === 'DELETE') {
    return handleDelete(request, env);
  } else if (method === 'POST' && new URL(request.url).searchParams.has('auth')) {
    // 认证检查请求
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('Method not allowed', { status: 405 });
}

// 处理 GET 请求 - 列出文件
async function handleGet(request, env) {
  try {
    const url = new URL(request.url);
    
    // 认证检查
    if (url.searchParams.has('auth_check')) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 登出处理
    if (url.searchParams.has('logout')) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 获取目录参数
    const directory = url.searchParams.get('directory') || '';
    
    // 列出文件
    const files = await listFiles(env, directory);
    
    // 添加调试信息
    console.log('Files returned:', JSON.stringify(files));
    
    return new Response(JSON.stringify({
      success: true,
      files: files
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('获取文件列表错误:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// 处理 DELETE 请求 - 删除文件或目录
async function handleDelete(request, env) {
  try {
    const data = await request.json();
    
    // 删除文件
    if (data.fileId) {
      await deleteFile(env, data.fileId);
    } 
    // 批量删除文件
    else if (data.fileIds && Array.isArray(data.fileIds)) {
      for (const fileId of data.fileIds) {
        await deleteFile(env, fileId);
      }
    }
    // 删除目录
    else if (data.directory) {
      await deleteDirectory(env, data.directory);
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: '缺少必要参数'
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    return new Response(JSON.stringify({
      success: true
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('删除文件错误:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// 列出指定目录的文件和子目录
async function listFiles(env, directory) {
  try {
    const prefix = directory ? `${directory}/` : '';
    const list = await env.FILE_STORE.list({ prefix });
    const dirPrefix = 'dir:';
    
    console.log('KV list keys:', JSON.stringify(list.keys.map(k => k.name)));
    
    const files = [];
    const dirSet = new Set();
    
    // 处理文件
    for (const key of list.keys) {
      const keyName = key.name;
      
      // 跳过目录记录
      if (keyName.startsWith(dirPrefix)) {
        continue;
      }
      
      const value = await env.FILE_STORE.get(keyName);
      console.log(`Key: ${keyName}, Value: ${value}`);
      
      if (value) {
        try {
          const fileData = JSON.parse(value);
          console.log(`Parsed fileData: ${JSON.stringify(fileData)}`);
          
          // 如果文件在当前目录
          if (!directory || keyName.startsWith(prefix)) {
            // 只显示直接子文件，跳过子目录下的文件
            const relativePath = keyName.slice(prefix.length);
            
            if (!relativePath.includes('/')) {
              // 构建文件URL
              const userConfig = env.USER_CONFIG ? JSON.parse(env.USER_CONFIG) : {};
              // 使用env中存储的request对象获取host
              const host = env.REQUEST ? env.REQUEST.headers.get("host") : 'localhost';
              const urlPrefix = userConfig.urlPrefix || `https://${host}/file/`;
              
              // 确保fileUniqueId存在，如果不存在则使用keyName
              const fileUniqueId = fileData.fileUniqueId || keyName;
              
              // 构建URL，确保包含随机值以避免重复
              let fileUrl = fileData.url;
              if (!fileUrl) {
                // 从upload.js中复制URL生成逻辑
                const randomValue = generateRandomString(6);
                fileUrl = `${urlPrefix}${fileUniqueId}_${randomValue}`;
              }
              
              // 获取文件类型图标
              const fileType = getFileTypeIcon(fileData.mimeType || '');
              
              // 格式化文件大小
              const formattedSize = formatFileSize(fileData.size || fileData.fileSize || 0);
              
              // 格式化上传时间
              const uploadTime = fileData.uploadTime || fileData.uploadDate || new Date().toISOString();
              const formattedDate = formatDate(uploadTime);
              
              // 获取图片的额外信息
              let imageInfo = {};
              if (fileData.mimeType && fileData.mimeType.startsWith('image/')) {
                imageInfo = {
                  width: fileData.width || fileData.imageWidth || 'unknown',
                  height: fileData.height || fileData.imageHeight || 'unknown',
                  format: fileData.format || fileData.imageFormat || getImageFormatFromMimeType(fileData.mimeType),
                  isImage: true
                };
              }
              
              // 映射字段名，兼容新旧数据格式，并添加dashboard.html需要的字段
              files.push({
                id: fileData.id || fileData.fileUniqueId || keyName,
                name: fileData.name || fileData.fileName || '未命名文件',
                url: fileUrl,
                size: formattedSize,
                rawSize: fileData.size || fileData.fileSize || 0,
                uploadTime: formattedDate,
                rawUploadTime: uploadTime,
                uploadIP: fileData.clientIP || '未知',
                type: 'file',
                fileType: fileType,
                mimeType: fileData.mimeType || '',
                ...imageInfo
              });
            } else {
              // 对于子目录下的文件，记录目录名
              const dirName = relativePath.split('/')[0];
              dirSet.add(dirName);
            }
          }
        } catch (e) {
          console.error('解析文件数据错误:', e, 'Raw value:', value);
        }
      }
    }
    
    // 添加子目录
    for (const dirName of dirSet) {
      files.push({
        name: dirName,
        type: 'directory',
        fileType: 'folder',
        size: '-',
        uploadTime: '-',
        uploadIP: '-'
      });
    }
    
    // 获取目录列表
    const dirList = await env.FILE_STORE.list({ prefix: `${dirPrefix}${prefix}` });
    
    // 处理直接子目录
    for (const key of dirList.keys) {
      const keyName = key.name;
      
      // 只处理目录记录
      if (keyName.startsWith(dirPrefix)) {
        const dirPath = keyName.slice(dirPrefix.length);
        
        // 只显示直接子目录
        if (dirPath.startsWith(prefix)) {
          const relativePath = dirPath.slice(prefix.length);
          
          if (!relativePath.includes('/')) {
            const value = await env.FILE_STORE.get(keyName);
            if (value) {
              try {
                const dirData = JSON.parse(value);
                
                // 避免重复添加
                if (!Array.from(dirSet).includes(dirData.name)) {
                  files.push({
                    name: dirData.name,
                    type: 'directory',
                    fileType: 'folder',
                    size: '-',
                    uploadTime: '-',
                    uploadIP: '-'
                  });
                }
              } catch (e) {
                console.error('解析目录数据错误:', e);
              }
            }
          }
        }
      }
    }
    
    return files;
  } catch (error) {
    console.error('列出文件错误:', error);
    return []; // 返回空数组而不是抛出错误，避免前端崩溃
  }
}

// 删除文件
async function deleteFile(env, fileId) {
  // 查找文件记录
  const list = await env.FILE_STORE.list();
  
  for (const key of list.keys) {
    const value = await env.FILE_STORE.get(key.name);
    
    if (value) {
      try {
        const fileData = JSON.parse(value);
        
        if (fileData.id === fileId || fileData.fileUniqueId === fileId || key.name === fileId) {
          // 从 KV 存储中删除文件记录
          await env.FILE_STORE.delete(key.name);
          return;
        }
      } catch (e) {
        console.error('解析文件数据错误:', e);
      }
    }
  }
  
  throw new Error('未找到要删除的文件');
}

// 递归删除目录及其内容
async function deleteDirectory(env, directory) {
  const prefix = directory ? `${directory}/` : '';
  const list = await env.FILE_STORE.list({ prefix });
  
  // 删除目录下的所有文件
  for (const key of list.keys) {
    await env.FILE_STORE.delete(key.name);
  }
  
  // 删除目录记录
  await env.FILE_STORE.delete(`dir:${directory}`);
  
  // 查找并删除子目录记录
  const dirList = await env.FILE_STORE.list({ prefix: `dir:${prefix}` });
  for (const key of dirList.keys) {
    await env.FILE_STORE.delete(key.name);
  }
}

// 生成随机字符串的辅助函数
function generateRandomString(length) {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

// 格式化日期
function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return dateString;
  }
}

// 获取文件类型图标
function getFileTypeIcon(mimeType) {
  if (!mimeType) return 'fas fa-file';
  
  if (mimeType.startsWith('image/')) return 'far fa-image';
  if (mimeType.startsWith('video/')) return 'fas fa-film';
  if (mimeType.startsWith('audio/')) return 'fas fa-music';
  if (mimeType.includes('pdf')) return 'fas fa-file-pdf';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) 
    return 'fas fa-file-archive';
  if (mimeType.includes('word') || mimeType.includes('document')) 
    return 'fas fa-file-word';
  if (mimeType.includes('excel') || mimeType.includes('sheet')) 
    return 'fas fa-file-excel';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) 
    return 'fas fa-file-powerpoint';
  if (mimeType.includes('text/')) return 'fas fa-file-alt';
  
  return 'fas fa-file';
}

// 从MIME类型获取图片格式
function getImageFormatFromMimeType(mimeType) {
  if (!mimeType) return 'unknown';
  
  const formatMap = {
    'image/jpeg': 'JPEG',
    'image/jpg': 'JPEG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'image/webp': 'WebP',
    'image/svg+xml': 'SVG',
    'image/bmp': 'BMP',
    'image/tiff': 'TIFF'
  };
  
  return formatMap[mimeType] || mimeType.split('/')[1]?.toUpperCase() || 'unknown';
}
