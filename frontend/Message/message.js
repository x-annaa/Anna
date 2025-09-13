// ======================
// MESSAGE 聊天逻辑
// ======================

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

// 默认隐藏聊天窗口
chatModal.style.display = "none";

// 打开聊天窗口
chatAvatar.addEventListener("click", () => {
  chatModal.style.display = "flex";
  loadMessages();
});

// 关闭聊天窗口
closeChatBtn.addEventListener("click", () => {
  chatModal.style.display = "none";
});

// 文件上传 + 消息发送
sendBtn.addEventListener("click", async () => {
  const text = messageInput.value.trim();
  const file = fileInput.files[0];

  if (!text && !file) {
    alert("请输入消息或选择文件");
    return;
  }

  let fileUrl = null;
  if (file) {
    // 文件名安全化
    const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-_]/g,"_")}`;
    try {
      const { error: uploadError } = await supabaseClient.storage
        .from("Chat")
        .upload(safeFileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabaseClient.storage
        .from("Chat")
        .getPublicUrl(safeFileName);

      fileUrl = publicUrlData.publicUrl;
    } catch (err) {
      console.error("文件上传失败", err);
      alert("文件上传失败: " + err.message);
      return;
    }
  }

  // 插入消息
  const { error } = await supabaseClient.from("messages").insert([
    {
      sender_id: currentUserId,
      receiver_id: CUSTOMER_SERVICE_ID,
      content: text || null,
      file_url: fileUrl || null
    }
  ]);

  if (error) {
    alert("发送失败: " + error.message);
    return;
  }

  messageInput.value = "";
  fileInput.value = "";
  loadMessages();
});

// 加载消息
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
  data.forEach(msg => {
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

  messageList.scrollTop = messageList.scrollHeight;
}

// 自动刷新
setInterval(loadMessages, 3000);
