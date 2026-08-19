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
     Check Elements
  ========================================================= */

  if (!openInboxBtn) {
    console.warn("Inbox: #openInboxBtn not found");
  }

  if (!inboxModal) {
    console.warn("Inbox: #inboxModal not found");
  }

  if (!inboxList) {
    console.warn("Inbox: #inboxList not found");
  }

  if (!inboxUnreadDot) {
    console.warn("Inbox: #inboxUnreadDot not found");
  }


  /* =========================================================
     Current User
  ========================================================= */

  function getCurrentUserId() {

    const id =
      localStorage.getItem("currentUserId");

    return id ? Number(id) : null;

  }


  /* =========================================================
     Open Inbox
  ========================================================= */

  openInboxBtn?.addEventListener(
    "click",
    async () => {

      const userId =
        getCurrentUserId();

      if (!userId) {

        alert("Please log in first!");

        return;

      }


      /*
       * Prevent null.classList error
       */

      if (!inboxModal) {

        console.error(
          "Inbox modal #inboxModal does not exist in HTML."
        );

        return;

      }


      inboxModal.classList.add("show");

      document.body.style.overflow =
        "hidden";


      await loadNotifications();

      await markNotificationsAsRead();

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
    event => {

      if (
        event.target === inboxModal
      ) {

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
    event => {

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

    const userId =
      getCurrentUserId();

    if (
      !userId ||
      !inboxList
    ) {

      return;

    }


    inboxList.innerHTML = `
      <div class="inbox-loading">
        Loading...
      </div>
    `;


    const {
      data,
      error
    } = await supabaseClient
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order(
        "created_at",
        {
          ascending: false
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


    if (
      !data ||
      data.length === 0
    ) {

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


    if (
      !notification.is_read
    ) {

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

      <div class="inbox-item-main">

        <h4 class="inbox-item-title">
          ${escapeHtml(title)}
        </h4>

        <p class="inbox-item-content">
          ${escapeHtml(content)}
        </p>

        <div class="inbox-item-time">
          ${time}
        </div>

      </div>

    `;


    inboxList.appendChild(item);

  }


  /* =========================================================
     Mark Notifications As Read
  ========================================================= */

  async function markNotificationsAsRead() {

    const userId =
      getCurrentUserId();

    if (!userId) {
      return;
    }


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
        "Failed to mark notifications as read:",
        error
      );

      return;

    }


    await updateInboxUnreadCount();

  }


  /* =========================================================
     Unread Count
  ========================================================= */

  async function updateInboxUnreadCount() {

    const userId =
      getCurrentUserId();


    if (!userId) {

      hideUnreadBadge();

      return;

    }


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
        "Failed to get inbox unread count:",
        error
      );

      return;

    }


    const unread =
      count || 0;


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


    inboxUnreadDot.textContent = "";

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
              inboxModal &&
              inboxModal.classList.contains(
                "show"
              )
            ) {

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

                <div class="inbox-item-main">

                  <h4 class="inbox-item-title">
                    ${escapeHtml(title)}
                  </h4>

                  <p class="inbox-item-content">
                    ${escapeHtml(content)}
                  </p>

                  <div class="inbox-item-time">
                    ${time}
                  </div>

                </div>

              `;


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
               * User is reading Inbox,
               * mark new message as read
               */

              const {
                error
              } = await supabaseClient
                .from("notifications")
                .update({
                  is_read: true
                })
                .eq(
                  "id",
                  notification.id
                );


              if (error) {

                console.error(
                  "Failed to mark realtime notification as read:",
                  error
                );

              }


              item.classList.remove(
                "unread"
              );


              await updateInboxUnreadCount();

            } else {

              /*
               * Inbox closed.
               * Notification remains unread.
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
     Global Function
  ========================================================= */

  window.updateInboxUnreadCount =
    updateInboxUnreadCount;

});
