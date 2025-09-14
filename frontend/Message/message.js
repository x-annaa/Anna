// 打开/关闭聊天窗口
const openChatBtn = document.getElementById("openChatBtn");
const chatWindow = document.getElementById("chatWindow");
const backBtn = document.getElementById("backBtn");

openChatBtn.addEventListener("click", () => {
  chatWindow.classList.remove("hidden");
});

backBtn.addEventListener("click", () => {
  chatWindow.classList.add("hidden");
});

// 发送消息
const sendBtn = document.getElementById("sendBtn");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");

sendBtn.addEventListener("click", async () => {
  const content = chatInput.value.trim();
  if (!content) return;

  const user = (await supabase.auth.getUser()).data.user;
  if (!user) {
    alert("请先登录！");
    return;
  }

  // 插入消息到数据库
  const { error } = await supabase
    .from("messages")
    .insert([
      {
        sender_id: user.id,   // 当前用户
        receiver_id: 1,       // 客服
        content: content
      }
    ]);

  if (error) {
    console.error("发送失败:", error);
    return;
  }

  // 本地显示
  appendMessage("我", content);
  chatInput.value = "";
});

// 添加消息到窗口
function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.textContent = `${sender}: ${text}`;
  msg.classList.add("message-item");
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
