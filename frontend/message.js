import { supabaseClient } from "../supabaseClient.js";

const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

let currentChat = null;

// ========== 初始化会话 ==========
async function initChat() {
  const { data, error } = await supabaseClient.rpc("start_chat");
  if (error) {
    console.error("启动会话失败：", error.message);
    return;
  }
  currentChat = data;
  console.log("当前会话：", currentChat);

  // 加载历史消息
  loadMessages();
  // 监听新消息
  subscribeMessages();
}

// ========== 加载历史消息 ==========
async function loadMessages() {
  if (!currentChat) return;
  const { data, error } = await supabaseClient
    .from("chat_messages")
    .select("*")
    .eq("chat_id", currentChat.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("加载消息失败：", error.message);
    return;
  }

  chatMessages.innerHTML = "";
  data.forEach(addMessageToUI);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ========== 显示消息 ==========
function addMessageToUI(msg) {
  const div = document.createElement("div");
  div.className = `chat-message ${msg.sender_role}`;
  div.textContent = msg.content;
  chatMessages.appendChild(div);
}

// ========== 订阅新消息 ==========
function subscribeMessages() {
  supabaseClient
    .channel("chat:" + currentChat.id)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `chat_id=eq.${currentChat.id}`,
      },
      (payload) => {
        addMessageToUI(payload.new);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    )
    .subscribe();
}

// ========== 发送消息 ==========
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text || !currentChat) return;

  const { error } = await supabaseClient.from("chat_messages").insert({
    chat_id: currentChat.id,
    sender_id: (await supabaseClient.auth.getUser()).data.user.id,
    sender_role: "user",
    content: text,
  });

  if (error) {
    console.error("发送失败：", error.message);
    return;
  }

  chatInput.value = "";
});

// 初始化
initChat();
