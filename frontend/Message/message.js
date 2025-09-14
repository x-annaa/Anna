let chatSubscription = null;

// 更新红点函数
async function updateUnreadCount() {
  const userId = Number(localStorage.getItem("currentUserId"));
  if (!userId) return;

  const { count, error } = await supabaseClient
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .eq("is_read", false);

  if (error) return console.error(error);

  const bottomUnreadEl = document.getElementById("bottomUnreadCount");
  const chatBtnUnreadEl = document.getElementById("chatBtnUnreadCount");

  if (count > 0) {
    bottomUnreadEl.textContent = count;
    chatBtnUnreadEl.textContent = count;
    bottomUnreadEl.classList.remove("hidden");
    chatBtnUnreadEl.classList.remove("hidden");
  } else {
    bottomUnreadEl.classList.add("hidden");
    chatBtnUnreadEl.classList.add("hidden");
  }
}

// 全局监听消息函数（可复用）
function listenForMessages() {
  const userId = Number(localStorage.getItem("currentUserId"));
  if (!userId) return;

  if (chatSubscription) supabaseClient.removeChannel(chatSubscription);

  chatSubscription = supabaseClient
    .channel("realtime-messages")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `receiver_id=eq.${userId}`
      },
      (payload) => {
        const msg = payload.new;

        // 可选：窗口打开时显示消息
        const chatWindow = document.getElementById("chatWindow");
        if (chatWindow && !chatWindow.classList.contains("hidden") && msg.sender_id === 1) {
          const chatMessages = document.getElementById("chatMessages");
          const div = document.createElement("div");
          div.classList.add("message-item", "bot");
          div.textContent = msg.content;
          chatMessages.prepend(div);
        }

        // 更新红点
        updateUnreadCount();
      }
    )
    .subscribe();
}

// 页面加载时初始化
document.addEventListener("DOMContentLoaded", () => {
  updateUnreadCount();
  listenForMessages();
});
