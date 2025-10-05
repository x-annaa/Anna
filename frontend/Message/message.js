// DOM 元素
const openChatBtn = document.getElementById("openChatBtn");
const chatWindow = document.getElementById("chatWindow");
const backBtn = document.getElementById("backBtn");
const sendBtn = document.getElementById("sendBtn");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");

const bottomUnreadEl = document.getElementById("bottomUnreadCount"); 
const chatBtnUnreadEl = document.getElementById("chatBtnUnreadCount"); 

let chatSubscription = null;

function getCurrentUserId() {
  const id = localStorage.getItem("currentUserId");
  return id ? Number(id) : null;
}

// 自动调整 textarea 高度
chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = chatInput.scrollHeight + "px";
  scrollToBottom();
});

// 打开聊天窗口
openChatBtn?.addEventListener("click", async () => {
  const userId = getCurrentUserId();
  if (!userId) return alert("请先登录！");
  chatWindow.style.display = "flex";
  chatMessages.innerHTML = "";
  await loadMessages();
  listenForMessages();
  await markMessagesAsRead();
  updateUnreadCount();
  scrollToBottom();
});

// 返回按钮
backBtn?.addEventListener("click", () => {
  chatWindow.style.display = "none";
  if (chatSubscription) {
    supabaseClient.removeChannel(chatSubscription);
    chatSubscription = null;
  }
});

// 发送消息
sendBtn?.addEventListener("click", async () => {
  const userId = getCurrentUserId();
  if (!userId) return alert("请先登录！");
  const content = chatInput.value.trim();
  if (!content) return;
  const { error } = await supabaseClient.from("messages").insert([
    { sender_id: userId, receiver_id: 1, content, is_read: false }
  ]);
  if (error) return alert("发送失败");
  appendMessage("我", content);
  chatInput.value = "";
  chatInput.style.height = "auto";
  scrollToBottom();
});

// 显示消息
function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message-item", sender === "我" ? "me" : "bot");
  msg.textContent = text;
  chatMessages.prepend(msg);
  scrollToBottom();
}

// 滚动到底部
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 加载历史消息
async function loadMessages() {
  const userId = getCurrentUserId();
  if (!userId) return;
  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .or(`and(sender_id.eq.${userId},receiver_id.eq.1),and(sender_id.eq.1,receiver_id.eq.${userId})`)
    .order("created_at", { ascending: true });
  if (error) return console.error(error);
  data.forEach(msg =>
    appendMessage(msg.sender_id === userId ? "我" : "客服", msg.content)
  );
}

// 标记为已读
async function markMessagesAsRead() {
  const userId = getCurrentUserId();
  if (!userId) return;
  await supabaseClient
    .from("messages")
    .update({ is_read: true })
    .eq("receiver_id", userId)
    .eq("is_read", false);
}

// 更新红点显示
async function updateUnreadCount() {
  const userId = getCurrentUserId();
  if (!userId) return;
  const { count, error } = await supabaseClient
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .eq("is_read", false);
  if (error) return console.error(error);
  const unread = count || 0;
  const show = unread > 0;
  const text = unread > 99 ? "99+" : unread;
  [bottomUnreadEl, chatBtnUnreadEl, document.querySelector("#openChatBtn .unread-dot")].forEach(el => {
    if (!el) return;
    el.textContent = text;
    el.style.display = show ? "inline-block" : "none";
  });
}

// 监听实时消息
function listenForMessages() {
  const userId = getCurrentUserId();
  if (!userId) return;
  if (chatSubscription) supabaseClient.removeChannel(chatSubscription);
  chatSubscription = supabaseClient.channel("realtime-messages")
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `receiver_id=eq.${userId}`
    }, async payload => {
      const msg = payload.new;
      if (msg.sender_id === 1 && chatWindow.style.display === "flex") {
        appendMessage("客服", msg.content);
        await markMessagesAsRead();
      }
      updateUnreadCount();
    })
    .subscribe();
}

// 页面加载初始化
document.addEventListener("DOMContentLoaded", () => {
  updateUnreadCount();
  listenForMessages();
});

// Telegram 一键复制
document.getElementById("copyTelegramBtn")?.addEventListener("click", () => {
  const text = document.getElementById("telegramAccount")?.textContent || "";
  if (!text) return;
  navigator.clipboard.writeText(text).then(() =>
    alert("已复制 Telegram 账号：" + text)
  );
});

// 手机键盘兼容
function adjustChatForKeyboard() {
  if (!chatWindow) return;

  // iOS 和 Android 都会触发 resize
  window.addEventListener('resize', () => {
    const vh = window.innerHeight;
    chatWindow.style.maxHeight = vh * 0.8 + "px"; // 聊天窗口不超过屏幕高度80%
    scrollToBottom();
  });
}

// 初始化
adjustChatForKeyboard();
