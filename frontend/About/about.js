document.addEventListener("DOMContentLoaded", () => {
  // =========================================================
  // Elements
  // =========================================================

  const openChatBtn = document.getElementById("openChatBtn");
  const chatWindow = document.getElementById("chatWindow");
  const backBtn = document.getElementById("backBtn");
  const sendBtn = document.getElementById("sendBtn");
  const chatInput = document.getElementById("chatInput");
  const chatMessages = document.getElementById("chatMessages");

  const copyTelegramBtn = document.getElementById("copyTelegramBtn");
  const telegramAccountEl = document.getElementById("telegramAccount");

  // Customer Service button unread
  const chatUnreadEl = document.querySelector("#openChatBtn .unread-dot");

  // Bottom navigation Chat unread
  const bottomUnreadEl = document.querySelector(
    'button[data-page="msgPage"] .bottom-unread-dot'
  );


  // =========================================================
  // Current User
  // =========================================================

  function getCurrentUserId() {
    const id = localStorage.getItem("currentUserId");

    if (!id) return null;

    const userId = Number(id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return null;
    }

    return userId;
  }


  // =========================================================
  // Scroll Chat To Bottom
  // =========================================================

  function scrollToBottom() {
    if (!chatMessages) return;

    chatMessages.scrollTop = chatMessages.scrollHeight;
  }


  // =========================================================
  // Add Message To Chat
  // =========================================================

  function appendMessage(sender, text) {
    if (!chatMessages) return;

    const msg = document.createElement("div");

    msg.classList.add(
      "message-item",
      sender === "Me" ? "me" : "bot"
    );

    // Use textContent instead of innerHTML
    // to prevent message content from being interpreted as HTML.
    const safeText = String(text ?? "");

    const lines = safeText.split("\n");

    lines.forEach((line, index) => {
      msg.appendChild(document.createTextNode(line));

      if (index < lines.length - 1) {
        msg.appendChild(document.createElement("br"));
      }
    });

    chatMessages.appendChild(msg);

    scrollToBottom();
  }


  // =========================================================
  // Load Customer Service Messages
  // =========================================================

  async function loadMessages() {
    const userId = getCurrentUserId();

    if (!userId) {
      return;
    }

    if (!supabaseClient) {
      console.error("supabaseClient is not available.");
      return;
    }

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

    if (!data || data.length === 0) {
      return;
    }

    data.forEach((msg) => {
      const sender =
        Number(msg.sender_id) === userId
          ? "Me"
          : "Customer Service";

      appendMessage(sender, msg.content);
    });
  }


  // =========================================================
  // Mark Customer Service Messages As Read
  // =========================================================

  async function markMessagesAsRead() {
    const userId = getCurrentUserId();

    if (!userId) {
      return;
    }

    if (!supabaseClient) {
      return;
    }

    const { error } = await supabaseClient
      .from("messages")
      .update({
        is_read: true
      })
      .eq("receiver_id", userId)
      .eq("is_read", false);

    if (error) {
      console.error(
        "Failed to mark messages as read:",
        error
      );
    }
  }


  // =========================================================
  // Update Unread Count
  // =========================================================

  async function updateUnreadCount() {
    const userId = getCurrentUserId();

    if (!userId) {
      hideUnreadIndicators();
      return;
    }

    if (!supabaseClient) {
      return;
    }

    const { count, error } = await supabaseClient
      .from("messages")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq("receiver_id", userId)
      .eq("is_read", false);

    if (error) {
      console.error(
        "Failed to get unread message count:",
        error
      );
      return;
    }

    const unread = Number(count || 0);

    updateUnreadIndicators(unread);
  }


  // =========================================================
  // Update Red Notification Indicators
  // =========================================================

  function updateUnreadIndicators(unread) {
    const count = Number(unread || 0);

    if (count <= 0) {
      hideUnreadIndicators();
      return;
    }

    const text = count > 99 ? "99+" : String(count);

    // Customer Service button
    if (chatUnreadEl) {
      chatUnreadEl.textContent = text;
      chatUnreadEl.style.display = "inline-block";
      chatUnreadEl.classList.add("show");
    }

    // Bottom Chat button
    if (bottomUnreadEl) {
      bottomUnreadEl.textContent = text;
      bottomUnreadEl.style.display = "block";
      bottomUnreadEl.classList.add("show");
    }
  }


  // =========================================================
  // Hide Red Notification Indicators
  // =========================================================

  function hideUnreadIndicators() {
    if (chatUnreadEl) {
      chatUnreadEl.textContent = "";
      chatUnreadEl.style.display = "none";
      chatUnreadEl.classList.remove("show");
    }

    if (bottomUnreadEl) {
      bottomUnreadEl.textContent = "";
      bottomUnreadEl.style.display = "none";
      bottomUnreadEl.classList.remove("show");
    }
  }


  // =========================================================
  // Open Customer Service Chat
  // =========================================================

  openChatBtn?.addEventListener("click", async () => {
    const userId = getCurrentUserId();

    if (!userId) {
      alert("Please log in first!");
      return;
    }

    if (!chatWindow) {
      return;
    }

    // Show chat
    chatWindow.style.display = "flex";
    chatWindow.classList.remove("hidden");

    // Clear previous messages
    if (chatMessages) {
      chatMessages.innerHTML = "";
    }

    // Load conversation
    await loadMessages();

    // Mark received messages as read
    await markMessagesAsRead();

    // Update notification
    await updateUnreadCount();

    // Scroll to latest message
    scrollToBottom();
  });


  // =========================================================
  // Close Customer Service Chat
  // =========================================================

  backBtn?.addEventListener("click", () => {
    if (!chatWindow) {
      return;
    }

    chatWindow.style.display = "none";
    chatWindow.classList.add("hidden");

    // No Realtime subscription here.
    // Nothing needs to be removed.
  });


  // =========================================================
  // Send Message
  // =========================================================

  sendBtn?.addEventListener("click", async () => {
    const userId = getCurrentUserId();

    if (!userId) {
      alert("Please log in first!");
      return;
    }

    if (!chatInput) {
      return;
    }

    const content = chatInput.value.trim();

    if (!content) {
      return;
    }

    if (!supabaseClient) {
      alert("Database connection is unavailable.");
      return;
    }

    // Prevent duplicate clicks while sending
    sendBtn.disabled = true;

    try {
      const { data, error } = await supabaseClient
        .from("messages")
        .insert([
          {
            sender_id: userId,
            receiver_id: 1,
            content: content,
            is_read: false
          }
        ])
        .select()
        .single();

      if (error) {
        console.error("Sending failed:", error);

        alert(
          "Sending failed: " + error.message
        );

        return;
      }

      // Display sent message immediately
      appendMessage("Me", data?.content ?? content);

      // Clear input
      chatInput.value = "";

      chatInput.style.height = "auto";

      scrollToBottom();

    } catch (err) {
      console.error("Unexpected send error:", err);

      alert(
        "Sending failed. Please try again."
      );

    } finally {
      sendBtn.disabled = false;
    }
  });


  // =========================================================
  // Textarea Auto Height
  // =========================================================

  chatInput?.addEventListener("input", () => {
    chatInput.style.height = "auto";

    chatInput.style.height =
      Math.min(chatInput.scrollHeight, 120) + "px";

    scrollToBottom();
  });


  // =========================================================
  // Send Message With Enter
  // =========================================================

  chatInput?.addEventListener("keydown", (event) => {
    // Desktop:
    // Enter = send
    // Shift + Enter = new line

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      sendBtn?.click();
    }
  });


  // =========================================================
  // Telegram Copy
  // =========================================================

  copyTelegramBtn?.addEventListener("click", async () => {
    const text =
      telegramAccountEl?.textContent?.trim() || "";

    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);

      alert("Copied: " + text);

    } catch (error) {
      console.error(
        "Clipboard failed:",
        error
      );

      // Fallback for browsers that don't support
      // navigator.clipboard
      const textarea =
        document.createElement("textarea");

      textarea.value = text;

      textarea.style.position = "fixed";
      textarea.style.opacity = "0";

      document.body.appendChild(textarea);

      textarea.select();

      try {
        document.execCommand("copy");

        alert("Copied: " + text);

      } catch (fallbackError) {
        console.error(
          "Fallback clipboard failed:",
          fallbackError
        );

        alert(
          "Unable to copy. Please copy it manually: " +
          text
        );
      }

      document.body.removeChild(textarea);
    }
  });


  // =========================================================
  // Mobile Keyboard Adjustment
  // =========================================================

  function adjustChatForKeyboard() {
    if (!chatWindow) {
      return;
    }

    let initialHeight = window.innerHeight;

    window.addEventListener("resize", () => {
      const currentHeight = window.innerHeight;

      const keyboardHeight =
        initialHeight - currentHeight;

      if (keyboardHeight > 100) {
        // Keyboard opened
        chatWindow.style.top = "auto";
        chatWindow.style.bottom = "0";
        chatWindow.style.transform =
          "translateX(-50%)";
      } else {
        // Keyboard closed
        chatWindow.style.top = "50%";
        chatWindow.style.bottom = "auto";
        chatWindow.style.transform =
          "translate(-50%, -50%)";
      }

      setTimeout(() => {
        scrollToBottom();
      }, 50);
    });
  }


  // =========================================================
  // Detect Page Returning To Foreground
  // =========================================================

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      updateUnreadCount();
    }
  });


  // =========================================================
  // Initial Setup
  // =========================================================

  adjustChatForKeyboard();

  updateUnreadCount();
});
