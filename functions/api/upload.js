// functions/api/upload.js

// 注意：这个版本包含了生成动态 URL 和固定域名 URL 的修改
// 并且依赖于您在代码中定义的 generateRandomString 和 getFileExtension 辅助函数

export async function onRequest(context) {
  const { request, env } = context;

  // CORS headers
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // 检查请求路径是否为 /api/upload (可选，根据您的路由设置)
  const url = new URL(request.url);
  // 如果您确定此函数只处理 /api/upload，可以省略路径检查
  // const pathSegments = url.pathname.split('/');
  // const lastSegment = pathSegments[pathSegments.length - 1];
  // if (lastSegment !== "upload") { ... }

  // 检查是否为 POST 请求
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // 获取表单数据
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file) {
    return new Response(JSON.stringify({ error: "No file provided" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // 准备 Telegram API 设置
  const TG_BOT_TOKEN = env.TG_BOT_TOKEN;
  const TG_CHAT_ID = env.TG_CHAT_ID;

  if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
    return new Response(JSON.stringify({ error: "Missing Telegram configuration" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // 获取客户端IP地址
  const clientIP = request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') ||
    'unknown';

  // 根据文件类型选择合适的Telegram API
  const telegramFormData = new FormData();
  telegramFormData.append("chat_id", TG_CHAT_ID);
  let apiEndpoint = "sendDocument";
  let fileParamName = "document";

  // 检查文件类型
  const mimeType = file.type || '';
  if (mimeType.startsWith('video/')) {
    apiEndpoint = "sendVideo";
    fileParamName = "video";
  } else if (mimeType.startsWith('audio/')) {
    apiEndpoint = "sendAudio";
    fileParamName = "audio";
  } else if (mimeType.startsWith('image/')) {
    // 优先使用 sendPhoto 以获得更好的压缩和预览
    apiEndpoint = "sendPhoto";
    fileParamName = "photo";
  } else if (mimeType.includes('animation') || file.name.endsWith('.gif')) {
    apiEndpoint = "sendAnimation";
    fileParamName = "animation";
  } else {
    // 其他所有文件作为 document 发送
    apiEndpoint = "sendDocument";
    fileParamName = "document";
  }

  telegramFormData.append(fileParamName, file);

  // 定义 Telegram 文件大小限制 (字节)
  const TELEGRAM_LIMIT_DOCUMENT = 50 * 1024 * 1024; // 50 MB
  const TELEGRAM_LIMIT_PHOTO = 10 * 1024 * 1024; // 10 MB (单个文件限制)
  const TELEGRAM_LIMIT_VIDEO_AUDIO_ANIMATION = 50 * 1024 * 1024; // 50 MB (标准 API)

  // 检查文件大小限制
  let fileSizeLimit = TELEGRAM_LIMIT_DOCUMENT;
  if (apiEndpoint === "sendPhoto") {
    fileSizeLimit = TELEGRAM_LIMIT_PHOTO;
  } else if (["sendVideo", "sendAudio", "sendAnimation"].includes(apiEndpoint)) {
    fileSizeLimit = TELEGRAM_LIMIT_VIDEO_AUDIO_ANIMATION;
  }

  if (file.size > fileSizeLimit) {
    console.error(`File size ${file.size} exceeds the limit of ${fileSizeLimit} bytes for ${apiEndpoint}.`);
    return new Response(
        JSON.stringify({ error: `File size exceeds the limit (${Math.floor(fileSizeLimit / 1024 / 1024)}MB) for this file type.` }),
        {
            status: 413, // Payload Too Large
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        }
    );
  }

  try {
    // 上传到 Telegram
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TG_BOT_TOKEN}/${apiEndpoint}`,
      {
        method: "POST",
        body: telegramFormData,
      }
    );

    const telegramData = await telegramResponse.json();
    if (!telegramData.ok) {
      throw new Error(`Telegram API error: ${telegramData.description}`);
    }

    // 提取文件信息 (根据API响应结构)
    let fileId, fileName, fileSize, fileMimeType, fileUniqueId;
    if (apiEndpoint === "sendVideo") {
      fileId = telegramData.result.video.file_id;
      fileName = telegramData.result.video.file_name || file.name; // 优先使用TG返回的文件名
      fileSize = telegramData.result.video.file_size;
      fileMimeType = telegramData.result.video.mime_type;
      fileUniqueId = telegramData.result.video.file_unique_id;
    } else if (apiEndpoint === "sendAudio") {
      fileId = telegramData.result.audio.file_id;
      fileName = telegramData.result.audio.file_name || file.name;
      fileSize = telegramData.result.audio.file_size;
      fileMimeType = telegramData.result.audio.mime_type;
      fileUniqueId = telegramData.result.audio.file_unique_id;
    } else if (apiEndpoint === "sendPhoto") {
      // sendPhoto 返回一个照片尺寸数组，取最大的那个
      const largestPhoto = telegramData.result.photo[telegramData.result.photo.length - 1];
      fileId = largestPhoto.file_id;
      fileName = file.name; // sendPhoto 不返回文件名，使用原始文件名
      fileSize = largestPhoto.file_size; // 通常是压缩后的大小
      fileMimeType = mimeType; // 使用原始 MIME 类型
      fileUniqueId = largestPhoto.file_unique_id;
    } else if (apiEndpoint === "sendAnimation") {
      fileId = telegramData.result.animation.file_id;
      fileName = telegramData.result.animation.file_name || file.name;
      fileSize = telegramData.result.animation.file_size;
      fileMimeType = telegramData.result.animation.mime_type;
      fileUniqueId = telegramData.result.animation.file_unique_id;
    } else { // sendDocument
      fileId = telegramData.result.document.file_id;
      fileName = telegramData.result.document.file_name; // document 通常会保留原始文件名
      fileSize = telegramData.result.document.file_size;
      fileMimeType = telegramData.result.document.mime_type;
      fileUniqueId = telegramData.result.document.file_unique_id;
    }

    // 存储文件元数据到 KV
    const metadata = {
      fileId,
      fileName,
      fileSize, // TG返回的大小
      originalFileSize: file.size, // 保留原始大小信息（可选）
      mimeType: fileMimeType,
      uploadDate: new Date().toISOString(),
      clientIP,
      fileType: apiEndpoint.replace('send', '').toLowerCase() // 'photo', 'video', 'audio', 'document', 'animation'
    };
    // 使用 fileUniqueId 作为 KV 的 key，因为它在机器人和所有用户间唯一且稳定
    await env.FILE_STORE.put(fileUniqueId, JSON.stringify(metadata));

    // --- URL 生成部分 ---
    // 1. 生成随机字符串
    const randomValue = generateRandomString(12); // 12位随机字符串

    // 2. 提取文件扩展名
    const fileExtension = getFileExtension(fileName); // 使用辅助函数提取

    // 3. 计算动态 URL (基于 Host header 或 userConfig)
    const host = request.headers.get("host");
    console.log(`[Upload Debug] Received Host Header: ${host}`);
    const userConfig = env.USER_CONFIG ? JSON.parse(env.USER_CONFIG) : {};
    console.log(`[Upload Debug] userConfig.urlPrefix exists: ${!!userConfig.urlPrefix}`);
    // 使用 'dynamicUrlPrefix' 作为变量名以示区分
    const dynamicUrlPrefix = userConfig.urlPrefix || `https://${host}/file/`;
    console.log(`[Upload Debug] Calculated dynamicUrlPrefix: ${dynamicUrlPrefix}`);
    // 生成动态 URL
    const dynamicUrl = `${dynamicUrlPrefix}${randomValue}${fileExtension ? '.' + fileExtension : ''}`;
    console.log(`[Upload Debug] Generated dynamicUrl: ${dynamicUrl}`);

    // 4. 计算固定 URL (使用您指定的域名)
    const fixedDomain = "img.vki.im"; // <--- 在这里设置您想要使用的固定域名
    const fixedUrlPrefix = `https://${fixedDomain}/file/`;
    // 生成固定 URL
    const fixedDomainUrl = `${fixedUrlPrefix}${randomValue}${fileExtension ? '.' + fileExtension : ''}`;
    console.log(`[Upload Debug] Generated fixedDomainUrl: ${fixedDomainUrl}`);

    // --- 映射存储 ---
    // 在KV存储中添加随机值到fileUniqueId的映射，以便 /file/[id].js 可以查找
    // key: map_随机值, value: fileUniqueId
    await env.FILE_STORE.put(`map_${randomValue}`, fileUniqueId);

    // --- 返回响应 ---
    return new Response(
      JSON.stringify({
        success: true,
        url: dynamicUrl,              // 主要 URL (动态)
        fixedUrl: fixedDomainUrl,     // 固定域名的 URL
        fileName,
        fileSize,                     // TG 返回的文件大小
        mimeType: fileMimeType,
        fileType: apiEndpoint.replace('send', '').toLowerCase(),
        fileUniqueId                  // TG 的文件唯一 ID
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    // 改进错误日志
    console.error("[Upload Error] Failed to upload or process file:", error);

    // 尝试获取更具体的错误信息
    let errorMessage = "Failed to upload file";
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}


// --- 辅助函数 ---
// (确保这些函数在文件作用域内可用)

/**
 * 生成指定长度的随机字符串
 * @param {number} length - 字符串长度
 * @returns {string} 随机字符串
 */
function generateRandomString(length) {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

/**
 * 提取文件名中的扩展名（小写）
 * @param {string} filename - 文件名
 * @returns {string} 文件扩展名 (不含点), 或空字符串
 */
function getFileExtension(filename) {
  if (!filename || typeof filename !== 'string') return '';
  const lastDotIndex = filename.lastIndexOf('.');
  // 检查点号是否存在且不是文件名的第一个字符，并且后面确实有字符
  if (lastDotIndex > 0 && lastDotIndex < filename.length - 1) {
    return filename.substring(lastDotIndex + 1).toLowerCase();
  }
  return ''; // 没有有效扩展名
}
