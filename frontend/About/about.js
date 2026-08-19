document.addEventListener("DOMContentLoaded", () => {
  const openChatBtn = document.getElementById("openChatBtn");
  const chatWindow = document.getElementById("chatWindow");
  const backBtn = document.getElementById("backBtn");
  const sendBtn = document.getElementById("sendBtn");
  const chatInput = document.getElementById("chatInput");
  const chatMessages = document.getElementById("chatMessages");
  const copyTelegramBtn = document.getElementById("copyTelegramBtn");
  const telegramAccountEl = document.getElementById("telegramAccount");
  const bottomUnreadEl = document.querySelector("#bottomUnreadCount");
  const chatBtnUnreadEl = document.querySelector("#chatBtnUnreadCount");
  const aboutBtnUnreadEl = document.querySelector('button[data-page="msgPage"] .bottom-unread-dot');
  let chatSubscription = null;
  function getCurrentUserId() {
    const id = localStorage.getItem("currentUserId");
    return id ? Number(id) : null;
  }

  chatInput?.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = chatInput.scrollHeight + "px";
    scrollToBottom();
  });

  openChatBtn?.addEventListener("click", async () => {
    const userId = getCurrentUserId();
    if (!userId) return alert("Please log in first!");

    chatWindow.style.display = "flex";
    chatWindow.classList.remove("hidden");
    chatMessages.innerHTML = "";

    await loadMessages();
    listenForMessages();
    await markMessagesAsRead();
    updateUnreadCount();
    scrollToBottom();
  });

  backBtn?.addEventListener("click", () => {
    chatWindow.style.display = "none";
    chatWindow.classList.add("hidden");

    if (chatSubscription) {
      supabaseClient.removeChannel(chatSubscription);
      chatSubscription = null;
    }
  });

  sendBtn?.addEventListener("click", async () => {
    const userId = getCurrentUserId();
    if (!userId) return alert("Please log in first!");

    const content = chatInput.value.trim();
    if (!content) return;

    const { error } = await supabaseClient.from("messages").insert([
      { sender_id: userId, receiver_id: 1, content, is_read: false }
    ]);

    if (error) return alert("Sending failed：" + error.message);

    appendMessage("Me", content);
    chatInput.value = "";
    chatInput.style.height = "auto";
    scrollToBottom();
  });

  function appendMessage(sender, text) {
    if (!chatMessages) return;
    const msg = document.createElement("div");
    msg.classList.add("message-item", sender === "Me" ? "me" : "bot");
    msg.innerHTML = text.replace(/\n/g, "<br>");
    chatMessages.appendChild(msg);
    scrollToBottom();
  }

  function scrollToBottom() {
    if (!chatMessages) return;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function loadMessages() {
    const userId = getCurrentUserId();
    if (!userId) return;

    const { data, error } = await supabaseClient
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${userId},receiver_id.eq.1),and(sender_id.eq.1,receiver_id.eq.${userId})`)
      .order("created_at", { ascending: true });

    if (error) return console.error(error);

    data.forEach(msg =>
      appendMessage(msg.sender_id === userId ? "Me" : "Customer Service", msg.content)
    );
  }

  async function markMessagesAsRead() {
    const userId = getCurrentUserId();
    if (!userId) return;

    await supabaseClient
      .from("messages")
      .update({ is_read: true })
      .eq("receiver_id", userId)
      .eq("is_read", false);
  }

  async function updateUnreadCount() {
    const userId = getCurrentUserId();
    if (!userId) return;

    const { count, error } = await supabaseClient
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", userId)
      .eq("is_read", false);

    if (error) return console.error(error);

    const unread = count || 0;
    const show = unread > 0;
    const text = unread > 99 ? "99+" : unread;

    [
      bottomUnreadEl,
      chatBtnUnreadEl,
      document.querySelector("#openChatBtn .unread-dot"),
      aboutBtnUnreadEl
    ].forEach(el => {
      if (!el) return;
      if (show) {
        el.textContent = text;
        el.style.display = "inline-block";
        el.classList.remove("show");
        void el.offsetWidth;
        el.classList.add("show");
      } else {
        el.style.display = "none";
        el.classList.remove("show");
      }
    });
  }

  function listenForMessages() {
    const userId = getCurrentUserId();
    if (!userId) return;

    if (chatSubscription) supabaseClient.removeChannel(chatSubscription);

    chatSubscription = supabaseClient.channel("realtime-messages")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `receiver_id=eq.${userId}`
      }, async payload => {
        const msg = payload.new;
        if (msg.sender_id === 1 && chatWindow?.style.display !== "none") {
          appendMessage("Customer Service", msg.content);
          await markMessagesAsRead();
        }
        updateUnreadCount();
      })
      .subscribe();
  }

  copyTelegramBtn?.addEventListener("click", () => {
    const text = telegramAccountEl?.textContent || "";
    if (!text) return;
    navigator.clipboard.writeText(text).then(() =>
      alert("Copied：" + text)
    );
  });

  function adjustChatForKeyboard() {
    if (!chatWindow) return;
    let initialHeight = window.innerHeight;
    window.addEventListener('resize', () => {
      const vh = window.innerHeight;
      const keyboardHeight = initialHeight - vh;

      if (keyboardHeight > 100) {
        chatWindow.style.top = 'auto';
        chatWindow.style.bottom = '0';
        chatWindow.style.transform = 'translateX(-50%)';
      } else {
        chatWindow.style.top = '50%';
        chatWindow.style.bottom = 'auto';
        chatWindow.style.transform = 'translate(-50%, -50%)';
      }
      scrollToBottom();
    });
  }

  adjustChatForKeyboard();
  updateUnreadCount();
});

function updateMsgButtonUnread(unread) {
  const msgBtn = document.querySelector('button[data-page="msgPage"]');
  const dot = msgBtn.querySelector(".bottom-unread-dot");
  
  if (unread > 0) {
    dot.textContent = unread > 99 ? "99+" : unread;
    dot.classList.add("show");
  } else {
    dot.classList.remove("show");
  }
}
