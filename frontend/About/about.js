document.addEventListener("DOMContentLoaded", () => {

  /* =====================================================
     ELEMENTS
  ===================================================== */

  const openChatBtn =
    document.getElementById("openChatBtn");

  const chatWindow =
    document.getElementById("chatWindow");

  const backBtn =
    document.getElementById("backBtn");

  const sendBtn =
    document.getElementById("sendBtn");

  const chatInput =
    document.getElementById("chatInput");

  const chatMessages =
    document.getElementById("chatMessages");


  const copyTelegramBtn =
    document.getElementById("copyTelegramBtn");

  const telegramAccountEl =
    document.getElementById("telegramAccount");


  const openInboxBtn =
    document.getElementById("openInboxBtn");

  const inboxWindow =
    document.getElementById("inboxWindow");

  const closeInboxBtn =
    document.getElementById("closeInboxBtn");

  const inboxMessages =
    document.getElementById("inboxMessages");

  const inboxUnreadDot =
    document.getElementById("inboxUnreadDot");


  const bottomUnreadDot =
    document.querySelector(
      'button[data-page="msgPage"] .bottom-unread-dot'
    );


  const chatUnreadDot =
    document.querySelector(
      "#openChatBtn .unread-dot"
    );


  let chatSubscription = null;
  let inboxSubscription = null;


  /* =====================================================
     USER
  ===================================================== */

  function getCurrentUserId() {

    const id =
      localStorage.getItem("currentUserId");

    return id ? Number(id) : null;

  }


  /* =====================================================
     CHAT - OPEN
  ===================================================== */

  openChatBtn?.addEventListener(
    "click",
    async () => {

      const userId =
        getCurrentUserId();

      if (!userId) {

        alert("Please log in first!");

        return;

      }


      chatWindow.style.display = "flex";

      chatMessages.innerHTML = "";


      await loadMessages();

      await markChatMessagesAsRead();

      await updateChatUnreadCount();

      listenForMessages();

      scrollChatToBottom();

    }
  );


  /* =====================================================
     CHAT - CLOSE
  ===================================================== */

  backBtn?.addEventListener(
    "click",
    () => {

      chatWindow.style.display = "none";


      if (chatSubscription) {

        supabaseClient.removeChannel(
          chatSubscription
        );

        chatSubscription = null;

      }

    }
  );


  /* =====================================================
     CHAT INPUT
  ===================================================== */

  chatInput?.addEventListener(
    "input",
    () => {

      chatInput.style.height = "auto";

      chatInput.style.height =
        Math.min(
          chatInput.scrollHeight,
          110
        ) + "px";

    }
  );


  /* =====================================================
     SEND MESSAGE
  ===================================================== */

  sendBtn?.addEventListener(
    "click",
    async () => {

      const userId =
        getCurrentUserId();

      if (!userId) {

        alert("Please log in first!");

        return;

      }


      const content =
        chatInput.value.trim();


      if (!content) return;


      const {
        error
      } = await supabaseClient
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

        console.error(error);

        alert(
          "Sending failed: " +
          error.message
        );

        return;

      }


      appendChatMessage(
        "Me",
        content
      );


      chatInput.value = "";

      chatInput.style.height =
        "40px";


      scrollChatToBottom();

    }
  );


  /* =====================================================
     ENTER SEND
  ===================================================== */

  chatInput?.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {

        event.preventDefault();

        sendBtn.click();

      }

    }
  );


  /* =====================================================
     APPEND CHAT
  ===================================================== */

  function appendChatMessage(
    sender,
    text
  ) {

    if (!chatMessages) return;


    const msg =
      document.createElement("div");


    msg.className =
      "message-item " +
      (
        sender === "Me"
          ? "me"
          : "bot"
      );


    msg.textContent = text;


    chatMessages.appendChild(msg);


    scrollChatToBottom();

  }


  /* =====================================================
     LOAD CHAT
  ===================================================== */

  async function loadMessages() {

    const userId =
      getCurrentUserId();

    if (!userId) return;


    const {
      data,
      error
    } = await supabaseClient

      .from("messages")

      .select("*")

      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.1),` +
        `and(sender_id.eq.1,receiver_id.eq.${userId})`
      )

      .order(
        "created_at",
        {
          ascending: true
        }
      );


    if (error) {

      console.error(
        "Load messages error:",
        error
      );

      return;

    }


    chatMessages.innerHTML = "";


    (data || []).forEach(
      msg => {

        appendChatMessage(

          msg.sender_id === userId
            ? "Me"
            : "Customer Service",

          msg.content

        );

      }
    );

  }


  /* =====================================================
     MARK CHAT READ
  ===================================================== */

  async function markChatMessagesAsRead() {

    const userId =
      getCurrentUserId();

    if (!userId) return;


    const {
      error
    } = await supabaseClient

      .from("messages")

      .update({
        is_read: true
      })

      .eq(
        "receiver_id",
        userId
      )

      .eq(
        "is_read",
        false
      );


    if (error) {

      console.error(
        "Mark chat read error:",
        error
      );

    }

  }


  /* =====================================================
     CHAT UNREAD
  ===================================================== */

  async function updateChatUnreadCount() {

    const userId =
      getCurrentUserId();

    if (!userId) return;


    const {
      count,
      error
    } = await supabaseClient

      .from("messages")

      .select(
        "id",
        {
          count: "exact",
          head: true
        }
      )

      .eq(
        "receiver_id",
        userId
      )

      .eq(
        "is_read",
        false
      );


    if (error) {

      console.error(error);

      return;

    }


    const unread =
      count || 0;


    setUnreadBadge(
      chatUnreadDot,
      unread
    );


    /*
      Bottom Chat badge
    */

    setUnreadBadge(
      bottomUnreadDot,
      unread
    );

  }


  /* =====================================================
     CHAT REALTIME
  ===================================================== */

  function listenForMessages() {

    const userId =
      getCurrentUserId();

    if (!userId) return;


    if (chatSubscription) {

      supabaseClient.removeChannel(
        chatSubscription
      );

    }


    chatSubscription =
      supabaseClient

        .channel(
          "u9-chat-" + userId
        )

        .on(
          "postgres_changes",
          {
            event: "INSERT",

            schema: "public",

            table: "messages",

            filter:
              `receiver_id=eq.${userId}`

          },

          async payload => {

            const msg =
              payload.new;


            if (
              msg.sender_id === 1
            ) {

              if (
                chatWindow.style.display !==
                "none"
              ) {

                appendChatMessage(
                  "Customer Service",
                  msg.content
                );


                await markChatMessagesAsRead();

              }

            }


            await updateChatUnreadCount();

          }

        )

        .subscribe();

  }


  /* =====================================================
     INBOX OPEN
  ===================================================== */

  openInboxBtn?.addEventListener(
    "click",
    async () => {

      const userId =
        getCurrentUserId();


      if (!userId) {

        alert("Please log in first!");

        return;

      }


      inboxWindow.style.display =
        "flex";


      inboxMessages.innerHTML =
        `<div class="inbox-loading">
           Loading...
         </div>`;


      await loadInbox();


      await markInboxAsRead();


      await updateInboxUnreadCount();

    }
  );


  /* =====================================================
     INBOX CLOSE
  ===================================================== */

  closeInboxBtn?.addEventListener(
    "click",
    () => {

      inboxWindow.style.display =
        "none";

    }
  );


  /* =====================================================
     LOAD INBOX
  ===================================================== */

  async function loadInbox() {

    const userId =
      getCurrentUserId();

    if (!userId) return;


    const {
      data,
      error
    } = await supabaseClient

      .from("notifications")

      .select(
        "id,user_id,title,content,is_read,created_at"
      )

      .eq(
        "user_id",
        userId
      )

      .order(
        "created_at",
        {
          ascending: false
        }
      );


    if (error) {

      console.error(
        "Load inbox error:",
        error
      );


      inboxMessages.innerHTML = `
        <div class="inbox-empty">
          Failed to load messages.
        </div>
      `;

      return;

    }


    if (!data || data.length === 0) {

      inboxMessages.innerHTML = `
        <div class="inbox-empty">
          📭<br><br>
          No notifications
        </div>
      `;

      return;

    }


    inboxMessages.innerHTML = "";


    data.forEach(
      notification => {

        const item =
          document.createElement("div");


        item.className =
          "inbox-item" +
          (
            notification.is_read
              ? ""
              : " unread"
          );


        const date =
          formatDate(
            notification.created_at
          );


        item.innerHTML = `

          <div class="inbox-item-title">

            <strong>

              ${escapeHtml(
                notification.title ||
                "Notification"
              )}

              ${
                !notification.is_read
                  ? `<span class="inbox-unread-label">
                       NEW
                     </span>`
                  : ""
              }

            </strong>

            <span class="inbox-item-date">
              ${date}
            </span>

          </div>


          <div class="inbox-item-content">

            ${escapeHtml(
              notification.content || ""
            )}

          </div>

        `;


        inboxMessages.appendChild(
          item
        );

      }
    );

  }


  /* =====================================================
     MARK INBOX READ
  ===================================================== */

  async function markInboxAsRead() {

    const userId =
      getCurrentUserId();

    if (!userId) return;


    const {
      error
    } = await supabaseClient

      .from("notifications")

      .update({
        is_read: true
      })

      .eq(
        "user_id",
        userId
      )

      .eq(
        "is_read",
        false
      );


    if (error) {

      console.error(
        "Mark inbox read error:",
        error
      );

    }

  }


  /* =====================================================
     INBOX UNREAD
  ===================================================== */

  async function updateInboxUnreadCount() {

    const userId =
      getCurrentUserId();

    if (!userId) return;


    const {
      count,
      error
    } = await supabaseClient

      .from("notifications")

      .select(
        "id",
        {
          count: "exact",
          head: true
        }
      )

      .eq(
        "user_id",
        userId
      )

      .eq(
        "is_read",
        false
      );


    if (error) {

      console.error(
        "Inbox unread error:",
        error
      );

      return;

    }


    setUnreadBadge(
      inboxUnreadDot,
      count || 0
    );

  }


  /* =====================================================
     INBOX REALTIME
  ===================================================== */

  function listenForInbox() {

    const userId =
      getCurrentUserId();

    if (!userId) return;


    if (inboxSubscription) {

      supabaseClient.removeChannel(
        inboxSubscription
      );

    }


    inboxSubscription =
      supabaseClient

        .channel(
          "u9-inbox-" + userId
        )

        .on(
          "postgres_changes",
          {
            event: "INSERT",

            schema: "public",

            table: "notifications",

            filter:
              `user_id=eq.${userId}`

          },

          async () => {

            await updateInboxUnreadCount();


            /*
              如果 Inbox 正在打开，
              自动刷新
            */

            if (
              inboxWindow.style.display !==
              "none"
            ) {

              await loadInbox();

            }

          }

        )

        .subscribe();

  }


  /* =====================================================
     TELEGRAM COPY
  ===================================================== */

  copyTelegramBtn?.addEventListener(
    "click",
    async () => {

      const text =
        telegramAccountEl?.textContent
        ?.trim();


      if (!text) return;


      try {

        await navigator.clipboard.writeText(
          text
        );

        alert(
          "Copied: " + text
        );

      } catch (error) {

        console.error(error);

        alert(
          "Copy failed"
        );

      }

    }
  );


  /* =====================================================
     UNREAD BADGE
  ===================================================== */

  function setUnreadBadge(
    element,
    unread
  ) {

    if (!element) return;


    if (unread > 0) {

      element.textContent =
        unread > 99
          ? "99+"
          : unread;


      element.classList.add(
        "show"
      );

    } else {

      element.textContent = "";

      element.classList.remove(
        "show"
      );

    }

  }


  /* =====================================================
     DATE
  ===================================================== */

  function formatDate(
    dateString
  ) {

    if (!dateString) return "";


    const date =
      new Date(dateString);


    if (Number.isNaN(
      date.getTime()
    )) {

      return "";

    }


    return date.toLocaleString(
      undefined,
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }
    );

  }


  /* =====================================================
     HTML ESCAPE
  ===================================================== */

  function escapeHtml(
    value
  ) {

    return String(value)

      .replace(
        /&/g,
        "&amp;"
      )

      .replace(
        /</g,
        "&lt;"
      )

      .replace(
        />/g,
        "&gt;"
      )

      .replace(
        /"/g,
        "&quot;"
      )

      .replace(
        /'/g,
        "&#039;"
      );

  }


  /* =====================================================
     CHAT SCROLL
  ===================================================== */

  function scrollChatToBottom() {

    if (!chatMessages) return;


    requestAnimationFrame(
      () => {

        chatMessages.scrollTop =
          chatMessages.scrollHeight;

      }
    );

  }


  /* =====================================================
     INITIAL
  ===================================================== */

  updateChatUnreadCount();

  updateInboxUnreadCount();

  listenForMessages();

  listenForInbox();

});
