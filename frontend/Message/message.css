/* =====================
   聊天窗口整体
   ===================== */
#chatWindow {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 360px;
  height: 500px; /* 固定高度 */
  background-color: #f8f8f8;
  border: 1px solid #ddd;
  border-radius: 12px;
  display: none; /* 默认隐藏 */
  flex-direction: column;
  overflow: hidden; /* 不让窗口随消息增长 */
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
  z-index: 1000;
  font-family: "Helvetica", sans-serif;
}

/* 聊天顶部 */
.chat-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  background-color: #4e9cff;
  color: white;
  padding: 10px 12px;
  font-weight: bold;
  font-size: 16px;
}

.chat-header button {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 16px;
  margin-right: 10px;
}

/* 消息列表 */
#chatMessages {
  flex: 1 1 auto;           /* 占据剩余空间 */
  padding: 10px;
  display: flex;
  flex-direction: column-reverse; /* 消息从下往上显示 */
  overflow-y: auto;         /* 超出部分滚动 */
  gap: 6px;
  background-color: #f0f0f0;
}

/* 单条消息 */
.message-item {
  max-width: 70%;
  padding: 8px 12px;
  border-radius: 16px;
  word-wrap: break-word;
  font-size: 14px;
  line-height: 1.4;
  display: inline-block;
}

/* 我发送的消息 */
.message-item.me {
  background-color: #4e9cff;
  color: white;
  align-self: flex-end;
  border-bottom-right-radius: 4px;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  border-bottom-left-radius: 16px;
}

/* 客服消息 */
.message-item.bot {
  background-color: #e0e0e0;
  color: #333;
  align-self: flex-start;
  border-bottom-left-radius: 4px;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  border-bottom-right-radius: 16px;
}

/* 输入框区域 */
.chat-input {
  flex: 0 0 auto;          /* 高度固定 */
  display: flex;
  padding: 8px;
  border-top: 1px solid #ddd;
  background-color: #fafafa;
}

.chat-input input {
  flex: 1;
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid #ccc;
  outline: none;
  font-size: 14px;
}

.chat-input button {
  margin-left: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  border: none;
  background-color: #4e9cff;
  color: white;
  cursor: pointer;
  font-weight: bold;
}

/* =====================
   客服按钮固定在右上角
   ===================== */
#openChatBtn {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  background-color: #4e9cff;
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 24px;
  cursor: pointer;
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 底部导航栏按钮固定尺寸 */
.bottom-nav button {
  position: relative;       /* 红点绝对定位的基准 */
  min-width: 60px;
  height: 50px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* =====================
   红点样式（绝对定位）
   ===================== */
.unread-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  display: inline-block;
  background-color: red;
  color: white;
  border-radius: 50%;
  font-size: 12px;
  padding: 2px 6px;
  line-height: 1;
  pointer-events: none;  /* 不阻挡按钮点击 */
}

.hidden {
  display: none;
}

/* =====================
   滚动条美化
   ===================== */
#chatMessages::-webkit-scrollbar {
  width: 6px;
}
#chatMessages::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.2);
  border-radius: 3px;
}
