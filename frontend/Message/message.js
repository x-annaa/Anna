// DOM 元素
const openChatBtn = document.getElementById("openChatBtn");
const chatWindow = document.getElementById("chatWindow");
const backBtn = document.getElementById("backBtn");
const sendBtn = document.getElementById("sendBtn");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");

const bottomUnreadEl = document.getElementById("bottomUnreadCount");
const chatBtnUnreadEl = document.getElementById("chatBtnUnreadCount");

let chatSubscription = null;

// 获取用户 ID
function getCurrentUserId() {
  const id = localStorage.getItem("currentUserId");
  return id ? Number(id) : null;
}

// 打开聊天窗口
openChatBtn.addEventListener("click", async () => {
  const userId = getCurrentUserId();
  if (!userId) return alert("请先登录！");
  
  chatWindow.style.display = "flex";
  chatMessages.innerHTML = "";
  await loadMessages();
  listenForMessages();
  await markMessagesAsRead();
  updateUnreadCount();
});

// 返回关闭
backBtn.addEventListener("click", () => {
  chatWindow.style.display = "none";
  if(chatSubscription) {
    supabaseClient.removeChannel(chatSubscription);
    chatSubscription = null;
  }
});

// 发送消息
sendBtn.addEventListener("click", async () => {
  const userId = getCurrentUserId();
  if (!userId) return alert("请先登录！");
  
  const content = chatInput.value.trim();
  if (!content) return;

  const { error } = await supabaseClient.from("messages").insert([{
    sender_id: userId,
    receiver_id: 1,
    content,
    is_read: false
  }]);

  if(error) return console.error(error);
  appendMessage("我", content);
  chatInput.value = "";
});

// 显示消息
function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message-item", sender==="我"?"me":"bot");
  msg.textContent = text;
  chatMessages.prepend(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 加载历史消息
async function loadMessages() {
  const userId = getCurrentUserId();
  if(!userId) return;

  const { data } = await supabaseClient.from("messages")
    .select("*")
    .or(`and(sender_id.eq.${userId},receiver_id.eq.1),and(sender_id.eq.1,receiver_id.eq.${userId})`)
    .order("created_at", { ascending: true });

  data.forEach(msg => appendMessage(msg.sender_id===userId?"我":"客服", msg.content));
}

// 标记已读
async function markMessagesAsRead() {
  const userId = getCurrentUserId();
  if(!userId) return;

  await supabaseClient.from("messages")
    .update({ is_read:true })
    .eq("receiver_id", userId)
    .eq("is_read", false);
}

// 更新未读红点
async function updateUnreadCount() {
  const userId = getCurrentUserId();
  if(!userId) return;

  const { count } = await supabaseClient.from("messages")
    .select("id", { count:"exact", head:true })
    .eq("receiver_id", userId)
    .eq("is_read", false);

  if(count>0) {
    document.querySelector("#openChatBtn .unread-dot").textContent=count;
    document.querySelector("#openChatBtn .unread-dot").style.display="inline-block";
    bottomUnreadEl.textContent=count; bottomUnreadEl.style.display="inline-block";
    chatBtnUnreadEl.textContent=count; chatBtnUnreadEl.style.display="inline-block";
  } else {
    document.querySelector("#openChatBtn .unread-dot").style.display="none";
    bottomUnreadEl.style.display="none"; chatBtnUnreadEl.style.display="none";
  }
}

// 实时监听消息
function listenForMessages() {
  const userId = getCurrentUserId();
  if(!userId) return;

  if(chatSubscription) supabaseClient.removeChannel(chatSubscription);

  chatSubscription = supabaseClient.channel("realtime-messages")
    .on("postgres_changes", {
      event:"INSERT",
      schema:"public",
      table:"messages",
      filter:`receiver_id=eq.${userId}`
    }, async payload => {
      const msg = payload.new;
      if(!chatWindow.classList.contains("hidden") && msg.sender_id===1) {
        appendMessage("客服", msg.content);
        await markMessagesAsRead();
      }
      updateUnreadCount();
    }).subscribe();
}

// 页面初始化
document.addEventListener("DOMContentLoaded", () => {
  updateUnreadCount();
  listenForMessages();
});

// 复制 Telegram
document.getElementById("copyTelegramBtn").addEventListener("click", () => {
  const text = document.getElementById("telegramAccount").textContent;
  navigator.clipboard.writeText(text)
    .then(() => alert("已复制 Telegram 账号：" + text))
    .catch(() => alert("复制失败，请手动复制"));
});
