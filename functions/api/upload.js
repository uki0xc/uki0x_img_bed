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

    // 修改后的随机字符串生成函数 - 生成12位随机字符
    const generateRandomString = (length) => {
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      return result;
    };

    // 获取文件后缀
    const getFileExtension = (filename) => {
      return filename.includes('.') ? '.' + filename.split('.').pop().toLowerCase() : '';
    };

    // 生成12位随机字符串加文件后缀
    const randomValue = generateRandomString(12) + getFileExtension(fileName);
    
    // 修改URL构建方式，确保正确的路径格式
    const userConfig = env.USER_CONFIG ? JSON.parse(env.USER_CONFIG) : {};
    const urlPrefix = userConfig.urlPrefix || `https://${request.headers.get("host")}/file/`;
    // 使用fileUniqueId作为标识符，但在URL中只显示随机名称
    const fileUrl = `${urlPrefix}${randomValue}`;
    
    // 将fileUniqueId和randomValue的映射关系存储到KV中，以便后续查找
    await env.FILE_STORE.put(randomValue, fileUniqueId);

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
    return new Response(
      JSON.stringify({ error: error.message || "Failed to upload file" }),
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
