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

  // 检查请求路径是否为 /api/upload
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const lastSegment = pathSegments[pathSegments.length - 1];
  
  if (lastSegment !== "upload") {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

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
    apiEndpoint = "sendPhoto";
    fileParamName = "photo";
  } else if (mimeType.includes('animation') || file.name.endsWith('.gif')) {
    apiEndpoint = "sendAnimation";
    fileParamName = "animation";
  } else {
    apiEndpoint = "sendDocument";
    fileParamName = "document";
  }

  telegramFormData.append(fileParamName, file);

  // Define Telegram file size limits (in bytes)
  const TELEGRAM_LIMIT_DOCUMENT = 50 * 1024 * 1024; // 50 MB
  const TELEGRAM_LIMIT_PHOTO = 10 * 1024 * 1024; // 10 MB
  const TELEGRAM_LIMIT_VIDEO_AUDIO_ANIMATION = 50 * 1024 * 1024; // 50 MB (Standard API)
  // Note: Video can be up to 2GB with local Bot API server, but we assume standard limits here.

  // Check file size before attempting upload
  let fileSizeLimit = TELEGRAM_LIMIT_DOCUMENT; // Default for documents
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

    // 提取文件信息，根据不同的API响应结构获取文件信息
    let fileId, fileName, fileSize, fileMimeType, fileUniqueId;
    if (apiEndpoint === "sendVideo") {
      fileId = telegramData.result.video.file_id;
      fileName = telegramData.result.video.file_name || file.name;
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
      fileId = telegramData.result.photo[telegramData.result.photo.length - 1].file_id;
      fileName = file.name;
      fileSize = telegramData.result.photo[telegramData.result.photo.length - 1].file_size;
      fileMimeType = mimeType;
      fileUniqueId = telegramData.result.photo[telegramData.result.photo.length - 1].file_unique_id;
    } else if (apiEndpoint === "sendAnimation") {
      fileId = telegramData.result.animation.file_id;
      fileName = telegramData.result.animation.file_name || file.name;
      fileSize = telegramData.result.animation.file_size;
      fileMimeType = telegramData.result.animation.mime_type;
      fileUniqueId = telegramData.result.animation.file_unique_id;
    } else {
      fileId = telegramData.result.document.file_id;
      fileName = telegramData.result.document.file_name;
      fileSize = telegramData.result.document.file_size;
      fileMimeType = telegramData.result.document.mime_type;
      fileUniqueId = telegramData.result.document.file_unique_id;
    }

    // 存储文件元数据到 KV
    const metadata = {
      fileId,
      fileName,
      fileSize,
      mimeType: fileMimeType,
      uploadDate: new Date().toISOString(),
      clientIP,
      fileType: apiEndpoint.replace('send', '').toLowerCase()
    };
    await env.FILE_STORE.put(fileUniqueId, JSON.stringify(metadata));

    // 生成随机字符串
    const generateRandomString = (length) => {
      const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      return result;
    };

    // 提取文件扩展名的函数
    const getFileExtension = (filename) => {
      if (!filename) return '';
      const ext = filename.split('.').pop().toLowerCase();
      // 确保exe扩展名被正确处理
      console.log(`File extension extracted: ${ext}`);
      return ext;
    };

    // 生成 URL，使用随机值作为唯一标识，并包含文件扩展名
    const randomValue = generateRandomString(12); // 生成12位随机字符串
    const fileExtension = getFileExtension(fileName);
    const userConfig = env.USER_CONFIG ? JSON.parse(env.USER_CONFIG) : {};
    
    // 修改URL格式为 https://www.example.com/file/随机十二位字母数字.文件后缀
    // 使用host中的域名替代example.com
    const host = request.headers.get("host");
    const urlPrefix = userConfig.urlPrefix || `https://${host}/file/`;
    
    // 确保所有文件扩展名（包括exe）都被正确处理
    const fileUrl = `${urlPrefix}${randomValue}${fileExtension ? '.' + fileExtension : ''}`;
    
    // 在KV存储中添加随机值到fileUniqueId的映射，以便[id].js可以查找
    await env.FILE_STORE.put(`map_${randomValue}`, fileUniqueId);
    
    console.log(`Generated URL: ${fileUrl}`);

    // 返回完整的响应信息
    return new Response(
      JSON.stringify({
        success: true,
        url: fileUrl,
        fileName,
        fileSize,
        mimeType: fileMimeType,
        fileType: apiEndpoint.replace('send', '').toLowerCase(),
        fileUniqueId
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    // Log the detailed error
    console.error("Error uploading file to Telegram or processing response:", error);
    
    // Try to get a more specific error message
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
