document.addEventListener("DOMContentLoaded", () => {

  /* =========================================================
     Elements
     ========================================================= */

  const openInboxBtn =
    document.getElementById("openInboxBtn");

  const inboxModal =
    document.getElementById("inboxModal");

  const closeInboxBtn =
    document.getElementById("closeInboxBtn");

  const inboxList =
    document.getElementById("inboxList");

  const inboxUnreadDot =
    document.getElementById("inboxUnreadDot");


  let inboxSubscription = null;


  /* =========================================================
     Current User
     ========================================================= */

  function getCurrentUserId() {

    const id =
      localStorage.getItem("currentUserId");

    return id ? Number(id) : null;

  }


  /* =========================================================
     Session Token
     ========================================================= */

  function getSessionToken() {

    return localStorage.getItem("sessionToken");

  }


  /* =========================================================
     Open Inbox
     ========================================================= */

  openInboxBtn?.addEventListener(
    "click",
    async () => {

      const userId =
        getCurrentUserId();

      const sessionToken =
        getSessionToken();


      if (!userId || !sessionToken) {

        alert("Please log in first!");

        return;

      }


      if (!inboxModal) {

        console.error(
          "Inbox modal not found."
        );

        return;

      }


      inboxModal.classList.add("show");

      document.body.style.overflow =
        "hidden";


      /*
       * Load notifications first
       */

      await loadNotifications();


      /*
       * Mark all notifications as read
       */

      await markNotificationsAsRead();


      /*
       * Update unread badge
       */

      await updateInboxUnreadCount();

    }
  );


  /* =========================================================
     Close Inbox
     ========================================================= */

  closeInboxBtn?.addEventListener(
    "click",
    closeInbox
  );


  inboxModal?.addEventListener(
    "click",
    (event) => {

      if (event.target === inboxModal) {

        closeInbox();

      }

    }
  );


  function closeInbox() {

    if (!inboxModal) {
      return;
    }


    inboxModal.classList.remove("show");

    document.body.style.overflow = "";

  }


  /* =========================================================
     Escape Key
     ========================================================= */

  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Escape" &&
        inboxModal?.classList.contains("show")
      ) {

        closeInbox();

      }

    }
  );


  /* =========================================================
     Load Notifications
     ========================================================= */

  async function loadNotifications() {

    const sessionToken =
      getSessionToken();


    if (!sessionToken || !inboxList) {

      return;

    }


    inboxList.innerHTML = `
      <div class="inbox-loading">
        Loading...
      </div>
    `;


    /*
     * IMPORTANT:
     *
     * We no longer use:
     *
     * .from("notifications")
     *
     * because notifications is protected by RLS.
     *
     * Instead we use the RPC.
     */

    const {
      data,
      error
    } =
      await supabaseClient.rpc(
        "get_my_notifications",
        {
          p_session_token:
            sessionToken
        }
      );


    if (error) {

      console.error(
        "Inbox loading failed:",
        error
      );


      inboxList.innerHTML = `
        <div class="inbox-empty">
          <div class="inbox-empty-icon">
            ⚠️
          </div>

          <p>
            Failed to load notifications.
          </p>
        </div>
      `;


      return;

    }


    if (!data || data.length === 0) {

      inboxList.innerHTML = `
        <div class="inbox-empty">
          <div class="inbox-empty-icon">
            📭
          </div>

          <p>
            No notifications yet.
          </p>
        </div>
      `;


      return;

    }


    inboxList.innerHTML = "";


    data.forEach(
      notification => {

        appendNotification(
          notification
        );

      }
    );

  }


  /* =========================================================
     Append Notification
     ========================================================= */

  function appendNotification(
    notification
  ) {

    if (!inboxList) {

      return;

    }


    const item =
      document.createElement("div");


    item.className =
      "inbox-item";


    if (!notification.is_read) {

      item.classList.add(
        "unread"
      );

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


    inboxList.appendChild(
      item
    );

  }


  /* =========================================================
     Mark Notifications As Read
     ========================================================= */

  async function markNotificationsAsRead() {

    const sessionToken =
      getSessionToken();


    if (!sessionToken) {

      return;

    }


    const {
      error
    } =
      await supabaseClient.rpc(
        "mark_my_notifications_as_read",
        {
          p_session_token:
            sessionToken
        }
      );


    if (error) {

      console.error(
        "Failed to mark notifications as read:",
        error
      );

      return;

    }


    /*
     * Remove unread style from
     * currently displayed items.
     */

    if (inboxList) {

      inboxList
        .querySelectorAll(
          ".inbox-item.unread"
        )
        .forEach(item => {

          item.classList.remove(
            "unread"
          );

        });

    }


    await updateInboxUnreadCount();

  }


  /* =========================================================
     Unread Count
     ========================================================= */

  async function updateInboxUnreadCount() {

    const sessionToken =
      getSessionToken();


    if (!sessionToken) {

      hideUnreadBadge();

      return;

    }


    const {
      data,
      error
    } =
      await supabaseClient.rpc(
        "get_my_unread_count",
        {
          p_session_token:
            sessionToken
        }
      );


    if (error) {

      console.error(
        "Failed to get inbox unread count:",
        error
      );

      return;

    }


    const unread =
      Number(data || 0);


    if (!inboxUnreadDot) {

      return;

    }


    if (unread > 0) {

      const text =
        unread > 99
          ? "99+"
          : String(unread);


      inboxUnreadDot.textContent =
        text;


      /*
       * Restart animation
       */

      inboxUnreadDot.classList.remove(
        "show"
      );


      void inboxUnreadDot.offsetWidth;


      inboxUnreadDot.classList.add(
        "show"
      );

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


    inboxUnreadDot.textContent =
      "";


    inboxUnreadDot.classList.remove(
      "show"
    );

  }


  /* =========================================================
     Supabase Realtime
     ========================================================= */

  function listenForNotifications() {

    const userId =
      getCurrentUserId();


    if (!userId) {

      return;

    }


    /*
     * Remove old channel
     */

    if (inboxSubscription) {

      supabaseClient.removeChannel(
        inboxSubscription
      );

      inboxSubscription =
        null;

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
            filter:
              `user_id=eq.${userId}`
          },
          async payload => {

            console.log(
              "New notification:",
              payload.new
            );


            const notification =
              payload.new;


            /*
             * Inbox is open
             */

            if (
              inboxModal?.classList.contains(
                "show"
              )
            ) {

              /*
               * Add new notification
               * to the top.
               */

              const item =
                document.createElement(
                  "div"
                );


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


              /*
               * Remove empty state
               * if it exists.
               */

              const empty =
                inboxList?.querySelector(
                  ".inbox-empty"
                );


              if (empty) {

                inboxList.innerHTML = "";

              }


              if (
                inboxList?.firstChild
              ) {

                inboxList.insertBefore(
                  item,
                  inboxList.firstChild
                );

              } else if (inboxList) {

                inboxList.appendChild(
                  item
                );

              }


              /*
               * User is already viewing
               * the Inbox.
               *
               * Mark this notification
               * as read using RPC.
               */

              const sessionToken =
                getSessionToken();


              if (sessionToken) {

                const {
                  error
                } =
                  await supabaseClient.rpc(
                    "mark_my_notifications_as_read",
                    {
                      p_session_token:
                        sessionToken
                    }
                  );


                if (error) {

                  console.error(
                    "Failed to mark new notification as read:",
                    error
                  );

                } else {

                  item.classList.remove(
                    "unread"
                  );

                }

              }


              await updateInboxUnreadCount();

            } else {

              /*
               * Inbox is closed.
               *
               * Do NOT mark the notification
               * as read.
               *
               * Just update the badge.
               */

              await updateInboxUnreadCount();

            }

          }
        )
        .subscribe(
          status => {

            console.log(
              "Inbox realtime status:",
              status
            );

          }
        );

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


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

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
      document.createElement(
        "div"
      );


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
     Optional Global Function
     ========================================================= */

  window.updateInboxUnreadCount =
    updateInboxUnreadCount;

});
