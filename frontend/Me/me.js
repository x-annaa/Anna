// ======================
// MESSAGE 聊天逻辑
// ======================

// 固定客服 ID（你在数据库里插入客服账号时记住它的 id）
const CUSTOMER_SERVICE_ID = 1;

let currentUserId = localStorage.getItem("currentUserId");
let currentUsername = localStorage.getItem("currentUser");

// DOM 元素
const chatAvatar = document.getElementById("chatAvatar");
const chatModal = document.getElementById("chatModal");
const closeChatBtn = document.getElementById("closeChat");
const messageList = document.getElementById("messageList");
const messageInput = document.getElementById("messageInput");
const fileInput = document.getElementById("fileInput");
const sendBtn = document.getElementById("sendBtn");

// 打开聊天窗口
chatAvatar.addEventListener("click", () => {
  chatModal.style.display = "flex";
  loadMessages();
});

// 关闭聊天窗口
closeChatBtn.addEventListener("click", () => {
  chatModal.style.display = "none";
});

// 加载历史消息
async function loadMessages() {
  if (!currentUserId) return;

  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("加载消息失败:", error.message);
    return;
  }

  messageList.innerHTML = "";
  data.forEach((msg) => {
    const li = document.createElement("li");
    li.classList.add("message", msg.sender_id == currentUserId ? "sent" : "received");
    li.innerHTML = `
      <div class="msg-content">
        ${msg.content ? `<p>${msg.content}</p>` : ""}
        ${msg.file_url ? `<a href="${msg.file_url}" target="_blank">📎 文件</a>` : ""}
      </div>
      <span class="msg-time">${new Date(msg.created_at).toLocaleTimeString()}</span>
    `;
    messageList.appendChild(li);
  });

  // 滚动到底部
  messageList.scrollTop = messageList.scrollHeight;
}

// 发送消息
sendBtn.addEventListener("click", async () => {
  const text = messageInput.value.trim();
  const file = fileInput.files[0];

  if (!text && !file) {
    alert("请输入消息或选择文件");
    return;
  }

  let fileUrl = null;

  if (file) {
    // 上传文件到 Supabase Storage (需要在 supabase 上建个 bucket: "chat-files")
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error: uploadError } = await supabaseClient.storage
      .from("chat-files")
      .upload(fileName, file);

    if (uploadError) {
      alert("文件上传失败: " + uploadError.message);
      return;
    }

    const { data: publicUrl } = supabaseClient.storage.from("chat-files").getPublicUrl(fileName);
    fileUrl = publicUrl.publicUrl;
  }

  // 插入数据库
  const { error } = await supabaseClient.from("messages").insert([
    {
      sender_id: currentUserId,
      receiver_id: CUSTOMER_SERVICE_ID,
      content: text || null,
      file_url: fileUrl || null,
    },
  ]);

  if (error) {
    alert("发送失败: " + error.message);
    return;
  }

  messageInput.value = "";
  fileInput.value = "";
  loadMessages();
});

// 每 3 秒刷新一次
setInterval(loadMessages, 3000);
