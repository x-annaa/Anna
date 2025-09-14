// DOM 元素
const openChatBtn = document.getElementById("openChatBtn");
const chatWindow = document.getElementById("chatWindow");
const backBtn = document.getElementById("backBtn");
const sendBtn = document.getElementById("sendBtn");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");

// === 自动恢复 session ===
(async () => {
  const token = localStorage.getItem("supabase_token");
  if (token) {
    await supabaseClient.auth.setSession({ access_token: token });
  }

  const { data: { session }, error } = await supabaseClient.auth.getSession();
  console.log("当前 session 调试：", session, error);
})();

// 打开聊天窗口
openChatBtn.addEventListener("click", async () => {
  chatWindow.classList.remove("hidden");
  chatMessages.innerHTML = ""; // 清空旧消息
  await loadMessages();        // 加载历史消息
  listenForMessages();         // 开启实时监听
});

// 返回按钮
backBtn.addEventListener("click", () => {
  chatWindow.classList.add("hidden");
  if (chatSubscription) {
    supabaseClient.removeChannel(chatSubscription);
    chatSubscription = null;
  }
});

// 发送消息
sendBtn.addEventListener("click", async () => {
  const content = chatInput.value.trim();
  if (!content) return;

  try {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) {
      console.log("session error:", sessionError);
      alert("请先登录！");
      return;
    }

    const user = session.user;

    const { data, error } = await supabaseClient
      .from("messages")
      .insert([
        {
          sender_id: user.id,
          receiver_id: 1, // 客服固定 id
          content: content
        }
      ]);

    if (error) {
      console.error("发送失败:", error);
      alert("发送失败！");
      return;
    }

    console.log("发送成功:", data);
    appendMessage("我", content);
    chatInput.value = "";
  } catch (err) {
    console.error("未知错误:", err);
  }
});

// 显示消息
function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message-item");
  msg.textContent = `${sender}: ${text}`;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 加载历史消息
async function loadMessages() {
  const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError || !session) return;

  const user = session.user;

  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.1),and(sender_id.eq.1,receiver_id.eq.${user.id})`)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("加载消息失败:", error);
    return;
  }

  data.forEach(msg => {
    appendMessage(msg.sender_id === user.id ? "我" : "客服", msg.content);
  });
}

// 实时监听客服回复
let chatSubscription = null;
async function listenForMessages() {
  const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError || !session) return;

  const user = session.user;

  if (chatSubscription) {
    supabaseClient.removeChannel(chatSubscription);
  }

  chatSubscription = supabaseClient
    .channel("realtime-messages")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `receiver_id=eq.${user.id}`
      },
      (payload) => {
        const msg = payload.new;
        if (msg.sender_id === 1) {
          appendMessage("客服", msg.content);
        }
      }
    )
    .subscribe();
}
