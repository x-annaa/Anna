document.addEventListener(
  "DOMContentLoaded",
  () => {


  // =========================================================
  // ELEMENTS
  // =========================================================


  const openInboxBtn =
    document.getElementById(
      "openInboxBtn"
    );


  const inboxWindow =
    document.getElementById(
      "inboxWindow"
    );


  const inboxBackBtn =
    document.getElementById(
      "inboxBackBtn"
    );


  const inboxMessages =
    document.getElementById(
      "inboxMessages"
    );



  // =========================================================
  // CURRENT USER
  // =========================================================


  function getCurrentUserId(){

    const id =
      localStorage.getItem(
        "currentUserId"
      );


    return id
      ? Number(id)
      : null;

  }




  // =========================================================
  // FORMAT TIME
  // =========================================================


  function formatInboxTime(
    createdAt
  ){

    if(!createdAt)
      return "";


    const date =
      new Date(
        createdAt
      );


    if(
      isNaN(
        date.getTime()
      )
    ){

      return "";

    }



    return date.toLocaleString(
      [],
      {
        year:"numeric",
        month:"numeric",
        day:"numeric",
        hour:"numeric",
        minute:"2-digit",
        hour12:true
      }
    );

  }





  // =========================================================
  // OPEN INBOX
  // =========================================================


  openInboxBtn?.addEventListener(
    "click",
    async ()=>{


      const userId =
        getCurrentUserId();



      if(!userId){

        alert(
          "Please log in first!"
        );

        return;

      }



      inboxWindow.style.display =
        "flex";



      await loadInbox();



      // Mark inbox messages read

      await markInboxAsRead();



      // Update:
      // Inbox
      // Customer Service
      // Bottom Chat

      await updateAllUnread();


    }
  );





  // =========================================================
  // CLOSE INBOX
  // =========================================================


  inboxBackBtn?.addEventListener(
    "click",
    ()=>{


      inboxWindow.style.display =
        "none";


    }
  );







  // =========================================================
  // LOAD INBOX
  // =========================================================


  async function loadInbox(){


    const userId =
      getCurrentUserId();



    if(!userId)
      return;




    inboxMessages.innerHTML =
    `
      <div class="inbox-loading">
        Loading...
      </div>
    `;




    const {
      data,
      error
    }
    =
    await supabaseClient
      .from(
        "inbox_messages"
      )
      .select(
        `
        id,
        user_id,
        title,
        content,
        is_read,
        created_at
        `
      )
      .eq(
        "user_id",
        userId
      )
      .order(
        "created_at",
        {
          ascending:false
        }
      );





    if(error){


      console.error(
        "Failed to load inbox:",
        error
      );



      inboxMessages.innerHTML =
      `
        <div class="inbox-error">
          Failed to load messages
        </div>
      `;


      return;


    }





    if(
      !data ||
      data.length===0
    ){


      inboxMessages.innerHTML =
      `
        <div class="inbox-empty">
          No messages
        </div>
      `;


      return;


    }






    inboxMessages.innerHTML =
      "";




    data.forEach(
      message=>{


        appendInboxMessage(
          message
        );


      }
    );



  }









  // =========================================================
  // APPEND MESSAGE
  // =========================================================


  function appendInboxMessage(
    message
  ){


    const item =
      document.createElement(
        "div"
      );



    item.classList.add(
      "inbox-item"
    );




    if(
      !message.is_read
    ){

      item.classList.add(
        "unread"
      );

    }





    const title =
      document.createElement(
        "div"
      );


    title.classList.add(
      "inbox-item-title"
    );


    title.textContent =
      message.title || "";







    const content =
      document.createElement(
        "div"
      );


    content.classList.add(
      "inbox-item-content"
    );


    content.textContent =
      message.content || "";








    const time =
      document.createElement(
        "div"
      );


    time.classList.add(
      "inbox-item-time"
    );


    time.textContent =
      formatInboxTime(
        message.created_at
      );






    item.appendChild(
      title
    );


    item.appendChild(
      content
    );


    item.appendChild(
      time
    );



    inboxMessages.appendChild(
      item
    );


  }









  // =========================================================
  // MARK INBOX READ
  // =========================================================


  async function markInboxAsRead(){


    const userId =
      getCurrentUserId();



    if(!userId)
      return;





    const {
      error
    }
    =
    await supabaseClient
      .from(
        "inbox_messages"
      )
      .update(
        {
          is_read:true
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





    if(error){


      console.error(
        "Failed to mark inbox read:",
        error
      );


    }


  }









  // =========================================================
  // REALTIME INBOX
  // =========================================================


  let inboxSubscription =
    null;





  function listenInboxRealtime(){


    const userId =
      getCurrentUserId();



    if(!userId)
      return;





    if(
      inboxSubscription
    ){

      supabaseClient.removeChannel(
        inboxSubscription
      );

    }






    inboxSubscription =
      supabaseClient
      .channel(
        "inbox-realtime-" +
        userId
      )
      .on(

        "postgres_changes",

        {
          event:"INSERT",
          schema:"public",
          table:"inbox_messages",
          filter:
          `user_id=eq.${userId}`
        },

        async ()=>{


          await loadInbox();


          await updateAllUnread();


        }

      )
      .subscribe();



  }









  // =========================================================
  // INITIALIZE
  // =========================================================


  listenInboxRealtime();


  updateAllUnread();



});
