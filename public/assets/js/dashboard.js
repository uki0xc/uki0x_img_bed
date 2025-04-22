document.addEventListener('DOMContentLoaded', () => {
  // 元素选择
  const loginSection = document.getElementById('login-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('login-btn');
  const loginError = document.getElementById('login-error');
  const refreshBtn = document.getElementById('refresh-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const fileList = document.getElementById('files-list');
  const directoryPath = document.getElementById('directory-path');
  const deleteSelectedBtn = document.getElementById('delete-selected-btn');
  
  // 存储选中的文件ID
  let selectedFiles = [];
  
  // 检查登录状态
  checkAuthStatus();
  
  // 登录按钮点击事件
  loginBtn.addEventListener('click', login);
  
  // 回车键登录
  passwordInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      login();
    }
  });
  
  // 刷新按钮点击事件
  refreshBtn.addEventListener('click', () => {
    loadFiles(currentDirectory);
  });
  
  // 登出按钮点击事件
  logoutBtn.addEventListener('click', logout);
  
  // 删除选中文件按钮点击事件
  deleteSelectedBtn.addEventListener('click', () => {
    if (selectedFiles.length === 0) {
      alert('请先选择要删除的文件');
      return;
    }
    
    if (confirm(`确定要删除选中的 ${selectedFiles.length} 个文件吗？`)) {
      deleteSelectedFiles();
    }
  });
  
  // 当前目录
  let currentDirectory = '';
  
  // 检查认证状态
  async function checkAuthStatus() {
    try {
      const response = await fetch('/api/images?auth_check=true');
      if (response.ok) {
        // 已登录，显示管理面板
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        // 加载文件列表
        loadFiles(currentDirectory);
      } else {
        // 未登录，显示登录界面
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
      }
    } catch (error) {
      console.error('认证检查失败:', error);
      alert('认证检查失败，请刷新页面重试');
    }
  }
  
  // 登录处理
  async function login() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!username || !password) {
      loginError.textContent = '请输入用户名和密码';
      return;
    }
    
    try {
      const response = await fetch('/api/images?auth=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(username + ':' + password)
        }
      });
      
      if (response.ok) {
        // 登录成功
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        // 加载文件列表
        loadFiles(currentDirectory);
      } else {
        // 登录失败
        loginError.textContent = '用户名或密码错误';
      }
    } catch (error) {
      console.error('登录失败:', error);
      loginError.textContent = '登录请求失败，请重试';
    }
  }
  
  // 登出处理
  function logout() {
    // 清除认证状态
    fetch('/api/images?logout=true')
      .then(() => {
        // 显示登录界面
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
      })
      .catch(error => {
        console.error('登出失败:', error);
        alert('登出失败，请重试');
      });
  }
  
  // 加载文件列表
  async function loadFiles(directory) {
    try {
      fileList.innerHTML = '<p>正在加载文件...</p>';
      
      // 重置选中的文件
      selectedFiles = [];
      updateDeleteSelectedButton();
      
      const response = await fetch(`/api/images?directory=${encodeURIComponent(directory)}`);
      if (!response.ok) {
        throw new Error('加载文件列表失败');
      }
      
      const data = await response.json();
      console.log('API返回数据:', data); // 添加调试信息
      
      // 更新当前目录
      currentDirectory = directory;
      
      // 更新面包屑导航
      updateBreadcrumb(directory);
      
      // 渲染文件列表
      renderFileList(data);
    } catch (error) {
      console.error('加载文件失败:', error);
      fileList.innerHTML = '<p>加载文件列表失败，请重试</p>';
    }
  }
  
  // 更新面包屑导航
  function updateBreadcrumb(directory) {
    // 清除旧的面包屑
    directoryPath.innerHTML = '<div class="breadcrumb-item"><a href="#" data-path="">根目录</a></div>';
    
    if (directory) {
      const parts = directory.split('/');
      let currentPath = '';
      
      parts.forEach((part, index) => {
        if (part) {
          currentPath += (currentPath ? '/' : '') + part;
          const item = document.createElement('div');
          item.className = 'breadcrumb-item';
          
          const link = document.createElement('a');
          link.href = '#';
          link.dataset.path = currentPath;
          link.textContent = part;
          
          item.appendChild(link);
          directoryPath.appendChild(item);
        }
      });
    }
    
    // 给面包屑项添加点击事件
    document.querySelectorAll('#directory-path a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        loadFiles(link.dataset.path);
      });
    });
  }
  
  // 渲染文件列表
  function renderFileList(data) {
    if (!data.files || data.files.length === 0) {
      fileList.innerHTML = '<p>当前目录没有文件</p>';
      return;
    }
    
    const grid = document.createElement('div');
    grid.className = 'file-grid';
    
    data.files.forEach(file => {
      const card = document.createElement('div');
      card.className = 'file-card';
      
      // 区分目录和文件
      if (file.type === 'directory') {
        // 目录卡片
        card.innerHTML = `
          <div class="file-details">
            <div class="file-name">📁 ${file.name}</div>
            <div class="file-actions">
              <button class="btn-primary btn-sm open-dir" data-path="${currentDirectory ? currentDirectory + '/' + file.name : file.name}">打开</button>
              <button class="btn-danger btn-sm delete-dir" data-path="${currentDirectory ? currentDirectory + '/' + file.name : file.name}">删除</button>
            </div>
          </div>
        `;
      } else {
        // 文件卡片 - 添加多选框
        const isImage = file.mimeType && file.mimeType.startsWith('image/');
        
        // 构建文件信息HTML
        let fileInfoHtml = '';
        if (file.size) {
          fileInfoHtml += `<div class="file-info">大小: ${file.size}</div>`;
        }
        if (file.uploadTime && file.uploadTime !== '-') {
          fileInfoHtml += `<div class="file-info">上传时间: ${file.uploadTime}</div>`;
        }
        if (file.uploadIP && file.uploadIP !== '未知' && file.uploadIP !== '-') {
          fileInfoHtml += `<div class="file-info">上传IP: ${file.uploadIP}</div>`;
        }
        
        card.innerHTML = `
          <div class="file-checkbox">
            <input type="checkbox" class="file-select" data-id="${file.id}">
          </div>
          <img src="${file.url}" alt="${file.name}" class="file-thumbnail">
          <div class="file-details">
            <div class="file-name">${file.name}</div>
            ${fileInfoHtml}
            <div class="file-actions">
              <button class="btn-primary btn-sm copy-url" data-url="${file.url}">复制链接</button>
              <button class="btn-danger btn-sm delete-file" data-id="${file.id}">删除</button>
            </div>
          </div>
        `;
      }
      
      grid.appendChild(card);
    });
    
    fileList.innerHTML = '';
    fileList.appendChild(grid);
    
    // 添加事件处理
    document.querySelectorAll('.open-dir').forEach(btn => {
      btn.addEventListener('click', () => {
        loadFiles(btn.dataset.path);
      });
    });
    
    document.querySelectorAll('.delete-dir').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm(`确定要删除目录 "${btn.dataset.path}" 及其所有内容吗？`)) {
          deleteDirectory(btn.dataset.path);
        }
      });
    });
    
    document.querySelectorAll('.copy-url').forEach(btn => {
      btn.addEventListener('click', () => {
        copyToClipboard(btn.dataset.url);
        btn.textContent = '已复制!';
        setTimeout(() => {
          btn.textContent = '复制链接';
        }, 2000);
      });
    });
    
    document.querySelectorAll('.delete-file').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('确定要删除此文件吗？')) {
          deleteFile(btn.dataset.id);
        }
      });
    });
    
    // 添加多选框事件处理
    document.querySelectorAll('.file-select').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const fileId = checkbox.dataset.id;
        
        if (checkbox.checked) {
          // 添加到选中列表
          if (!selectedFiles.includes(fileId)) {
            selectedFiles.push(fileId);
          }
        } else {
          // 从选中列表移除
          const index = selectedFiles.indexOf(fileId);
          if (index !== -1) {
            selectedFiles.splice(index, 1);
          }
        }
        
        // 更新删除按钮状态
        updateDeleteSelectedButton();
      });
    });
  }
  
  // 更新删除选中按钮状态
  function updateDeleteSelectedButton() {
    if (selectedFiles.length > 0) {
      deleteSelectedBtn.disabled = false;
      deleteSelectedBtn.textContent = `删除所选 (${selectedFiles.length})`;
    } else {
      deleteSelectedBtn.disabled = true;
      deleteSelectedBtn.textContent = '删除所选';
    }
  }
  
  // 删除选中的文件
  async function deleteSelectedFiles() {
    if (selectedFiles.length === 0) return;
    
    try {
      // 显示加载状态
      deleteSelectedBtn.disabled = true;
      deleteSelectedBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 删除中...';
      
      // 逐个删除文件
      const promises = selectedFiles.map(fileId => 
        fetch('/api/images', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fileId: fileId
          })
        })
      );
      
      await Promise.all(promises);
      
      // 删除成功，刷新文件列表
      selectedFiles = [];
      loadFiles(currentDirectory);
      
    } catch (error) {
      console.error('批量删除文件失败:', error);
      alert('批量删除文件失败，请重试');
      
      // 恢复按钮状态
      updateDeleteSelectedButton();
    }
  }
  
  // 删除目录
  async function deleteDirectory(path) {
    try {
      const response = await fetch('/api/images', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          directory: path
        })
      });
      
      if (!response.ok) {
        throw new Error('删除目录失败');
      }
      
      // 删除成功，刷新文件列表
      loadFiles(currentDirectory);
    } catch (error) {
      console.error('删除目录失败:', error);
      alert('删除目录失败，请重试');
    }
  }
  
  // 删除文件
  async function deleteFile(fileId) {
    try {
      const response = await fetch('/api/images', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileId: fileId
        })
      });
      
      if (!response.ok) {
        throw new Error('删除文件失败');
      }
      
      // 删除成功，刷新文件列表
      loadFiles(currentDirectory);
    } catch (error) {
      console.error('删除文件失败:', error);
      alert('删除文件失败，请重试');
    }
  }
  
  // 复制到剪贴板
  function copyToClipboard(text) {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.value = text;
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
  }
});
