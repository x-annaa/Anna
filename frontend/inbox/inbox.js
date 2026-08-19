document.addEventListener("DOMContentLoaded", () => {

  /* =========================================================
     Elements
     ========================================================= */

  const openInboxBtn = document.getElementById("openInboxBtn");
  const inboxModal = document.getElementById("inboxModal");
  const closeInboxBtn = document.getElementById("closeInboxBtn");
  const inboxList = document.getElementById("inboxList");
  const inboxUnreadDot = document.getElementById("inboxUnreadDot");

  let inboxSubscription = null;


  /* =========================================================
     Current User
     ========================================================= */

  function getCurrentUserId() {

    const id = localStorage.getItem("currentUserId");

    return id ? Number(id) : null;

  }


  /* =========================================================
     Open Inbox
     ========================================================= */

  openInboxBtn?.addEventListener("click", async () => {

    const userId = getCurrentUserId();

    if (!userId) {
      alert("Please log in first!");
      return;
    }

    inboxModal.classList.add("show");

    document.body.style.overflow = "hidden";

    await loadNotifications();

    await markNotificationsAsRead();

    await updateInboxUnreadCount();

  });


  /* =========================================================
     Close Inbox
     ========================================================= */

  closeInboxBtn?.addEventListener("click", closeInbox);

  inboxModal?.addEventListener("click", (event) => {

    if (event.target === inboxModal) {
      closeInbox();
    }

  });


  function closeInbox() {

    inboxModal.classList.remove("show");

    document.body.style.overflow = "";

  }


  /* =========================================================
     Escape Key
     ========================================================= */

  document.addEventListener("keydown", (event) => {

    if (event.key === "Escape") {

      if (inboxModal?.classList.contains("show")) {

        closeInbox();

      }

    }

  });


  /* =========================================================
     Load Notifications
     ========================================================= */

  async function loadNotifications() {

    const userId = getCurrentUserId();

    if (!userId || !inboxList) {
      return;
    }

    inboxList.innerHTML = `
      <div class="inbox-loading">
        Loading...
      </div>
    `;


    const { data, error } = await supabaseClient
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", {
        ascending: false
      });


    if (error) {

      console.error(
        "Inbox loading failed:",
        error
      );

      inboxList.innerHTML = `
        <div class="inbox-empty">
          <div class="inbox-empty-icon">⚠️</div>
          <p>Failed to load notifications.</p>
        </div>
      `;

      return;

    }


    if (!data || data.length === 0) {

      inboxList.innerHTML = `
        <div class="inbox-empty">
          <div class="inbox-empty-icon">📭</div>
          <p>No notifications yet.</p>
        </div>
      `;

      return;

    }


    inboxList.innerHTML = "";

    data.forEach(notification => {

      appendNotification(notification);

    });

  }


  /* =========================================================
     Append Notification
     ========================================================= */

  function appendNotification(notification) {

    if (!inboxList) {
      return;
    }


    const item = document.createElement("div");

    item.className = "inbox-item";


    if (!notification.is_read) {

      item.classList.add("unread");

    }


    const title =
      notification.title ||
      "Notification";


    const content =
      notification.content ||
      "";


    const time =
      formatNotificationTime(
        notification.created_at
      );


    item.innerHTML = `

      <h4 class="inbox-item-title">
        ${escapeHtml(title)}
      </h4>

      <p class="inbox-item-content">
        ${escapeHtml(content)}
      </p>

      <div class="inbox-item-time">
        ${time}
      </div>

    `;


    inboxList.appendChild(item);

  }


  /* =========================================================
     Mark Notifications As Read
     ========================================================= */

  async function markNotificationsAsRead() {

    const userId = getCurrentUserId();

    if (!userId) {
      return;
    }


    const { error } = await supabaseClient
      .from("notifications")
      .update({
        is_read: true
      })
      .eq("user_id", userId)
      .eq("is_read", false);


    if (error) {

      console.error(
        "Failed to mark notifications as read:",
        error
      );

      return;

    }


    /* Update badge */

    await updateInboxUnreadCount();

  }


  /* =========================================================
     Unread Count
     ========================================================= */

  async function updateInboxUnreadCount() {

    const userId = getCurrentUserId();

    if (!userId) {

      hideUnreadBadge();

      return;

    }


    const { count, error } = await supabaseClient
      .from("notifications")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq("user_id", userId)
      .eq("is_read", false);


    if (error) {

      console.error(
        "Failed to get inbox unread count:",
        error
      );

      return;

    }


    const unread = count || 0;


    if (!inboxUnreadDot) {
      return;
    }


    if (unread > 0) {

      const text =
        unread > 99
          ? "99+"
          : String(unread);


      inboxUnreadDot.textContent = text;

      inboxUnreadDot.classList.remove("show");

      void inboxUnreadDot.offsetWidth;

      inboxUnreadDot.classList.add("show");

    } else {

      hideUnreadBadge();

    }

  }


  /* =========================================================
     Hide Badge
     ========================================================= */

  function hideUnreadBadge() {

    if (!inboxUnreadDot) {
      return;
    }

    inboxUnreadDot.textContent = "";

    inboxUnreadDot.classList.remove("show");

  }


  /* =========================================================
     Supabase Realtime
     ========================================================= */

  function listenForNotifications() {

    const userId = getCurrentUserId();

    if (!userId) {
      return;
    }


    if (inboxSubscription) {

      supabaseClient.removeChannel(
        inboxSubscription
      );

      inboxSubscription = null;

    }


    inboxSubscription =
      supabaseClient
        .channel(
          `inbox-notifications-${userId}`
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`
          },
          async payload => {

            console.log(
              "New notification:",
              payload.new
            );


            const notification =
              payload.new;


            /*
             * If Inbox is currently open,
             * immediately display the notification
             */

            if (
              inboxModal?.classList.contains("show")
            ) {

              /*
               * New notification is unread.
               * Put it at the top.
               */

              const item =
                document.createElement("div");

              item.className =
                "inbox-item unread";


              const title =
                notification.title ||
                "Notification";


              const content =
                notification.content ||
                "";


              const time =
                formatNotificationTime(
                  notification.created_at
                );


              item.innerHTML = `

                <h4 class="inbox-item-title">
                  ${escapeHtml(title)}
                </h4>

                <p class="inbox-item-content">
                  ${escapeHtml(content)}
                </p>

                <div class="inbox-item-time">
                  ${time}
                </div>

              `;


              if (inboxList.firstChild) {

                inboxList.insertBefore(
                  item,
                  inboxList.firstChild
                );

              } else {

                inboxList.appendChild(item);

              }


              /*
               * User is already reading Inbox,
               * so immediately mark the new notification read.
               */

              await supabaseClient
                .from("notifications")
                .update({
                  is_read: true
                })
                .eq(
                  "id",
                  notification.id
                );


              item.classList.remove(
                "unread"
              );


              await updateInboxUnreadCount();

            } else {

              /*
               * Inbox closed.
               * Keep notification unread.
               */

              await updateInboxUnreadCount();

            }

          }
        )
        .subscribe(status => {

          console.log(
            "Inbox realtime status:",
            status
          );

        });

  }


  /* =========================================================
     Date Formatting
     ========================================================= */

  function formatNotificationTime(
    timestamp
  ) {

    if (!timestamp) {
      return "";
    }


    const date =
      new Date(timestamp);


    if (Number.isNaN(date.getTime())) {
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


  /* =========================================================
     HTML Escape
     ========================================================= */

  function escapeHtml(value) {

    const div =
      document.createElement("div");

    div.textContent =
      value == null
        ? ""
        : String(value);

    return div.innerHTML;

  }


  /* =========================================================
     Start
     ========================================================= */

  updateInboxUnreadCount();

  listenForNotifications();


  /* =========================================================
     Optional Global Functions
     ========================================================= */

  window.updateInboxUnreadCount =
    updateInboxUnreadCount;

});
