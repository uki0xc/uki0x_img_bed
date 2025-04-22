export async function onRequest(context) {
  const { request, env } = context;

  // CORS headers
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // 检查是否为 GET 请求
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // 检查认证信息
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "WWW-Authenticate": "Basic realm=\"Admin Area\""
      },
    });
  }

  // 解析认证信息
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = atob(base64Credentials);
  const [username, password] = credentials.split(':');

  // 从环境变量获取正确的用户名和密码
  const basicUser = env.BASIC_USER;
  const basicPass = env.BASIC_PASS;

  // 验证用户名和密码
  if (username !== basicUser || password !== basicPass) {
    return new Response(JSON.stringify({ error: "Invalid credentials" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    // 获取查询参数
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search') || '';

    // 获取所有文件的键列表
    const keys = await env.FILE_STORE.list();
    let fileKeys = keys.keys;

    // 获取所有文件的元数据
    const filesPromises = fileKeys.map(async (key) => {
      const metadataStr = await env.FILE_STORE.get(key.name);
      if (metadataStr) {
        const metadata = JSON.parse(metadataStr);
        metadata.fileUniqueId = key.name;
        return metadata;
      }
      return null;
    });

    let files = await Promise.all(filesPromises);
    files = files.filter(file => file !== null);

    // 如果有搜索查询，过滤文件
    if (search) {
      const searchLower = search.toLowerCase();
      files = files.filter(file => 
        file.fileName.toLowerCase().includes(searchLower) ||
        (file.mimeType && file.mimeType.toLowerCase().includes(searchLower)) ||
        (file.clientIP && file.clientIP.includes(search))
      );
    }

    // 按上传时间降序排序
    files.sort((a, b) => {
      const dateA = new Date(a.uploadDate || 0);
      const dateB = new Date(b.uploadDate || 0);
      return dateB - dateA;
    });

    // 计算分页
    const totalFiles = files.length;
    const totalPages = Math.ceil(totalFiles / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedFiles = files.slice(startIndex, endIndex);

    return new Response(JSON.stringify({
      files: paginatedFiles,
      page,
      limit,
      totalFiles,
      totalPages
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Failed to list files" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
