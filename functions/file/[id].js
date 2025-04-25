import mime from 'mime';

export async function onRequest(context) {
  const { request, env, params } = context;
  
  // Get file ID from URL parameters and extract the actual fileUniqueId
  let fileId = params.id;
  
  if (!fileId) {
    return new Response(JSON.stringify({ error: "File ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  
  // 从URL中提取真正的fileUniqueId（格式：fileUniqueId_randomString.extension）
  // 提取第一个下划线之前的部分作为fileUniqueId
  const fileUniqueId = fileId.split('_')[0];
  
  if (!fileUniqueId) {
    return new Response(JSON.stringify({ error: "Invalid file ID format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Get file metadata from KV store
    const metadataStr = await env.FILE_STORE.get(fileUniqueId);
    
    if (!metadataStr) {
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    const metadata = JSON.parse(metadataStr);
    const { fileId, mimeType, fileName, fileType } = metadata;

    // Get file path from Telegram
    const TG_BOT_TOKEN = env.TG_BOT_TOKEN;
    const filePathResponse = await fetch(
      `https://api.telegram.org/bot${TG_BOT_TOKEN}/getFile?file_id=${fileId}`
    );
    
    const filePathData = await filePathResponse.json();
    
    if (!filePathData.ok || !filePathData.result.file_path) {
      return new Response(JSON.stringify({ error: "Failed to get file path from Telegram" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    const filePath = filePathData.result.file_path;
    
    // Fetch the file from Telegram
    const fileUrl = `https://api.telegram.org/file/bot${TG_BOT_TOKEN}/${filePath}`;
    const fileResponse = await fetch(fileUrl);
    
    if (!fileResponse.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch file from Telegram" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Determine content type
    const contentType = mimeType || mime.getType(fileName) || 'application/octet-stream';
    
    // 检查是否是预览请求
    const url = new URL(request.url);
    const isPreview = url.searchParams.has('preview');
    
    // 如果是预览请求且文件类型不是可直接预览的类型，则返回预览页面
    if (isPreview) {
      // 对于图片、视频和音频，直接返回文件内容
      if (contentType.startsWith('image/') || contentType.startsWith('video/') || contentType.startsWith('audio/')) {
        // 这些类型可以直接在浏览器中预览，所以直接返回文件内容
        const finalResponse = new Response(fileResponse.body, {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `inline; filename="${fileName}"`,
            "Cache-Control": "public, max-age=31536000",
          },
        });
        return finalResponse;
      } else {
        // 对于其他类型，返回一个预览页面
        const previewHtml = `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>文件预览 - ${fileName}</title>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
          <style>
            :root {
              --primary-color: #4361ee;
              --primary-hover: #3a56d4;
              --light-bg: #f8f9fa;
              --dark-text: #212529;
              --gray-text: #6c757d;
              --card-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            }
            
            body {
              background-color: var(--light-bg);
              color: var(--dark-text);
              line-height: 1.6;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            
            .preview-container {
              background-color: white;
              border-radius: 10px;
              box-shadow: var(--card-shadow);
              padding: 30px;
              max-width: 800px;
              width: 100%;
              text-align: center;
            }
            
            .file-icon {
              font-size: 5rem;
              color: var(--primary-color);
              margin-bottom: 20px;
            }
            
            .file-name {
              font-size: 1.5rem;
              font-weight: 600;
              margin-bottom: 10px;
              word-break: break-all;
            }
            
            .file-info {
              color: var(--gray-text);
              margin-bottom: 20px;
            }
            
            .download-btn {
              display: inline-block;
              background-color: var(--primary-color);
              color: white;
              padding: 12px 24px;
              border-radius: 6px;
              text-decoration: none;
              font-weight: 500;
              transition: background-color 0.3s;
              margin-top: 20px;
            }
            
            .download-btn:hover {
              background-color: var(--primary-hover);
            }
            
            .download-btn i {
              margin-right: 8px;
            }
          </style>
        </head>
        <body>
          <div class="preview-container">
            <div class="file-icon">
              <i class="${getFileIconClass(contentType)}"></i>
            </div>
            <h1 class="file-name">${fileName}</h1>
            <p class="file-info">
              类型: ${contentType}<br>
              大小: ${formatFileSize(metadata.fileSize || 0)}
            </p>
            <p>此文件类型无法在浏览器中直接预览。</p>
            <a href="${url.pathname}" class="download-btn" download>
              <i class="fas fa-download"></i> 下载文件
            </a>
          </div>
          
          <script>
            function getFileIconClass(mimeType) {
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
            
            function formatFileSize(bytes) {
              if (bytes === 0) return '0 字节';
              const k = 1024;
              const sizes = ['字节', 'KB', 'MB', 'GB'];
              const i = Math.floor(Math.log(bytes) / Math.log(k));
              return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            }
          </script>
        </body>
        </html>
        `;
        
        return new Response(previewHtml, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    }
    
    // 正常下载请求，返回文件内容
    const finalResponse = new Response(fileResponse.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "public, max-age=31536000",
      },
    });
    
    return finalResponse;
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Error fetching file" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// 辅助函数：获取文件图标类名
function getFileIconClass(mimeType) {
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

// 辅助函数：格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 字节';
  const k = 1024;
  const sizes = ['字节', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
