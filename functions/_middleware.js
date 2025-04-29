export async function onRequest(context) {
  // 基本认证检查
  const { request, env } = context;
  const url = new URL(request.url);
  
  // 静态文件和上传API直接放行
  if (!url.pathname.startsWith('/api/') || url.pathname === '/api/upload') {
    return context.next();
  }
  
  // API调用认证检查 (除非明确标记为不需要认证)
  const hasAuthParam = url.searchParams.has('auth') || url.searchParams.has('auth_check');
  const isAuthRequired = !hasAuthParam;
  
  if (isAuthRequired) {
    // 检查认证信息
    const basicUser = env.BASIC_USER;
    const basicPass = env.BASIC_PASS;
    
    if (basicUser && basicPass) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        return new Response('Unauthorized', {
          status: 401,
          // headers: {
          //  'WWW-Authenticate': 'Basic realm="Admin Area"'
          // }
        });
      }
      
      const base64Credentials = authHeader.split(' ')[1];
      const credentials = atob(base64Credentials);
      const [username, password] = credentials.split(':');
      
      if (username !== basicUser || password !== basicPass) {
        return new Response('Unauthorized', {
          status: 401,
          // headers: {
          //  'WWW-Authenticate': 'Basic realm="Admin Area"'
          // }
        });
      }
    }
  }
  
  // 验证成功，继续处理请求
  return context.next();
}
