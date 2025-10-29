// ==============================
// 📌 DOM 元素获取
// ==============================
const openChatBtn = document.getElementById('openChatBtn');
const chatWindow = document.getElementById('chatWindow');
const closeChatBtn = document.getElementById('closeChatBtn');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const unreadDot = document.querySelector('.unread-dot');
const bottomUnreadDot = document.querySelector('.bottom-unread-dot'); // 底部导航红点

// ==============================
// 📌 未读消息逻辑
// ==============================
let unreadCount = 0;

// 显示客服红点
function showUnreadDot() {
  unreadDot.style.display = 'inline-block';
  unreadDot.classList.add('show');
  unreadDot.textContent = unreadCount;
}

// 隐藏客服红点
function hideUnreadDot() {
  unreadDot.style.display = 'none';
  unreadDot.classList.remove('show');
  unreadCount = 0;
}

// 显示底部红点
function showBottomDot() {
  if (!bottomUnreadDot) return;
  bottomUnreadDot.style.display = 'block';
  bottomUnreadDot.classList.remove('show'); // 重置动画
  void bottomUnreadDot.offsetWidth;         // 重新触发动画
  bottomUnreadDot.classList.add('show');
}

// 隐藏底部红点
function hideBottomDot() {
  if (!bottomUnreadDot) return;
  bottomUnreadDot.style.display = 'none';
  bottomUnreadDot.classList.remove('show');
}

// ==============================
// 📌 聊天窗口控制
// ==============================

// 打开聊天窗口
if (openChatBtn) {
  openChatBtn.addEventListener('click', () => {
    chatWindow.style.display = 'flex';
    hideUnreadDot();   // 清除红点
    hideBottomDot();   // 同时清除底部红点
  });
}

// 关闭聊天窗口
if (closeChatBtn) {
  closeChatBtn.addEventListener('click', () => {
    chatWindow.style.display = 'none';
  });
}

// ==============================
// 📌 聊天发送功能
// ==============================
if (sendChatBtn) {
  sendChatBtn.addEventListener('click', sendMessage);
}
if (chatInput) {
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  appendMessage(text, 'me');
  chatInput.value = '';

  // 模拟客服回复
  setTimeout(() => {
    appendMessage('Hello! How can I help you?', 'bot');
  }, 800);
}

// ==============================
// 📌 消息显示函数
// ==============================
function appendMessage(text, type) {
  const msg = document.createElement('div');
  msg.classList.add('message-item', type);
  msg.textContent = text;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // 如果聊天窗口未打开，增加未读数
  if (chatWindow.style.display === 'none' && type === 'bot') {
    unreadCount++;
    showUnreadDot();
    showBottomDot();
  }
}

// ==============================
// 📌 Telegram 复制按钮
// ==============================
const copyTelegramBtn = document.getElementById('copyTelegramBtn');
const telegramAccount = document.getElementById('telegramAccount');
if (copyTelegramBtn && telegramAccount) {
  copyTelegramBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(telegramAccount.textContent.trim())
      .then(() => {
        copyTelegramBtn.textContent = '已复制 ✓';
        setTimeout(() => (copyTelegramBtn.textContent = '复制'), 1500);
      });
  });
}

// ==============================
// ✅ 调试日志
// ==============================
console.log('✅ about.js 已加载完毕');
