// =====================
// DOM 元素
// =====================
const openChatBtn = document.getElementById("openChatBtn");
const chatWindow = document.getElementById("chatWindow");
const backBtn = document.getElementById("backBtn");
const sendBtn = document.getElementById("sendBtn");
const chatInput = document.getElementById("chatInput"); // textarea
const chatMessages = document.getElementById("chatMessages");

const bottomUnreadEl = document.getElementById("bottomUnreadCount");
const chatBtnUnreadEl = document.getElementById("chatBtnUnreadCount");

let chatSubscription = null;

// =====================
// 获取当前用户 ID
// =====================
function getCurrentUserId() {
  const id = localStorage.getItem("currentUserId");
  return id ? Number(id) : null;
}

// =====================
// 自动增高 textarea
// =====================
chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = chatInput.scrollHeight + "px";
  scrollToBottom();
});

// =====================
// 打开聊天窗口
// =====================
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

// =====================
// 返回按钮
// =====================
backBtn?.addEventListener("click", () => {
  chatWindow.style.display = "none";
  if (chatSubscription) {
    supabaseClient.removeChannel(chatSubscription);
    chatSubscription = null;
  }
});

// =====================
// 发送消息
// =====================
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

// =====================
// 显示消息
// =====================
function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message-item", sender === "我" ? "me" : "bot");
  msg.innerHTML = text.replace(/\n/g, "<br>");
  chatMessages.prepend(msg);
  scrollToBottom();
}

// =====================
// 滚动到底部
// =====================
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// =====================
// 加载历史消息
// =====================
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

// =====================
// 标记为已读
// =====================
async function markMessagesAsRead() {
  const userId = getCurrentUserId();
  if (!userId) return;

  await supabaseClient
    .from("messages")
    .update({ is_read: true })
    .eq("receiver_id", userId)
    .eq("is_read", false);
}

// =====================
// 更新红点显示
// =====================
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

// =====================
// 监听实时消息
// =====================
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

// =====================
// 页面加载初始化
// =====================
document.addEventListener("DOMContentLoaded", () => {
  updateUnreadCount();
  listenForMessages();
});

// =====================
// Telegram 一键复制
// =====================
document.getElementById("copyTelegramBtn")?.addEventListener("click", () => {
  const text = document.getElementById("telegramAccount")?.textContent || "";
  if (!text) return;
  navigator.clipboard.writeText(text).then(() =>
    alert("已复制 Telegram 账号：" + text)
  );
});

// =====================
// 手机键盘兼容
// =====================
function adjustChatForKeyboard() {
  if (!chatWindow) return;

  let initialHeight = window.innerHeight;

  window.addEventListener('resize', () => {
    const vh = window.innerHeight;
    const keyboardHeight = initialHeight - vh;

    if (keyboardHeight > 100) {
      // 键盘弹出：窗口底部贴近键盘
      chatWindow.style.top = 'auto';
      chatWindow.style.bottom = '0';
      chatWindow.style.transform = 'translateX(-50%)';
    } else {
      // 键盘收回：居中
      chatWindow.style.top = '50%';
      chatWindow.style.bottom = 'auto';
      chatWindow.style.transform = 'translate(-50%, -50%)';
    }

    scrollToBottom();
  });
}

// 调整 textarea 高度和滚动
chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = chatInput.scrollHeight + "px";
  scrollToBottom();
});

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 初始化
adjustChatForKeyboard();
