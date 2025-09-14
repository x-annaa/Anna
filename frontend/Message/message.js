// =======================
// DOM 元素
// =======================
const openChatBtn = document.getElementById("openChatBtn");
const chatWindow = document.getElementById("chatWindow");
const backBtn = document.getElementById("backBtn");
const sendBtn = document.getElementById("sendBtn");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");

// 底部导航栏按钮
const messageBtn = document.querySelector('button[data-page="infoPage"]');

// 客服按钮红点
let chatBtnUnreadEl = document.getElementById("chatBtnUnreadCount");
if (!chatBtnUnreadEl) {
  chatBtnUnreadEl = document.createElement("span");
  chatBtnUnreadEl.className = "chat-btn-unread hidden";
  openChatBtn.appendChild(chatBtnUnreadEl);
}

// 创建底部小红点
let bottomUnreadEl = messageBtn.querySelector(".unread-dot");
if (!bottomUnreadEl) {
  bottomUnreadEl = document.createElement("span");
  bottomUnreadEl.className = "unread-dot hidden";
  messageBtn.appendChild(bottomUnreadEl);
}

// 当前聊天订阅
let chatSubscription = null;

// =======================
// 获取当前登录用户 ID
// =======================
function getCurrentUserId() {
  const id = localStorage.getItem("currentUserId");
  return id ? Number(id) : null;
}

// =======================
// 打开聊天窗口
// =======================
openChatBtn.addEventListener("click", async () => {
  const userId = getCurrentUserId();
  if (!userId) return alert("请先登录！");

  chatWindow.style.display = "flex";
  chatMessages.innerHTML = "";
  await loadMessages();
  listenForMessages();

  await markMessagesAsRead();
  updateUnreadCount();
});

// =======================
// 返回按钮关闭窗口
// =======================
backBtn.addEventListener("click", () => {
  chatWindow.style.display = "none";

  if (chatSubscription) {
    supabaseClient.removeChannel(chatSubscription);
    chatSubscription = null;
  }
});

// =======================
// 发送消息
// =======================
sendBtn.addEventListener("click", async () => {
  const userId = getCurrentUserId();
  if (!userId) return alert("请先登录！");

  const content = chatInput.value.trim();
  if (!content) return;

  try {
    const { data, error } = await supabaseClient
      .from("messages")
      .insert([{ sender_id: userId, receiver_id: 1, content, is_read: false }]);

    if (error) return console.error("发送失败:", error);

    appendMessage("我", content);
    chatInput.value = "";
  } catch (err) {
    console.error(err);
  }
});

// =======================
// 显示消息
// =======================
function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message-item");
  msg.classList.add(sender === "我" ? "me" : "bot");
  msg.textContent = text;
  chatMessages.prepend(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// =======================
// 加载历史消息
// =======================
async function loadMessages() {
  const userId = getCurrentUserId();
  if (!userId) return;

  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .or(`and(sender_id.eq.${userId},receiver_id.eq.1),and(sender_id.eq.1,receiver_id.eq.${userId})`)
    .order("created_at", { ascending: true });

  if (error) return console.error("加载消息失败:", error);

  data.forEach(msg => appendMessage(msg.sender_id === userId ? "我" : "客服", msg.content));
}

// =======================
// 标记消息为已读
// =======================
async function markMessagesAsRead() {
  const userId = getCurrentUserId();
  if (!userId) return;

  const { error } = await supabaseClient
    .from("messages")
    .update({ is_read: true })
    .eq("receiver_id", userId)
    .eq("is_read", false);

  if (error) console.error("标记已读失败:", error);
}

// =======================
// 更新红点
// =======================
async function updateUnreadCount() {
  const userId = getCurrentUserId();
  if (!userId) return;

  const { count, error } = await supabaseClient
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .eq("is_read", false);

  if (error) return console.error(error);

  // 底部小红点（不显示数字）
  if (count > 0) bottomUnreadEl.classList.remove("hidden");
  else bottomUnreadEl.classList.add("hidden");

  // 客服按钮红点（显示数字）
  if (count > 0) {
    chatBtnUnreadEl.textContent = count;
    chatBtnUnreadEl.classList.remove("hidden");
  } else {
    chatBtnUnreadEl.classList.add("hidden");
  }
}

// =======================
// 实时监听客服消息
// =======================
function listenForMessages() {
  const userId = getCurrentUserId();
  if (!userId) return;

  if (chatSubscription) supabaseClient.removeChannel(chatSubscription);

  chatSubscription = supabaseClient
    .channel("realtime-messages")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `receiver_id=eq.${userId}`
      },
      async payload => {
        const msg = payload.new;

        // 如果聊天窗口打开，显示消息
        if (chatWindow.style.display === "flex" && msg.sender_id === 1) {
          appendMessage("客服", msg.content);
          await markMessagesAsRead();
        }

        // 更新红点
        updateUnreadCount();
      }
    )
    .subscribe();
}

// =======================
// 页面加载初始化
// =======================
document.addEventListener("DOMContentLoaded", () => {
  updateUnreadCount();
  listenForMessages();
});
