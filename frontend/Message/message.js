// DOM 元素
const openChatBtn = document.getElementById("openChatBtn");
const chatWindow = document.getElementById("chatWindow");
const backBtn = document.getElementById("backBtn");
const sendBtn = document.getElementById("sendBtn");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");

const bottomUnreadEl = document.getElementById("bottomUnreadCount"); // 底部导航红点
const chatBtnUnreadEl = document.getElementById("chatBtnUnreadCount"); // ⛑︎按钮红点

// 当前聊天订阅
let chatSubscription = null;

// 获取当前用户
function getCurrentUserId() {
  const id = localStorage.getItem("currentUserId");
  return id ? Number(id) : null;
}

// 打开聊天窗口
openChatBtn?.addEventListener("click", async () => {
  const userId = getCurrentUserId();
  if (!userId) { alert("请先登录！"); return; }

  chatWindow.style.display = "flex";
  chatMessages.innerHTML = "";
  await loadMessages();
  listenForMessages();

  await markMessagesAsRead();
  updateUnreadCount();
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
  if (!userId) { alert("请先登录！"); return; }

  const content = chatInput.value.trim();
  if (!content) return;

  const { data, error } = await supabaseClient.from("messages").insert([
    { sender_id: userId, receiver_id: 1, content, is_read: false }
  ]);

  if (error) { console.error(error); alert("发送失败"); return; }

  appendMessage("我", content);
  chatInput.value = "";
});

// 显示消息
function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message-item", sender === "我" ? "me" : "bot");
  msg.textContent = text;
  chatMessages.prepend(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 加载历史消息
async function loadMessages() {
  const userId = getCurrentUserId();
  if (!userId) return;

  const { data, error } = await supabaseClient.from("messages")
    .select("*")
    .or(`and(sender_id.eq.${userId},receiver_id.eq.1),and(sender_id.eq.1,receiver_id.eq.${userId})`)
    .order("created_at", { ascending: true });

  if (error) { console.error(error); return; }
  data.forEach(msg => appendMessage(msg.sender_id === userId ? "我" : "客服", msg.content));
}

// 标记已读
async function markMessagesAsRead() {
  const userId = getCurrentUserId();
  if (!userId) return;
  await supabaseClient.from("messages")
    .update({ is_read: true })
    .eq("receiver_id", userId)
    .eq("is_read", false);
}

// 更新未读红点
async function updateUnreadCount() {
  const userId = getCurrentUserId();
  if (!userId) return;

  const { count, error } = await supabaseClient.from("messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .eq("is_read", false);

  if (error) { console.error(error); return; }

  const openDot = document.querySelector("#openChatBtn .unread-dot");
  if (openDot) openDot.style.display = count > 0 ? "inline-block" : "none", openDot.textContent = count || "";

  if (bottomUnreadEl) bottomUnreadEl.style.display = count > 0 ? "inline-block" : "none", bottomUnreadEl.textContent = count || "";
  if (chatBtnUnreadEl) chatBtnUnreadEl.style.display = count > 0 ? "inline-block" : "none", chatBtnUnreadEl.textContent = count || "";
}

// 实时监听
function listenForMessages() {
  const userId = getCurrentUserId();
  if (!userId) return;

  if (chatSubscription) supabaseClient.removeChannel(chatSubscription);

  chatSubscription = supabaseClient.channel("realtime-messages")
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}`
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

// 复制 Telegram
document.getElementById("copyTelegramBtn")?.addEventListener("click", () => {
  const text = document.getElementById("telegramAccount")?.textContent || "";
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => alert("已复制 Telegram 账号：" + text));
});
