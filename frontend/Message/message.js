// =======================
// DOM 元素
// =======================
const openChatBtn = document.getElementById("openChatBtn");
const chatWindow = document.getElementById("chatWindow");
const backBtn = document.getElementById("backBtn");
const sendBtn = document.getElementById("sendBtn");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");

// 新增红点 badge
let chatBadge = document.getElementById("chatBadge");
if (!chatBadge) {
  chatBadge = document.createElement("span");
  chatBadge.id = "chatBadge";
  chatBadge.style.cssText = `
    position: absolute;
    top: -5px;
    right: -5px;
    background-color: red;
    color: white;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 50%;
    display: none;
    z-index: 1002;
  `;
  openChatBtn.style.position = "relative";
  openChatBtn.appendChild(chatBadge);
}

// 当前聊天订阅
let chatSubscription = null;
let unreadCount = 0;

// =======================
// 获取当前登录用户 ID
// =======================
function getCurrentUserId() {
  const id = localStorage.getItem("currentUserId");
  return id ? Number(id) : null;
}

// =======================
// 播放通知声音
// =======================
function playNotificationSound() {
  const audio = new Audio("/sounds/notify.mp3"); // ⚠️ 需要放置 notify.mp3
  audio.play().catch(err => console.warn("声音播放失败:", err));
}

// =======================
// 更新红点显示
// =======================
function updateUnreadBadge() {
  if (unreadCount > 0) {
    chatBadge.style.display = "inline-block";
    chatBadge.textContent = unreadCount;
  } else {
    chatBadge.style.display = "none";
  }
}

// =======================
// 打开聊天窗口
// =======================
openChatBtn.addEventListener("click", async () => {
  const userId = getCurrentUserId();
  if (!userId) { alert("请先登录！"); return; }

  chatWindow.style.display = "flex";
  chatMessages.innerHTML = "";
  unreadCount = 0;
  updateUnreadBadge();

  await loadMessages();
  listenForMessages();
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
  if (!userId) { alert("请先登录！"); return; }

  const content = chatInput.value.trim();
  if (!content) return;

  try {
    const { data, error } = await supabaseClient
      .from("messages")
      .insert([{ sender_id: userId, receiver_id: 1, content }]);
    if (error) { console.error(error); return; }

    appendMessage("我", content);
    chatInput.value = "";
  } catch (err) {
    console.error("未知错误:", err);
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

  if (error) { console.error(error); return; }

  data.forEach(msg => appendMessage(msg.sender_id === userId ? "我" : "客服", msg.content));
}

// =======================
// 实时监听客服回复
// =======================
async function listenForMessages() {
  const userId = getCurrentUserId();
  if (!userId) return;

  if (chatSubscription) supabaseClient.removeChannel(chatSubscription);

  chatSubscription = supabaseClient
    .channel("realtime-messages")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` },
      payload => {
        const msg = payload.new;
        if (msg.sender_id === 1) appendMessage("客服", msg.content);
        else {
          unreadCount++;
          updateUnreadBadge();
          playNotificationSound();
        }
      }
    )
    .subscribe();
}

// =======================
// 页面初始化
// =======================
updateUnreadBadge();
