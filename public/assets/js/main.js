document.addEventListener('DOMContentLoaded', function() {
    // 元素选择
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const selectBtn = document.getElementById('select-btn');
    const uploadContainer = document.getElementById('upload-container');
    const uploadProgress = document.getElementById('upload-progress');
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.getElementById('progress-text');
    const resultContainer = document.getElementById('result-container');
    const previewContainer = document.getElementById('preview-container');
    const previewImage = document.getElementById('preview-image');
    const directUrl = document.getElementById('direct-url');
    const htmlUrl = document.getElementById('html-url');
    const mdUrl = document.getElementById('md-url');
    const uploadAnother = document.getElementById('upload-another');
    const compressCheckbox = document.getElementById('compress-image');

    // 确保元素存在
    if (!dropArea || !fileInput || !selectBtn) {
        console.error('必要的DOM元素未找到，请检查HTML结构');
        return;
    }

    // ====== 修复文件选择按钮点击无响应问题 ======
    // 方法1: 直接绑定点击事件
    selectBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
        console.log('选择文件按钮被点击');
    });

    // ====== 拖放区域事件处理 ======
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.remove('dragover');
        }, false);
    });

    // 文件拖放处理
    dropArea.addEventListener('drop', function(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFiles(files[0]);
        }
    });

    // 文件选择处理
    fileInput.addEventListener('change', function() {
        console.log('文件已选择:', this.files);
        if (this.files && this.files.length > 0) {
            handleFiles(this.files[0]);
        }
    });

    // ====== 文件处理逻辑 ======
    async function handleFiles(file) {
        if (!file) {
            console.error('未接收到文件');
            return;
        }

        // 移除仅限图片的限制，支持所有文件类型
        console.log('处理文件:', file.name, file.type, file.size);

        // 显示上传进度
        uploadContainer.classList.add('hidden');
        uploadProgress.classList.remove('hidden');
        resultContainer.classList.add('hidden');

        try {
            // 压缩图片 (如果启用且是图片文件)
            let fileToUpload = file;
            if (file.type.match('image.*') && compressCheckbox && compressCheckbox.checked) {
                progressText.textContent = '正在压缩图片...';
                progressFill.style.width = '30%';

                try {
                    // 简化: 不使用外部库进行压缩
                    // 在实际应用中，可以动态加载压缩库或使用更简单的方法
                    progressText.textContent = `图片准备就绪，原始大小: ${formatBytes(file.size)}`;
                } catch (error) {
                    console.error('压缩失败:', error);
                    progressText.textContent = '压缩失败，使用原始文件...';
                }
            } else {
                progressText.textContent = `文件准备就绪，大小: ${formatBytes(file.size)}`;
                progressFill.style.width = '30%';
            }

            progressFill.style.width = '50%';

            // 准备上传数据
            const formData = new FormData();
            formData.append('file', fileToUpload);

            // 如果存在这些元素，则添加到表单
            if (document.getElementById('filename-format')) {
                formData.append('filename', document.getElementById('filename-format').value);
            }
            if (document.getElementById('directory')) {
                formData.append('directory', document.getElementById('directory').value);
            }

            // 上传到服务器
            progressText.textContent = '正在上传到服务器...';

            console.log('开始上传文件', fileToUpload.name);
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            progressFill.style.width = '90%';

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`上传失败 (${response.status}): ${errorText}`);
            }

            const result = await response.json();
            console.log('上传结果:', result);

            progressFill.style.width = '100%';

            // 显示结果
            uploadProgress.classList.add('hidden');
            resultContainer.classList.remove('hidden');

            // 根据文件类型设置预览
            if (previewContainer && previewImage) {
                setupPreview(file, result.src || result.url);
            }

            // 设置URL
            if (directUrl) directUrl.value = result.src || result.url;

            // 根据文件类型设置HTML和Markdown链接
            if (htmlUrl && mdUrl) {
                setupEmbedCodes(file, result.src || result.url);
            }

        } catch (error) {
            console.error('上传错误:', error);
            progressText.textContent = `错误: ${error.message}`;
            progressFill.style.width = '100%';
            progressFill.style.backgroundColor = '#f44336';

            // 添加重试按钮
            const retryBtn = document.createElement('button');
            retryBtn.textContent = '重试';
            retryBtn.className = 'btn-primary';
            retryBtn.style.marginTop = '10px';
            retryBtn.onclick = function() {
                uploadProgress.classList.add('hidden');
                uploadContainer.classList.remove('hidden');
                progressFill.style.backgroundColor = ''; // 重置颜色
                progressFill.style.width = '0%';
            };
            uploadProgress.appendChild(retryBtn);
        }
    }

    // 根据文件类型设置预览
    function setupPreview(file, url) {
        const fileType = file.type;

        // 清除之前的预览
        previewContainer.innerHTML = '';

        if (fileType.startsWith('image/')) {
            // 图片预览
            const img = document.createElement('img');
            img.src = url;
            img.alt = file.name;
            img.className = 'preview-image';
            previewContainer.appendChild(img);
        } else if (fileType.startsWith('video/')) {
            // 视频预览
            const video = document.createElement('video');
            video.src = url;
            video.controls = true;
            video.autoplay = false;
            video.className = 'preview-video';
            previewContainer.appendChild(video);
        } else if (fileType.startsWith('audio/')) {
            // 音频预览
            const audio = document.createElement('audio');
            audio.src = url;
            audio.controls = true;
            audio.className = 'preview-audio';
            previewContainer.appendChild(audio);

            // 添加音频图标
            const audioIcon = document.createElement('div');
            audioIcon.innerHTML = '<i class="fas fa-music" style="font-size: 48px; color: #4361ee; margin-bottom: 10px;"></i>';
            previewContainer.insertBefore(audioIcon, audio);
        } else {
            // 其他文件类型，显示图标
            const fileIcon = document.createElement('div');
            fileIcon.className = 'file-icon';
            fileIcon.innerHTML = getFileTypeIcon(file.type, file.name);

            const fileName = document.createElement('div');
            fileName.className = 'file-name';
            fileName.textContent = file.name;

            previewContainer.appendChild(fileIcon);
            previewContainer.appendChild(fileName);
        }
    }

    // 根据文件类型设置嵌入代码
    function setupEmbedCodes(file, url) {
        const fileType = file.type;

        if (fileType.startsWith('image/')) {
            // 图片嵌入代码
            htmlUrl.value = `<img src="${url}" alt="${file.name}">`;
            mdUrl.value = `![${file.name}](${url})`;
        } else if (fileType.startsWith('video/')) {
            // 视频嵌入代码
            htmlUrl.value = `<video src="${url}" controls></video>`;
            mdUrl.value = `[${file.name}](${url})`;
        } else if (fileType.startsWith('audio/')) {
            // 音频嵌入代码
            htmlUrl.value = `<audio src="${url}" controls></audio>`;
            mdUrl.value = `[${file.name}](${url})`;
        } else {
            // 其他文件类型
            htmlUrl.value = `<a href="${url}">${file.name}</a>`;
            mdUrl.value = `[${file.name}](${url})`;
        }
    }

    // 获取文件类型图标
    function getFileTypeIcon(mimeType, fileName) {
        let iconClass = 'fas fa-file';

        if (!mimeType && !fileName) return `<i class="${iconClass}" style="font-size: 48px; color: #6c757d;"></i>`;

        if (mimeType) {
            if (mimeType.startsWith('image/')) iconClass = 'far fa-image';
            else if (mimeType.startsWith('video/')) iconClass = 'fas fa-film';
            else if (mimeType.startsWith('audio/')) iconClass = 'fas fa-music';
            else if (mimeType.includes('pdf')) iconClass = 'fas fa-file-pdf';
            else if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar'))
                iconClass = 'fas fa-file-archive';
            else if (mimeType.includes('word') || mimeType.includes('document'))
                iconClass = 'fas fa-file-word';
            else if (mimeType.includes('excel') || mimeType.includes('sheet'))
                iconClass = 'fas fa-file-excel';
            else if (mimeType.includes('powerpoint') || mimeType.includes('presentation'))
                iconClass = 'fas fa-file-powerpoint';
            else if (mimeType.includes('text/')) iconClass = 'fas fa-file-alt';
        }

        if (fileName && iconClass === 'fas fa-file') {
            const ext = fileName.split('.').pop().toLowerCase();

            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext))
                iconClass = 'far fa-image';
            else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(ext))
                iconClass = 'fas fa-film';
            else if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext))
                iconClass = 'fas fa-music';
            else if (ext === 'pdf') iconClass = 'fas fa-file-pdf';
            else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext))
                iconClass = 'fas fa-file-archive';
            else if (['doc', 'docx', 'rtf'].includes(ext))
                iconClass = 'fas fa-file-word';
            else if (['xls', 'xlsx', 'csv'].includes(ext))
                iconClass = 'fas fa-file-excel';
            else if (['ppt', 'pptx'].includes(ext))
                iconClass = 'fas fa-file-powerpoint';
            else if (['txt', 'md'].includes(ext))
                iconClass = 'fas fa-file-alt';
            else if (['html', 'htm', 'css', 'js'].includes(ext))
                iconClass = 'fas fa-code';
        }

        return `<i class="${iconClass}" style="font-size: 48px; color: #4361ee;"></i>`;
    }

    // "继续上传"按钮
    if (uploadAnother) {
        uploadAnother.addEventListener('click', () => {
            resultContainer.classList.add('hidden');
            uploadContainer.classList.remove('hidden');
            // 重置文件输入
            fileInput.value = '';
        });
    }

    // 复制到剪贴板
    document.querySelectorAll('[data-clipboard]').forEach(button => {
        button.addEventListener('click', () => {
            const target = document.getElementById(button.dataset.clipboard);
            target.select();
            document.execCommand('copy');

            const originalText = button.textContent;
            button.textContent = '已复制!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        });
    });

    // 辅助函数: 格式化字节大小
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // 添加调试日志
    console.log('页面已加载，上传初始化完成');
    console.log('元素检查:', {
        dropArea: !!dropArea,
        fileInput: !!fileInput,
        selectBtn: !!selectBtn
    });
});
