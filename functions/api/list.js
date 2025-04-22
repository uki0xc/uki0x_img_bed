export async function onRequest(context) {
  const { request, env } = context;

  // CORS headers
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    // 获取文件列表
    const keys = await env.FILE_STORE.list();
    const files = [];

    for (const key of keys.keys) {
      const metadataStr = await env.FILE_STORE.get(key.name);

      if (metadataStr) {
        try {
          const metadata = JSON.parse(metadataStr);
          const userConfig = env.USER_CONFIG ? JSON.parse(env.USER_CONFIG) : {};
          const urlPrefix = userConfig.urlPrefix || `https://${request.headers.get("host")}/file/`;

          files.push({
            fileUniqueId: key.name,
            fileName: metadata.fileName || 'unknown',
            fileSize: metadata.fileSize || 0,
            mimeType: metadata.mimeType || '',
            uploadDate: metadata.uploadDate || new Date().toISOString(),
            clientIP: metadata.clientIP || 'unknown',
            fileType: metadata.fileType || 'document',
            url: `${urlPrefix}${key.name}`
          });
        } catch (parseError) {
          console.error(`Failed to parse metadata for ${key.name}:`, parseError);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      files
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(
        JSON.stringify({
          success: false,
          error: error.message || "Failed to list files"
        }),
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
