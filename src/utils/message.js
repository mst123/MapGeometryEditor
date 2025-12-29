/**
 * 原生消息提示工具
 * 不依赖任何框架，纯JavaScript实现
 */

/**
 * 显示消息提示
 * @param {string} message - 提示消息
 * @param {string} type - 消息类型: 'success' | 'error' | 'warning' | 'info'
 * @param {number} duration - 显示时长（毫秒），默认3000ms
 */
export function showMessage(message, type = 'info', duration = 3000) {
  // 创建消息容器
  const messageBox = document.createElement('div')
  messageBox.className = `message-box message-${type}`
  
  // 设置样式
  Object.assign(messageBox.style, {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '12px 24px',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    zIndex: '9999',
    fontSize: '14px',
    lineHeight: '1.5',
    maxWidth: '400px',
    wordBreak: 'break-word',
    animation: 'messageSlideIn 0.3s ease-out',
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  })

  // 根据类型设置颜色
  const colors = {
    success: { bg: '#f0f9ff', border: '#52c41a', text: '#389e0d', icon: '✓' },
    error: { bg: '#fff2f0', border: '#ff4d4f', text: '#cf1322', icon: '✕' },
    warning: { bg: '#fffbe6', border: '#faad14', text: '#d46b08', icon: '⚠' },
    info: { bg: '#e6f7ff', border: '#1890ff', text: '#0958d9', icon: 'ℹ' }
  }

  const color = colors[type] || colors.info
  messageBox.style.backgroundColor = color.bg
  messageBox.style.border = `1px solid ${color.border}`
  messageBox.style.color = color.text

  // 添加图标
  const icon = document.createElement('span')
  icon.textContent = color.icon
  icon.style.fontWeight = 'bold'
  messageBox.appendChild(icon)

  // 添加消息文本
  const text = document.createElement('span')
  text.textContent = message
  messageBox.appendChild(text)

  // 添加到页面
  document.body.appendChild(messageBox)

  // 添加动画样式（如果还没有）
  if (!document.getElementById('message-animations')) {
    const style = document.createElement('style')
    style.id = 'message-animations'
    style.textContent = `
      @keyframes messageSlideIn {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
      @keyframes messageSlideOut {
        from {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        to {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }
      }
    `
    document.head.appendChild(style)
  }

  // 自动移除
  const timer = setTimeout(() => {
    messageBox.style.animation = 'messageSlideOut 0.3s ease-out'
    setTimeout(() => {
      if (messageBox.parentNode) {
        messageBox.parentNode.removeChild(messageBox)
      }
    }, 300)
  }, duration)

  // 点击关闭
  messageBox.addEventListener('click', () => {
    clearTimeout(timer)
    messageBox.style.animation = 'messageSlideOut 0.3s ease-out'
    setTimeout(() => {
      if (messageBox.parentNode) {
        messageBox.parentNode.removeChild(messageBox)
      }
    }, 300)
  })

  return messageBox
}

/**
 * 快捷方法
 */
export const message = {
  success: (msg, duration) => showMessage(msg, 'success', duration),
  error: (msg, duration) => showMessage(msg, 'error', duration),
  warning: (msg, duration) => showMessage(msg, 'warning', duration),
  info: (msg, duration) => showMessage(msg, 'info', duration)
}

