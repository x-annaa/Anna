import { supabaseClient } from "../supabaseClient.js";

const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

let currentChat = null;
let subscription = null;

// ========== 初始化会话 ==========
async function initChat() {
  // 确保已登录（如果你启用了 Supabase Auth + RLS）
  const { data: authData, error: authErr } = await supabaseClient.auth.getUser();
  if (authErr) console.warn("auth.getUser 警告：", authErr.message);
  if (!authData?.user) {
    // 这里按你的登录体系处理（localStorage 或 Supabase Auth）
    // 没登录也可以让后端策略放行匿名，但你当前 RLS 需要 auth.uid()
    console.error("未登录：start_chat 需要身份。");
    // 可选：跳转登录
    // window.location.href = "../index.html";
    // return;
  }

  const { data, error } = await supabaseClient.rpc("start_chat");
  if (error) {
    console.error("启动会话失败：", error.message);
    return;
  }
  currentChat = data;

  await loadMessages();
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
  if (!currentChat) return;
  if (subscription) supabaseClient.removeChannel(subscription);

  subscription = supabaseClient
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

  const { data: userData, error: userErr } = await supabaseClient.auth.getUser();
  if (userErr) {
    console.error("获取用户失败：", userErr.message);
    return;
  }

  const senderId = userData?.user?.id || null; // 如果没用 Supabase Auth，这里需要你自己传你系统的 user_id（不推荐）

  const { error } = await supabaseClient.from("chat_messages").insert({
    chat_id: currentChat.id,
    sender_id: senderId,        // RLS 里要求 sender_id = auth.uid()
    sender_role: "user",
    content: text,
  });

  if (error) {
    console.error("发送失败：", error.message);
    return;
  }

  chatInput.value = "";
});

// 页面加载后启动
initChat();
