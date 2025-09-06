// ======================
// 当前用户 ID
// ======================
const currentUserId = Number(localStorage.getItem("currentUserId"));
const messageList = document.getElementById("messageList");

// ======================
// 页面初始化
// ======================
document.addEventListener("DOMContentLoaded", async () => {
  if (!currentUserId) return;

  // 加载历史消息
  await loadMessages();

  // 设置聊天发送按钮
  setupChatSend();

  // 监听数据库新增消息（Realtime）
  setupRealtimeListener();
});

// ======================
// 加载历史消息
// ======================
async function loadMessages() {
  try {
    const { data, error } = await supabaseClient
      .from("messages")
      .select("*")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("加载消息失败：", error.message);
      return;
    }

    messageList.innerHTML = ""; // 清空容器
    data.forEach(msg => addMessageCard(msg));
  } catch (e) {
    console.error("加载消息异常：", e);
  }
}

// ======================
// 渲染单条消息
// ======================
function addMessageCard(msg) {
  const div = document.createElement("div");
  div.classList.add("message-card");

  if (msg.type === "withdraw") {
    // 系统提现消息
    div.innerHTML = `
      <div class="message-system">
        <p class="withdraw-text">💬 ${msg.content}</p>
        <p>提交余额：${msg.amount?.toFixed(2) || 0}</p>
        <p>提交时间：${new Date(msg.created_at).toLocaleString()}</p>
      </div>
    `;
  } else {
    // 用户或客服聊天消息
    div.classList.add(msg.sender === "user" ? "message-user" : "message-cs");
    div.innerHTML = `
      <p>${msg.content}</p>
      <span class="msg-time">${new Date(msg.created_at).toLocaleTimeString()}</span>
    `;
  }

  messageList.appendChild(div);
  messageList.scrollTop = messageList.scrollHeight;
}

// ======================
// 提现消息（系统消息）
// me.js 提交提现后调用
// ======================
window.addWithdrawMessage = async function(amount) {
  if (!currentUserId) return;

  try {
    const { data, error } = await supabaseClient
      .from("messages")
      .insert([{
        user_id: currentUserId,
        sender: "system",
        type: "withdraw",
        content: "您的提现正在进行中。。。。请稍等",
        amount: parseFloat(amount),
        status: "pending"
      }])
      .select();

    if (error) {
      console.error("生成提现消息失败：", error.message);
      return;
    }

    addMessageCard(data[0]);
  } catch (e) {
    console.error("生成提现消息异常：", e);
  }
};

// ======================
// 用户聊天发送
// HTML 必须有 #chatInput 和 #chatSendBtn
// ======================
function setupChatSend() {
  const chatInput = document.getElementById("chatInput");
  const chatSendBtn = document.getElementById("chatSendBtn");

  if (!chatInput || !chatSendBtn) return;

  chatSendBtn.addEventListener("click", async () => {
    const content = chatInput.value.trim();
    if (!content) return;

    try {
      const { data, error } = await supabaseClient
        .from("messages")
        .insert([{
          user_id: currentUserId,
          sender: "user",
          type: "chat",
          content: content
        }])
        .select();

      if (error) return console.error("发送消息失败：", error.message);

      addMessageCard(data[0]);
      chatInput.value = "";
    } catch (e) {
      console.error("发送消息异常：", e);
    }
  });

  // 支持回车发送
  chatInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") chatSendBtn.click();
  });
}

// ======================
// 实时监听数据库消息
// ======================
function setupRealtimeListener() {
  supabaseClient
    .channel(`public:messages:user_id=eq.${currentUserId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `user_id=eq.${currentUserId}` },
      (payload) => {
        addMessageCard(payload.new);
      }
    )
    .subscribe();
}
