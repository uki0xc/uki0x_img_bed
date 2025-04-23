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
  const loadingIndicator = document.getElementById('loading');
  const noFilesMessage = document.getElementById('no-files');
  
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
  
  // 创建预览模态框
  createPreviewModal();
  
  // 检查认证状态
  async function checkAuthStatus() {
    try {
      // 首先检查localStorage中是否有保存的认证信息
      const savedAuth = localStorage.getItem('adminAuth');
      
      if (savedAuth) {
        // 使用保存的认证信息进行验证
        const response = await fetch('/api/images?auth_check=true', {
          headers: {
            'Authorization': 'Basic ' + savedAuth
          }
        });
        
        if (response.ok) {
          // 认证有效，显示管理面板
          loginSection.style.display = 'none';
          dashboardSection.style.display = 'block';
          // 加载文件列表
          loadFiles(currentDirectory);
          return;
        } else {
          // 认证无效，清除保存的认证信息
          localStorage.removeItem('adminAuth');
        }
      }
      
      // 如果没有保存的认证信息或认证无效，尝试常规检查
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
      const authString = btoa(username + ':' + password);
      
      const response = await fetch('/api/images?auth=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + authString
        }
      });
      
      if (response.ok) {
        // 登录成功，保存认证信息到localStorage
        localStorage.setItem('adminAuth', authString);
        
        // 显示管理面板
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
    // 清除本地存储的认证信息
    localStorage.removeItem('adminAuth');
    
    // 清除服务器端认证状态
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
      // 显示加载指示器
      loadingIndicator.style.display = 'block';
      fileList.innerHTML = '';
      noFilesMessage.style.display = 'none';
      
      // 重置选中的文件
      selectedFiles = [];
      updateDeleteSelectedButton();
      
      // 获取认证信息
      const savedAuth = localStorage.getItem('adminAuth');
      const headers = savedAuth ? { 'Authorization': 'Basic ' + savedAuth } : {};
      
      const response = await fetch(`/api/images?directory=${encodeURIComponent(directory)}`, {
        headers: headers
      });
      
      if (!response.ok) {
        throw new Error('加载文件列表失败');
      }
      
      const data = await response.json();
      console.log('API返回数据:', data); // 添加调试信息
      
      // 更新当前目录
      currentDirectory = directory;
      
      // 更新面包屑导航
      updateBreadcrumb(directory);
      
      // 隐藏加载指示器
      loadingIndicator.style.display = 'none';
      
      // 渲染文件列表
      if (data.success && data.files && data.files.length > 0) {
        renderFileList(data);
      } else {
        noFilesMessage.style.display = 'block';
      }
    } catch (error) {
      console.error('加载文件失败:', error);
      loadingIndicator.style.display = 'none';
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
      noFilesMessage.style.display = 'block';
      return;
    }
    
    // 创建表格视图
    const table = document.createElement('table');
    table.className = 'file-table';
    
    // 创建表头
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th class="checkbox-cell">
          <input type="checkbox" id="select-all">
        </th>
        <th class="file-type-cell">类型</th>
        <th>文件名</th>
        <th>大小</th>
        <th>上传时间</th>
        <th>上传IP</th>
        <th class="action-cell">操作</th>
      </tr>
    `;
    table.appendChild(thead);
    
    // 创建表格主体
    const tbody = document.createElement('tbody');
    
    // 添加文件行
    data.files.forEach(file => {
      const tr = document.createElement('tr');
      
      // 区分目录和文件
      if (file.type === 'directory') {
        // 目录行
        tr.innerHTML = `
          <td class="checkbox-cell"></td>
          <td class="file-type-cell"><i class="fas fa-folder"></i></td>
          <td class="file-name">${file.name}</td>
          <td class="file-size">-</td>
          <td class="file-date">-</td>
          <td class="file-ip">-</td>
          <td class="action-cell">
            <button class="action-btn open-dir" data-path="${currentDirectory ? currentDirectory + '/' + file.name : file.name}" title="打开">
              <i class="fas fa-folder-open"></i>
            </button>
            <button class="action-btn delete delete-dir" data-path="${currentDirectory ? currentDirectory + '/' + file.name : file.name}" title="删除">
              <i class="fas fa-trash-alt"></i>
            </button>
          </td>
        `;
      } else {
        // 文件行
        const isImage = file.mimeType && file.mimeType.startsWith('image/');
        const isVideo = file.mimeType && file.mimeType.startsWith('video/');
        const isAudio = file.mimeType && file.mimeType.startsWith('audio/');
        const fileIcon = isImage ? 'far fa-image' : (isVideo ? 'fas fa-film' : (isAudio ? 'fas fa-music' : (file.fileType || 'fas fa-file')));
        
        // 添加预览按钮
        const previewBtn = isImage || isVideo || isAudio ? 
          `<button class="action-btn preview-file" data-url="${file.url}" data-type="${file.mimeType}" data-name="${file.name}" title="预览">
            <i class="fas fa-eye"></i>
          </button>` : '';
        
        tr.innerHTML = `
          <td class="checkbox-cell">
            <input type="checkbox" class="file-select" data-id="${file.id}">
          </td>
          <td class="file-type-cell"><i class="${fileIcon}"></i></td>
          <td class="file-name">${file.name}</td>
          <td class="file-size">${file.size || '-'}</td>
          <td class="file-date">${file.uploadTime || '-'}</td>
          <td class="file-ip">${file.uploadIP || '-'}</td>
          <td class="action-cell">
            ${previewBtn}
            <button class="action-btn copy-url" data-url="${file.url}" title="复制链接">
              <i class="fas fa-copy"></i>
            </button>
            <button class="action-btn delete delete-file" data-id="${file.id}" title="删除">
              <i class="fas fa-trash-alt"></i>
            </button>
          </td>
        `;
        
        // 为可预览的文件添加行点击事件和样式
        if (isImage || isVideo || isAudio) {
          tr.classList.add('previewable-row');
          tr.dataset.url = file.url;
          tr.dataset.type = file.mimeType;
          tr.dataset.name = file.name;
        }
      }
      
      tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    
    // 添加到文件列表
    fileList.innerHTML = '';
    fileList.appendChild(table);
    
    // 添加可预览行的样式
    const style = document.createElement('style');
    style.textContent = `
      .previewable-row {
        cursor: pointer;
      }
      .previewable-row:hover {
        background-color: #f0f4ff !important;
      }
    `;
    document.head.appendChild(style);
    
    // 添加全选事件处理
    const selectAllCheckbox = document.getElementById('select-all');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', () => {
        const checkboxes = document.querySelectorAll('.file-select');
        checkboxes.forEach(checkbox => {
          checkbox.checked = selectAllCheckbox.checked;
          
          const fileId = checkbox.dataset.id;
          if (selectAllCheckbox.checked) {
            // 添加到选中列表
            if (!selectedFiles.includes(fileId)) {
              selectedFiles.push(fileId);
            }
          } else {
            // 清空选中列表
            selectedFiles = [];
          }
        });
        
        // 更新删除按钮状态
        updateDeleteSelectedButton();
      });
    }
    
    // 添加事件处理
    document.querySelectorAll('.open-dir').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        loadFiles(btn.dataset.path);
      });
    });
    
    document.querySelectorAll('.delete-dir').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        if (confirm(`确定要删除目录 "${btn.dataset.path}" 及其所有内容吗？`)) {
          deleteDirectory(btn.dataset.path);
        }
      });
    });
    
    document.querySelectorAll('.copy-url').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        copyToClipboard(btn.dataset.url);
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
          btn.innerHTML = '<i class="fas fa-copy"></i>';
        }, 2000);
      });
    });
    
    document.querySelectorAll('.delete-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        if (confirm('确定要删除此文件吗？')) {
          deleteFile(btn.dataset.id);
        }
      });
    });
    
    // 添加预览按钮事件处理
    document.querySelectorAll('.preview-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        showFilePreview(btn.dataset.url, btn.dataset.type, btn.dataset.name);
      });
    });
    
    // 添加多选框事件处理
    document.querySelectorAll('.file-select').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
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
      
      // 防止点击复选框时触发行点击事件
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });
    
    // 添加行点击事件处理（点击整行预览文件）
    document.querySelectorAll('.previewable-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // 如果点击的是复选框或按钮，不触发预览
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button')) {
          return;
        }
        
        showFilePreview(row.dataset.url, row.dataset.type, row.dataset.name);
      });
    });
  }
  
  // 创建预览模态框
  function createPreviewModal() {
    // 检查是否已存在预览模态框
    if (document.getElementById('preview-modal')) {
      return;
    }
    
    // 创建模态框
    const modal = document.createElement('div');
    modal.id = 'preview-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">文件预览</h2>
          <button class="modal-close" id="preview-close">&times;</button>
        </div>
        <div class="modal-body" id="preview-content">
          <!-- 预览内容将在这里动态生成 -->
        </div>
      </div>
    `;
    
    // 添加到body
    document.body.appendChild(modal);
    
    // 添加关闭按钮事件
    document.getElementById('preview-close').addEventListener('click', () => {
      closePreview();
    });
    
    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closePreview();
      }
    });
    
    // 添加ESC键关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closePreview();
      }
    });
    
    // 添加模态框样式
    const style = document.createElement('style');
    style.textContent = `
      .modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        z-index: 1000;
        justify-content: center;
        align-items: center;
      }
      
      .modal-content {
        background-color: white;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        width: 90%;
        max-width: 800px;
        max-height: 90vh;
        overflow: auto;
        position: relative;
      }
      
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        border-bottom: 1px solid #eee;
      }
      
      .modal-title {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0;
      }
      
      .modal-close {
        background: none;
        border: none;
        font-size: 1.8rem;
        cursor: pointer;
        color: #666;
      }
      
      .modal-close:hover {
        color: #f44336;
      }
      
      .modal-body {
        padding: 20px;
        text-align: center;
      }
      
      .preview-image {
        max-width: 100%;
        max-height: 70vh;
        border-radius: 4px;
      }
      
      .preview-video {
        max-width: 100%;
        max-height: 70vh;
        border-radius: 4px;
      }
      
      .preview-audio {
        width: 100%;
        margin: 20px 0;
      }
      
      .preview-error {
        color: #f44336;
        font-size: 1.2rem;
        margin: 20px 0;
      }
      
      .preview-loading {
        font-size: 2rem;
        color: #4361ee;
        margin: 20px 0;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  // 显示文件预览
  function showFilePreview(url, type, name) {
    const modal = document.getElementById('preview-modal');
    const previewContent = document.getElementById('preview-content');
    
    // 设置模态框标题
    document.querySelector('.modal-title').textContent = `预览: ${name}`;
    
    // 清空预览内容
    previewContent.innerHTML = '<div class="preview-loading"><i class="fas fa-spinner fa-spin"></i></div>';
    
    // 显示模态框
    modal.style.display = 'flex';
    
    // 根据文件类型生成预览内容
    if (type && type.startsWith('image/')) {
      // 图片预览
      const img = document.createElement('img');
      img.className = 'preview-image';
      img.alt = name;
      img.onload = () => {
        previewContent.innerHTML = '';
        previewContent.appendChild(img);
      };
      img.onerror = () => {
        previewContent.innerHTML = `<div class="preview-error">图片加载失败</div>`;
      };
      img.src = url;
    } else if (type && type.startsWith('video/')) {
      // 视频预览
      previewContent.innerHTML = `
        <video class="preview-video" controls>
          <source src="${url}" type="${type}">
          您的浏览器不支持视频预览
        </video>
      `;
    } else if (type && type.startsWith('audio/')) {
      // 音频预览
      previewContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
          <i class="fas fa-music" style="font-size: 48px; color: #4361ee;"></i>
        </div>
        <audio class="preview-audio" controls>
          <source src="${url}" type="${type}">
          您的浏览器不支持音频预览
        </audio>
      `;
    } else {
      // 其他文件类型
      previewContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
          <i class="fas fa-file" style="font-size: 48px; color: #4361ee;"></i>
        </div>
        <p>此文件类型无法直接预览</p>
        <a href="${url}" target="_blank" class="btn" style="display: inline-block; margin-top: 15px;">
          <i class="fas fa-external-link-alt"></i> 在新窗口打开
        </a>
      `;
    }
  }
  
  // 关闭预览
  function closePreview() {
    const modal = document.getElementById('preview-modal');
    modal.style.display = 'none';
    
    // 停止可能正在播放的媒体
    const videos = document.querySelectorAll('.preview-video');
    const audios = document.querySelectorAll('.preview-audio');
    
    videos.forEach(video => {
      video.pause();
    });
    
    audios.forEach(audio => {
      audio.pause();
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
      
      // 获取认证信息
      const savedAuth = localStorage.getItem('adminAuth');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (savedAuth) {
        headers['Authorization'] = 'Basic ' + savedAuth;
      }
      
      // 逐个删除文件
      const promises = selectedFiles.map(fileId => 
        fetch('/api/images', {
          method: 'DELETE',
          headers: headers,
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
      // 获取认证信息
      const savedAuth = localStorage.getItem('adminAuth');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (savedAuth) {
        headers['Authorization'] = 'Basic ' + savedAuth;
      }
      
      const response = await fetch('/api/images', {
        method: 'DELETE',
        headers: headers,
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
      // 获取认证信息
      const savedAuth = localStorage.getItem('adminAuth');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (savedAuth) {
        headers['Authorization'] = 'Basic ' + savedAuth;
      }
      
      const response = await fetch('/api/images', {
        method: 'DELETE',
        headers: headers,
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
