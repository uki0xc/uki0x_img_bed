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

  try {
    const body = await request.json();
    const { action, username, password, newPassword } = body;

    // 获取存储的管理员凭据
    let adminCredentials = await env.ADMIN_CREDENTIALS.get("admin");
    
    // 如果没有存储的凭据，使用默认凭据
    if (!adminCredentials) {
      adminCredentials = JSON.stringify({
        username: "admin",
        password: "admin"
      });
      
      // 保存默认凭据
      await env.ADMIN_CREDENTIALS.put("admin", adminCredentials);
    }
    
    const credentials = JSON.parse(adminCredentials);

    // 登录验证
    if (action === "login") {
      if (!username || !password) {
        return new Response(JSON.stringify({ error: "Missing username or password" }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      if (username === credentials.username && password === credentials.password) {
        // 生成简单的会话令牌
        const sessionToken = generateSessionToken();
        
        // 存储会话令牌（有效期24小时）
        await env.ADMIN_SESSIONS.put(sessionToken, JSON.stringify({
          username,
          expires: Date.now() + 24 * 60 * 60 * 1000
        }), { expirationTtl: 86400 });
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Login successful",
          sessionToken
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } else {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Invalid username or password" 
        }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }
    
    // 修改密码
    else if (action === "changePassword") {
      if (!username || !password || !newPassword) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // 验证当前凭据
      if (username === credentials.username && password === credentials.password) {
        // 更新密码
        credentials.password = newPassword;
        
        // 保存新凭据
        await env.ADMIN_CREDENTIALS.put("admin", JSON.stringify(credentials));
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Password changed successfully" 
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } else {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Invalid current credentials" 
        }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }
    
    // 验证会话
    else if (action === "verifySession") {
      const { sessionToken } = body;
      
      if (!sessionToken) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Missing session token" 
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
      
      // 获取会话信息
      const sessionData = await env.ADMIN_SESSIONS.get(sessionToken);
      
      if (!sessionData) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Invalid or expired session" 
        }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
      
      const session = JSON.parse(sessionData);
      
      // 检查会话是否过期
      if (session.expires < Date.now()) {
        // 删除过期会话
        await env.ADMIN_SESSIONS.delete(sessionToken);
        
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Session expired" 
        }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        username: session.username
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
    
    else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}

// 生成随机会话令牌
function generateSessionToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
