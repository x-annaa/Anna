// ======================
// 当前用户 ID
// ======================
const currentUserId = localStorage.getItem("currentUserId");
const messageList = document.getElementById("messageList");

// ======================
// 页面初始化
// ======================
document.addEventListener("DOMContentLoaded", () => {
  if (!currentUserId) return;

  loadMessages();        // 加载历史消息
  setupChatListener();   // 监听新消息
});

// ======================
// 加载历史消息
// ======================
async function loadMessages() {
  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .eq("user_id", currentUserId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("加载消息失败：", error.message);
    return;
  }

  messageList.innerHTML = ""; // 清空
  data.forEach(msg => addMessageCard(msg));
}

// ======================
// 添加单条消息
// ======================
function addMessageCard(msg) {
  const div = document.createElement("div");
  div.classList.add("message-card");

  // 系统消息（提现）
  if (msg.type === "withdraw") {
    div.innerHTML = `
      <div class="message-system">
        <p class="withdraw-text">💬 ${msg.content}</p>
        <p>提交余额：${msg.amount.toFixed(2)}</p>
        <p>提交时间：${new Date(msg.created_at).toLocaleString()}</p>
      </div>
    `;
  } 
  // 用户/客服聊天
  else {
    div.classList.add(msg.sender === "user" ? "message-user" : "message-cs");
    div.innerHTML = `<p>${msg.content}</p>
                     <span class="msg-time">${new Date(msg.created_at).toLocaleTimeString()}</span>`;
  }

  messageList.appendChild(div);
  messageList.scrollTop = messageList.scrollHeight; // 自动滚动到底
}

// ======================
// 提供给 me.js 调用：提现消息
// ======================
window.addMessageCard = async function(amount) {
  if (!currentUserId) return;

  const { data, error } = await supabaseClient
    .from("messages")
    .insert([{
      user_id: currentUserId,
      sender: "system",
      type: "withdraw",
      content: "您的提现正在进行中。。。。请稍等",
      amount: amount,
      status: "pending"
    }])
    .select(); // 返回插入的数据

  if (error) {
    console.error("生成提现消息失败：", error.message);
    return;
  }

  addMessageCard(data[0]);
}

// ======================
// 用户聊天功能
// ======================
const chatInput = document.createElement("input");
chatInput.id = "chatInput";
chatInput.placeholder = "输入消息...";
const chatSendBtn = document.createElement("button");
chatSendBtn.id = "chatSendBtn";
chatSendBtn.textContent = "发送";
messageList.parentNode.appendChild(chatInput);
messageList.parentNode.appendChild(chatSendBtn);

chatSendBtn.addEventListener("click", async () => {
  const content = chatInput.value.trim();
  if (!content) return;

  const { data, error } = await supabaseClient
    .from("messages")
    .insert([{
      user_id: currentUserId,
      sender: "user",
      content: content,
      type: "chat"
    }])
    .select();

  if (error) return console.error("发送消息失败：", error.message);

  addMessageCard(data[0]);
  chatInput.value = "";
});

// ======================
// 监听客服或系统推送消息（可用 supabase Realtime）
// ======================
function setupChatListener() {
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
