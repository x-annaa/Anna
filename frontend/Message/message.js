// ======================
// 当前用户 ID
// ======================
let currentUserId = localStorage.getItem("currentUserId");

// ======================
// 获取容器
// ======================
const messageList = document.getElementById("messageList");
const chatMessages = document.createElement("div");
chatMessages.className = "chat-list";
messageList.parentNode.insertBefore(chatMessages, messageList.nextSibling);

const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");

// ======================
// 添加系统消息
// ======================
function addSystemMessage(msg) {
  const card = document.createElement("div");
  card.className = "message-card";
  card.innerHTML = `
    <h4>提交信息</h4>
    <p>提交审核中。。。</p>
    <p>提交余额：${msg.amount.toFixed(2)}</p>
    <p>提交时间：${new Date(msg.created_at).toLocaleString()}</p>
    <p style="font-weight:bold; color:#f00;">${msg.content}</p>
  `;
  messageList.prepend(card);
}

// ======================
// 添加聊天消息
// ======================
function addChatMessage(msg) {
  const chat = document.createElement("div");
  chat.className = `chat-message ${msg.sender === 'user' ? 'user' : 'support'}`;
  chat.textContent = msg.content;
  chatMessages.appendChild(chat);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ======================
// 加载历史消息
// ======================
async function loadMessages() {
  if (!currentUserId) return;

  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .eq("user_id", currentUserId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("加载消息失败：", error.message);
    return;
  }

  data.forEach(msg => {
    if (msg.type === "withdraw") addSystemMessage(msg);
    if (msg.type === "chat") addChatMessage(msg);
  });
}

// ======================
// 发送聊天消息
// ======================
sendChatBtn.addEventListener("click", async () => {
  const text = chatInput.value.trim();
  if (!text) return;

  const { data, error } = await supabaseClient
    .from("messages")
    .insert([{
      user_id: currentUserId,
      sender: "user",
      type: "chat",
      content: text
    }]);

  if (error) {
    alert("发送消息失败：" + error.message);
    return;
  }

  addChatMessage({ sender: "user", content: text });
  chatInput.value = "";
});

// ======================
// 前端监听提交提现消息
// ======================
// 可以在 me.js 提交提现成功后调用：
window.addMessageCard = async function(amount) {
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
    .select(); // 返回插入数据

  if (error) {
    console.error("生成提现消息失败：", error.message);
    return;
  }

  addSystemMessage(data[0]);
}

// ======================
// 初始化
// ======================
document.addEventListener("DOMContentLoaded", () => {
  loadMessages();
});
