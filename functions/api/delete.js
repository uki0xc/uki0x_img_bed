export async function onRequest(context) {
  const { request, env } = context;

  // CORS headers
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
    // 获取请求体
    const requestData = await request.json();
    const fileIds = requestData.fileIds || [];

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return new Response(JSON.stringify({ error: "No file IDs provided" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // 删除文件
    const deletePromises = fileIds.map(fileId => env.FILE_STORE.delete(fileId));
    await Promise.all(deletePromises);

    return new Response(JSON.stringify({
      success: true,
      deletedCount: fileIds.length,
      message: `Successfully deleted ${fileIds.length} files`
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Failed to delete files" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
