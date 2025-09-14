// =======================
// DOM 元素
// =======================
const openChatBtn = document.getElementById("openChatBtn");
const chatWindow = document.getElementById("chatWindow");
const backBtn = document.getElementById("backBtn");
const sendBtn = document.getElementById("sendBtn");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");

// 当前聊天订阅
let chatSubscription = null;

// =======================
// 未读消息状态
// =======================
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
  const audio = new Audio("/sounds/notify.mp3"); // ⚠️ 需自行放置 notify.mp3
  audio.play().catch(err => console.warn("通知音播放失败:", err));
}

// =======================
// 更新红点显示
// =======================
function updateUnreadBadge() {
  const badge = document.getElementById("chatBadge");
  if (!badge) return;

  if (unreadCount > 0) {
    badge.style.display = "inline-block";
    badge.textContent = unreadCount;
  } else {
    badge.style.display = "none";
  }
}

// =======================
// 打开聊天窗口
// =======================
openChatBtn.addEventListener("click", async () => {
  const userId = getCurrentUserId();
  if (!userId) {
    alert("请先登录！");
    return;
  }

  chatWindow.style.display = "flex";    // 显示窗口
  chatMessages.innerHTML = "";           // 清空消息
  unreadCount = 0;                        // 清空未读
  updateUnreadBadge();

  await loadMessages();                  // 加载历史消息
  listenForMessages();                   // 开启实时监听
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
  if (!userId) {
    alert("请先登录！");
    return;
  }

  const content = chatInput.value.trim();
  if (!content) return;

  try {
    const { data, error } = await supabaseClient
      .from("messages")
      .insert([
        {
          sender_id: userId,
          receiver_id: 1, // 客服固定ID
          content: content
        }
      ]);

    if (error) {
      console.error("发送失败:", error);
      alert("发送失败！");
      return;
    }

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
  chatMessages.prepend(msg); // flex-direction: column-reverse
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

  if (error) {
    console.error("加载消息失败:", error);
    return;
  }

  data.forEach(msg => {
    appendMessage(msg.sender_id === userId ? "我" : "客服", msg.content);
  });
}

// =======================
// 实时监听客服回复
// =======================
async function listenForMessages() {
  const userId = getCurrentUserId();
  if (!userId) return;

  if (chatSubscription) {
    supabaseClient.removeChannel(chatSubscription);
  }

  chatSubscription = supabaseClient
    .channel("realtime-messages")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `receiver_id=eq.${userId}` // 收到客服消息
      },
      (payload) => {
        const msg = payload.new;

        if (msg.sender_id === 1) {
          // 当前窗口显示消息
          appendMessage("客服", msg.content);
        } else {
          // 新消息未读
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
