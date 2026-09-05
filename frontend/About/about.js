document.addEventListener("DOMContentLoaded", () => {

  // =========================================================
  // ELEMENTS
  // =========================================================

  const openChatBtn = document.getElementById("openChatBtn");
  const chatWindow = document.getElementById("chatWindow");
  const backBtn = document.getElementById("backBtn");
  const sendBtn = document.getElementById("sendBtn");
  const chatInput = document.getElementById("chatInput");
  const chatMessages = document.getElementById("chatMessages");

  const bottomUnreadDot =
    document.querySelector('button[data-page="msgPage"] .bottom-unread-dot');

  let chatSubscription = null;


  // =========================================================
  // CURRENT USER
  // =========================================================

  function getCurrentUserId() {
    const id = localStorage.getItem("currentUserId");
    return id ? Number(id) : null;
  }


  // =========================================================
  // INPUT HEIGHT
  // =========================================================

  chatInput?.addEventListener("input", () => {

    chatInput.style.height = "auto";
    chatInput.style.height = chatInput.scrollHeight + "px";

    scrollToBottom();

  });


  // =========================================================
  // OPEN CUSTOMER SERVICE
  // =========================================================

  openChatBtn?.addEventListener("click", async () => {

    const userId = getCurrentUserId();

    if (!userId) {
      alert("Please log in first!");
      return;
    }

    chatWindow.style.display = "flex";
    chatWindow.classList.remove("hidden");

    chatMessages.innerHTML = "";

    await loadMessages();

    listenForMessages();

    await markMessagesAsRead();

    updateUnreadCount();

    scrollToBottom();

  });


  // =========================================================
  // CLOSE CUSTOMER SERVICE
  // =========================================================

  backBtn?.addEventListener("click", () => {

    chatWindow.style.display = "none";
    chatWindow.classList.add("hidden");

    if (chatSubscription) {

      supabaseClient.removeChannel(chatSubscription);

      chatSubscription = null;

    }

  });


  // =========================================================
  // SEND MESSAGE
  // =========================================================

  sendBtn?.addEventListener("click", async () => {

    const userId = getCurrentUserId();

    if (!userId) {
      alert("Please log in first!");
      return;
    }

    const content = chatInput.value.trim();

    if (!content) return;


    const { error } = await supabaseClient
      .from("messages")
      .insert([
        {
          sender_id: userId,
          receiver_id: 1,
          content: content,
          is_read: false
        }
      ]);


    if (error) {

      alert("Sending failed：" + error.message);

      return;

    }


    appendMessage("Me", content);

    chatInput.value = "";

    chatInput.style.height = "auto";

    scrollToBottom();

  });


  // =========================================================
  // ADD MESSAGE TO CHAT
  // =========================================================

  function appendMessage(sender, text) {

    if (!chatMessages) return;


    const message = document.createElement("div");

    message.classList.add(
      "message-item",
      sender === "Me" ? "me" : "bot"
    );


    // Keep message text safe
    message.textContent = text;


    chatMessages.appendChild(message);

    scrollToBottom();

  }


  // =========================================================
  // SCROLL TO BOTTOM
  // =========================================================

  function scrollToBottom() {

    if (!chatMessages) return;

    chatMessages.scrollTop = chatMessages.scrollHeight;

  }


  // =========================================================
  // LOAD MESSAGE HISTORY
  // =========================================================

  async function loadMessages() {

    const userId = getCurrentUserId();

    if (!userId) return;


    const { data, error } = await supabaseClient
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.1),and(sender_id.eq.1,receiver_id.eq.${userId})`
      )
      .order("created_at", {
        ascending: true
      });


    if (error) {

      console.error("Failed to load messages:", error);

      return;

    }


    data.forEach((msg) => {

      appendMessage(
        msg.sender_id === userId
          ? "Me"
          : "Customer Service",
        msg.content
      );

    });

  }


  // =========================================================
  // MARK CUSTOMER SERVICE MESSAGES AS READ
  // =========================================================

  async function markMessagesAsRead() {

    const userId = getCurrentUserId();

    if (!userId) return;


    await supabaseClient
      .from("messages")
      .update({
        is_read: true
      })
      .eq("receiver_id", userId)
      .eq("is_read", false);

  }


  // =========================================================
  // UPDATE UNREAD COUNT
  // =========================================================

  async function updateUnreadCount() {

    const userId = getCurrentUserId();

    if (!userId) return;


    const { count, error } = await supabaseClient
      .from("messages")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq("receiver_id", userId)
      .eq("is_read", false);


    if (error) {

      console.error("Failed to get unread count:", error);

      return;

    }


    const unread = count || 0;

    const show = unread > 0;

    const text = unread > 99
      ? "99+"
      : unread;


    const unreadElements = [

      document.querySelector("#openChatBtn .unread-dot"),

      bottomUnreadDot

    ];


    unreadElements.forEach((element) => {

      if (!element) return;


      if (show) {

        element.textContent = text;

        element.style.display = "inline-block";

        element.classList.remove("show");

        void element.offsetWidth;

        element.classList.add("show");

      } else {

        element.style.display = "none";

        element.classList.remove("show");

      }

    });

  }


  // =========================================================
  // REALTIME MESSAGES
  // =========================================================

  function listenForMessages() {

    const userId = getCurrentUserId();

    if (!userId) return;


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
          filter: `receiver_id=eq.${userId}`
        },

        async (payload) => {

          const msg = payload.new;


          if (
            msg.sender_id === 1 &&
            chatWindow?.style.display !== "none"
          ) {

            appendMessage(
              "Customer Service",
              msg.content
            );

            await markMessagesAsRead();

          }


          updateUnreadCount();

        }

      )

      .subscribe();

  }


  // =========================================================
  // MOBILE KEYBOARD
  // =========================================================

  function adjustChatForKeyboard() {

    if (!chatWindow) return;


    const initialHeight = window.innerHeight;


    window.addEventListener("resize", () => {

      const currentHeight = window.innerHeight;

      const keyboardHeight =
        initialHeight - currentHeight;


      if (keyboardHeight > 100) {

        chatWindow.style.top = "auto";

        chatWindow.style.bottom = "0";

        chatWindow.style.transform =
          "translateX(-50%)";

      } else {

        chatWindow.style.top = "50%";

        chatWindow.style.bottom = "auto";

        chatWindow.style.transform =
          "translate(-50%, -50%)";

      }


      scrollToBottom();

    });

  }


  // =========================================================
  // INITIALIZE
  // =========================================================

  adjustChatForKeyboard();

  updateUnreadCount();

});
