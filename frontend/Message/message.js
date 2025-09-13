// ===== MESSAGE 简化版 =====
const CUSTOMER_SERVICE_ID = 1;

let currentUserId = localStorage.getItem("currentUserId");
let currentUsername = localStorage.getItem("currentUser");

// DOM 元素
const chatAvatar = document.getElementById("chatAvatar");
const chatModal = document.getElementById("chatModal");
const closeChatBtn = document.getElementById("closeChat");
const messageList = document.getElementById("messageList");
const messageInput = document.getElementById("messageInput");
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

  if (error) return console.error(error);

  messageList.innerHTML = "";
  data.forEach((msg) => {
    const li = document.createElement("li");
    li.classList.add("message", msg.sender_id == currentUserId ? "sent" : "received");
    li.textContent = msg.content || "";
    messageList.appendChild(li);
  });

  messageList.scrollTop = messageList.scrollHeight;
}

// 发送消息
sendBtn.addEventListener("click", async () => {
  const text = messageInput.value.trim();
  if (!text) return;

  const { error } = await supabaseClient.from("messages").insert([
    {
      sender_id: currentUserId,
      receiver_id: CUSTOMER_SERVICE_ID,
      content: text
    }
  ]);

  if (error) return console.error(error);

  messageInput.value = "";
  loadMessages();
});

// 每 3 秒刷新一次
setInterval(loadMessages, 3000);
