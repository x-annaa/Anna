// DOM 元素
const openChatBtn = document.getElementById("openChatBtn");
const chatWindow = document.getElementById("chatWindow");
const backBtn = document.getElementById("backBtn");
const sendBtn = document.getElementById("sendBtn");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");

// 获取当前登录用户 id
function getCurrentUserId() {
  const id = localStorage.getItem("currentUserId");
  return id ? Number(id) : null;
}

// 打开聊天窗口
openChatBtn.addEventListener("click", async () => {
  const userId = getCurrentUserId();
  if (!userId) {
    alert("请先登录！");
    return;
  }

  chatWindow.classList.remove("hidden");
  chatMessages.innerHTML = ""; // 清空旧消息
  await loadMessages();        // 加载历史消息
  listenForMessages();         // 开启实时监听
});

// 返回按钮
backBtn.addEventListener("click", () => {
  chatWindow.classList.add("hidden");
  if (chatSubscription) {
    supabaseClient.removeChannel(chatSubscription);
    chatSubscription = null;
  }
});

// 发送消息
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
          receiver_id: 1, // 客服固定 id
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

// 显示消息
function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message-item");
  msg.textContent = `${sender}: ${text}`;
  chatMessages.appendChild(msg);
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

  if (error) {
    console.error("加载消息失败:", error);
    return;
  }

  data.forEach(msg => {
    appendMessage(msg.sender_id === userId ? "我" : "客服", msg.content);
  });
}

// 实时监听客服回复
let chatSubscription = null;
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
        filter: `receiver_id=eq.${userId}`
      },
      (payload) => {
        const msg = payload.new;
        if (msg.sender_id === 1) {
          appendMessage("客服", msg.content);
        }
      }
    )
    .subscribe();
}

function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message-item");

  if (sender === "我") {
    msg.classList.add("me");
  } else {
    msg.classList.add("bot");
  }

  msg.textContent = text;
  chatMessages.prepend(msg); // 因为 flex-direction: column-reverse，所以 prepend 显示在底部
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
