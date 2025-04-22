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
    
    return new Response(JSON.stringify({
      success: true,
      files: files
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('获取文件列表错误:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
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
    // 删除目录
    else if (data.directory) {
      await deleteDirectory(env, data.directory);
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: '缺少必要参数'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('删除文件错误:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 列出指定目录的文件和子目录
async function listFiles(env, directory) {
  const prefix = directory ? `${directory}/` : '';
  const list = await env.FILE_STORE.list({ prefix });
  const dirPrefix = 'dir:';
  
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
    if (value) {
      try {
        const fileData = JSON.parse(value);
        
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
            const fileUrl = fileData.url || `${urlPrefix}${keyName}`;
            
            // 映射字段名，兼容新旧数据格式
            files.push({
              id: fileData.id || fileData.fileUniqueId || keyName,
              name: fileData.name || fileData.fileName || '未命名文件',
              url: fileData.url || fileUrl,
              size: fileData.size || fileData.fileSize || 0,
              uploadTime: fileData.uploadTime || fileData.uploadDate || new Date().toISOString(),
              type: 'file'
            });
          } else {
            // 对于子目录下的文件，记录目录名
            const dirName = relativePath.split('/')[0];
            dirSet.add(dirName);
          }
        }
      } catch (e) {
        console.error('解析文件数据错误:', e);
      }
    }
  }
  
  // 添加子目录
  for (const dirName of dirSet) {
    files.push({
      name: dirName,
      type: 'directory'
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
                  type: 'directory'
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
        
        if (fileData.id === fileId) {
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
