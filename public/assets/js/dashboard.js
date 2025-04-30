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
  // 获取预览模态框相关元素
  const previewModal = document.getElementById('preview-modal');
  const previewCloseBtn = document.getElementById('preview-close');
  const previewContent = document.getElementById('preview-content');
  
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
        renderFileList(data.files);
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
  function renderFileList(files) {
    if (!fileList) return;
    if (!files || files.length === 0) {
      noFilesMessage.style.display = 'block';
      fileList.innerHTML = ''; // 确保在没有文件时清空列表
      return;
    }

    noFilesMessage.style.display = 'none';

    // 创建表格
    const table = document.createElement('table');
    table.className = 'table table-hover'; // 添加 hover 效果
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th class="checkbox-cell"><input type="checkbox" id="select-all-checkbox"></th>
        <th class="file-type-cell">类型</th>
        <th>名称</th>
        <th>大小</th>
        <th>上传时间</th>
        <th class="file-ip">上传IP</th>
        <th class="action-cell">操作</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    files.forEach(file => {
      // 添加日志，检查每个文件的数据
      console.log(`Rendering file: Name=${file.name}, Type=${file.type}, Size=${file.size}`);

      const tr = document.createElement('tr');
      tr.dataset.fileId = file.id;
      tr.dataset.fileUrl = file.url;
      tr.dataset.fileName = file.name;
      tr.dataset.fileType = file.type;
      tr.dataset.filePath = file.path;

      // 格式化日期 (添加健壮性检查)
      let formattedDate = 'N/A';
      if (file.uploadTime) {
          try {
            const uploadDate = new Date(file.uploadTime);
            if (!isNaN(uploadDate.getTime())) { // 检查日期是否有效
                formattedDate = `${uploadDate.getFullYear()}-${String(uploadDate.getMonth() + 1).padStart(2, '0')}-${String(uploadDate.getDate()).padStart(2, '0')} ${String(uploadDate.getHours()).padStart(2, '0')}:${String(uploadDate.getMinutes()).padStart(2, '0')}`;
            } else {
                console.warn(`Invalid date format for file ${file.name}: ${file.uploadTime}`);
            }
          } catch (e) {
              console.error(`Error parsing date for file ${file.name}:`, file.uploadTime, e);
          }
      }

      // 文件大小处理逻辑 (修正：使用 file.rawSize)
      const fileSizeDisplay = file.type === 'directory' ? '-' : formatFileSize(file.rawSize);

      tr.innerHTML = `
        <td class="checkbox-cell"><input type="checkbox" class="file-checkbox" value="${file.id}"></td>
        <td class="file-type-cell">${getFileIcon(file.type)}</td>
        <td class="file-name">
          ${file.type === 'directory' ? `<a href="#" class="folder-link" data-path="${file.path}">${file.name}</a>` : `<span class="file-text-name">${file.name}</span>`}
          <a href="${file.url}" target="_blank" title="在新标签页打开" class="action-btn open-link"><i class="fas fa-external-link-alt"></i></a>
          <button class="action-btn copy-link" title="复制链接"><i class="fas fa-copy"></i></button>
        </td>
        <td>${fileSizeDisplay}</td>
        <td>${formattedDate}</td>
        <td class="file-ip">${file.uploadIP || 'N/A'}</td>
        <td class="action-cell">
          ${file.type !== 'directory' ? `<button class="action-btn preview-btn" title="预览"><i class="fas fa-eye"></i></button>` : ''}
          ${file.type !== 'directory' ? `<button class="action-btn download-btn" title="下载"><i class="fas fa-download"></i></button>` : ''}
          <button class="action-btn delete-btn" title="删除"><i class="fas fa-trash-alt"></i></button>
        </td>
      `;
      tbody.appendChild(tr);

      // 为整行添加点击事件监听器以触发预览
      tr.addEventListener('click', (event) => {
        const target = event.target;
        const isInteractiveElement = target.closest('input[type="checkbox"], .action-btn, .folder-link, a');
        if (!isInteractiveElement && file.type !== 'directory') {
             showFilePreview(file.url, file.type, file.name);
        }
      });

    }); // 结束 forEach

    table.appendChild(tbody);
    fileList.innerHTML = ''; // 清空旧内容
    fileList.appendChild(table);

    // 更新全选复选框状态
    updateSelectAllCheckbox();

    // 添加事件监听器 (使用事件委托)
    addTableEventListeners(table);

    // 添加文件夹链接的点击事件
    tbody.querySelectorAll('.folder-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // 阻止冒泡到行点击事件
            loadFiles(link.dataset.path);
        });
    });
  }

  // 添加表格事件监听器 (使用事件委托)
  function addTableEventListeners(table) {
    table.removeEventListener('change', handleTableChange);
    table.removeEventListener('click', handleTableClick);

    table.addEventListener('change', handleTableChange);
    table.addEventListener('click', handleTableClick);

    const selectAllCheckbox = table.querySelector('#select-all-checkbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.removeEventListener('change', handleSelectAllChange);
        selectAllCheckbox.addEventListener('change', handleSelectAllChange);
    }
  }

  function handleTableChange(event) {
    if (event.target.matches('.file-checkbox')) {
      handleCheckboxChange(event.target);
    }
  }

  function handleSelectAllChange(event) {
    const isChecked = event.target.checked;
    const table = event.target.closest('table');
    if (!table) return;
    const checkboxes = table.querySelectorAll('tbody .file-checkbox');
    checkboxes.forEach(checkbox => {
      if (checkbox.checked !== isChecked) {
          checkbox.checked = isChecked;
          handleCheckboxChange(checkbox);
      }
    });
  }

  function handleTableClick(event) {
      const target = event.target;
      const actionButton = target.closest('.action-btn');
      const folderLink = target.closest('.folder-link');
      const fileRow = target.closest('tr');

      if (!fileRow) return;

      const fileId = fileRow.dataset.fileId;
      const fileUrl = fileRow.dataset.fileUrl;
      const fileName = fileRow.dataset.fileName;
      const fileType = fileRow.dataset.fileType;
      const filePath = fileRow.dataset.filePath;

      if (actionButton) {
          event.stopPropagation();

          if (actionButton.classList.contains('preview-btn')) {
            if (fileType !== 'directory') {
              showFilePreview(fileUrl, fileType, fileName);
            }
          }
          else if (actionButton.classList.contains('delete-btn')) {
            const confirmMessage = fileType === 'directory'
              ? `确定要删除目录 "${fileName}" 及其所有内容吗？此操作不可恢复！`
              : `确定要删除文件 "${fileName}" 吗？`;
            if (confirm(confirmMessage)) {
              if (fileType === 'directory') {
                deleteDirectory(filePath);
              } else {
                deleteFile(fileId);
              }
            }
          }
          else if (actionButton.classList.contains('copy-link')) {
            copyToClipboard(fileUrl);
            alert('链接已复制到剪贴板');
          }
          else if (actionButton.classList.contains('download-btn')) {
            if (fileType !== 'directory') {
              const link = document.createElement('a');
              link.href = fileUrl;
              link.download = fileName;
              link.style.display = 'none';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          }
      }
      else if (folderLink) {
          event.preventDefault();
          event.stopPropagation();
          loadFiles(filePath);
      }
  }

  // 处理单个复选框变化
  function handleCheckboxChange(checkbox) {
    const fileId = checkbox.value;
    const isChecked = checkbox.checked;

    if (isChecked) {
      if (!selectedFiles.includes(fileId)) {
        selectedFiles.push(fileId);
      }
    } else {
      selectedFiles = selectedFiles.filter(id => id !== fileId);
    }
    updateDeleteSelectedButton();
    updateSelectAllCheckbox(); // 更新全选框状态
  }

  // 更新全选复选框的状态
  function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const fileCheckboxes = fileList ? fileList.querySelectorAll('tbody .file-checkbox') : [];
    if (!selectAllCheckbox || fileCheckboxes.length === 0) return;

    const totalCheckboxes = fileCheckboxes.length;

    if (totalCheckboxes === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
        return;
    }

    const allVisibleSelected = Array.from(fileCheckboxes).every(cb => cb.checked);
    const someVisibleSelected = Array.from(fileCheckboxes).some(cb => cb.checked);

    selectAllCheckbox.checked = allVisibleSelected;
    selectAllCheckbox.indeterminate = !allVisibleSelected && someVisibleSelected;
  }

  // 获取文件图标
  function getFileIcon(fileType) {
    if (fileType === 'directory') {
      return '<i class="fas fa-folder file-icon" style="color: #ffca28;"></i>'; // 黄色文件夹
    }
    if (fileType && fileType.startsWith('image/')) {
      return '<i class="fas fa-file-image file-icon" style="color: #42a5f5;"></i>'; // 蓝色图片
    } else if (fileType && fileType.startsWith('video/')) {
      return '<i class="fas fa-file-video file-icon" style="color: #ef5350;"></i>'; // 红色视频
    } else if (fileType && fileType.startsWith('audio/')) {
      return '<i class="fas fa-file-audio file-icon" style="color: #ab47bc;"></i>'; // 紫色音频
    } else if (fileType === 'application/pdf') {
      return '<i class="fas fa-file-pdf file-icon" style="color: #ef5350;"></i>'; // 红色PDF
    } else if (fileType === 'text/plain' || fileType === 'application/json' || fileType === 'application/xml') {
        return '<i class="fas fa-file-alt file-icon" style="color: #66bb6a;"></i>'; // 绿色文本
    } else if (fileType && (fileType.includes('zip') || fileType.includes('compressed'))) {
        return '<i class="fas fa-file-archive file-icon" style="color: #bdbdbd;"></i>'; // 灰色压缩文件
    }
    return '<i class="fas fa-file file-icon" style="color: #78909c;"></i>'; // 默认文件图标
  }

  // 格式化文件大小
  function formatFileSize(bytes) {
    // Handle non-numeric types, NaN, null, undefined, and negative values
    if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0 || bytes === null || bytes === undefined) {
      return '-'; // Return '-' for invalid or non-applicable sizes
    }
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']; // Add more units if needed (PB, EB, ...)

    // Calculate index, handle edge cases like 0 or very large numbers safely
    const i = Math.max(0, Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1));

    // Calculate size in the determined unit and format it
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  // 显示文件预览
  function showFilePreview(url, type, name) {
    if (!previewModal || !previewContent) {
      console.error("Preview modal or content element not found!");
      return;
    }
    
    // 设置模态框标题
    document.querySelector('.modal-title').textContent = `预览: ${name}`;
    
    // 清空预览内容
    previewContent.innerHTML = '<div class="preview-loading"><i class="fas fa-spinner fa-spin"></i></div>';
    
    // 显示模态框
    previewModal.style.display = 'flex';
    
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
    console.log('Attempting to close preview modal...'); // 添加日志
    if (previewModal) {
      previewModal.style.display = 'none';
      // 清空内容，防止音视频继续播放
      if (previewContent) {
        previewContent.innerHTML = '';
        console.log('Preview modal closed and content cleared.'); // 添加日志
      }
    } else {
        console.error('closePreview called but previewModal element not found!');
    }
  }
  
  // 为静态模态框的关闭按钮添加事件监听器
  if (previewCloseBtn) {
    previewCloseBtn.addEventListener('click', (event) => {
        console.log('Preview close button clicked!'); // 添加日志
        event.stopPropagation(); // 防止事件冒泡到 modal 背景的监听器
        closePreview();
    });
    console.log('Close button event listener added.'); // 添加日志
  } else {
    console.error("Preview modal close button (#preview-close) not found!");
  }

  // 为模态框背景添加点击关闭事件监听器
  if (previewModal) {
    previewModal.addEventListener('click', (event) => {
      // 如果点击事件的目标是模态框本身 (即背景)，则关闭
      if (event.target === previewModal) {
        console.log('Preview modal background clicked!'); // 添加日志
        closePreview();
      }
    });
    console.log('Modal background click listener added.'); // 添加日志

    // 3. 添加 ESC 键关闭监听器 (添加到 document)
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && previewModal.style.display === 'flex') {
        console.log('Escape key pressed, closing preview modal.'); // 添加日志
        closePreview();
      }
    });
    console.log('Escape keydown listener added to document.'); // 添加日志

  } else {
    console.error("Preview modal element (#preview-modal) not found!");
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
    if (navigator.clipboard && window.isSecureContext) {
        // 使用 Clipboard API (更现代、安全，需要HTTPS或localhost)
        navigator.clipboard.writeText(text).then(() => {
            console.log('Link copied to clipboard via Clipboard API.');
            // 可选：显示一个短暂的成功提示，比 alert 更好
            // showToast('链接已复制!');
        }).catch(err => {
            console.error('Clipboard API failed: ', err);
            fallbackCopyTextToClipboard(text); // 尝试后备方法
        });
    } else {
        // 后备方法 (适用于HTTP或旧浏览器)
        fallbackCopyTextToClipboard(text);
    }
  }

  function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = 'fixed'; // 避免页面滚动
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em'; // 设为足够小但仍可聚焦
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        console.log('Fallback: Link copied to clipboard via execCommand.');
        // showToast('链接已复制!');
      } else {
        console.error('Fallback: execCommand("copy") failed.');
        alert('无法自动复制链接，请手动复制。');
      }
    } catch (err) {
      console.error('Fallback: Error during execCommand("copy"):', err);
      alert('无法自动复制链接，请手动复制。');
    }
    document.body.removeChild(textArea);
  }
});
