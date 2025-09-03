import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient("https://YOUR-PROJECT.supabase.co", "YOUR-ANON-KEY");

let user = null;

// 获取登录用户
const { data: userData } = await supabase.auth.getUser();
if (!userData.user) {
  alert("请先登录");
  throw new Error("用户未登录");
}
user = userData.user;

// 1. 获取/创建会话
const { data: chat } = await supabase.rpc("start_chat");
const chatId = chat.id;

// 2. 渲染消息
const chatBox = document.getElementById("chat-messages");
function renderMessage(msg) {
  const div = document.createElement("div");
  div.classList.add("msg", msg.sender_role);
  div.textContent = msg.content;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// 3. 加载历史消息
const { data: history } = await supabase
  .from("chat_messages")
  .select("*")
  .eq("chat_id", chatId)
  .order("created_at", { ascending: true });

(history || []).forEach(renderMessage);

// 4. 订阅新消息
supabase.channel("chat:" + chatId)
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "chat_messages",
    filter: `chat_id=eq.${chatId}`
  }, (payload) => {
    renderMessage(payload.new);
  })
  .subscribe();

// 5. 发送消息
document.getElementById("chat-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;
  await supabase.from("chat_messages").insert([{
    chat_id: chatId,
    sender_id: user.id,
    sender_role: "user",
    content: text
  }]);
  input.value = "";
});
