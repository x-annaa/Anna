document.addEventListener("DOMContentLoaded", () => {


  // =========================================================
  // ELEMENTS
  // =========================================================


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



  let chatSubscription = null;



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


  function formatMessageTime(
    createdAt
  ){

    if(!createdAt)
      return "";


    const date =
      new Date(createdAt);


    if(isNaN(date.getTime()))
      return "";


    return date.toLocaleString([],{

      year:"numeric",
      month:"numeric",
      day:"numeric",
      hour:"numeric",
      minute:"2-digit",
      hour12:true

    });

  }





  // =========================================================
  // INPUT HEIGHT
  // =========================================================


  chatInput?.addEventListener(
    "input",
    ()=>{


      chatInput.style.height =
        "auto";


      chatInput.style.height =
        chatInput.scrollHeight +
        "px";


      scrollToBottom();


    }
  );






  // =========================================================
  // OPEN CHAT
  // =========================================================


  openChatBtn?.addEventListener(
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



      chatWindow.style.display =
        "flex";


      chatWindow.classList.remove(
        "hidden"
      );



      chatMessages.innerHTML =
        "";



      await loadMessages();



      listenForMessages();



      await markMessagesAsRead();



      // 更新 Customer Service + Inbox + Bottom Chat

      await updateAllUnread();



      scrollToBottom();


    }
  );







  // =========================================================
  // CLOSE CHAT
  // =========================================================


  backBtn?.addEventListener(
    "click",
    ()=>{


      chatWindow.style.display =
        "none";


      chatWindow.classList.add(
        "hidden"
      );



      if(chatSubscription){


        supabaseClient.removeChannel(
          chatSubscription
        );


        chatSubscription =
          null;

      }


    }
  );







  // =========================================================
  // SEND MESSAGE
  // =========================================================


  sendBtn?.addEventListener(
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




      const content =
        chatInput.value.trim();



      if(!content)
        return;




      sendBtn.disabled =
        true;



      const {

        data:newMessage,

        error

      }
      =
      await supabaseClient
      .from("messages")
      .insert([{


        sender_id:userId,

        receiver_id:1,

        content:content,

        is_read:false


      }])
      .select(
        "id,sender_id,receiver_id,content,created_at"
      )
      .single();




      sendBtn.disabled =
        false;



      if(error){


        console.error(
          error
        );


        alert(
          "Sending failed: " +
          error.message
        );


        return;

      }





      appendMessage(

        "Me",

        newMessage.content,

        newMessage.created_at

      );



      chatInput.value =
        "";


      chatInput.style.height =
        "auto";



      scrollToBottom();



    }
  );








  // =========================================================
  // APPEND MESSAGE
  // =========================================================


  function appendMessage(

    sender,

    text,

    createdAt

  ){



    if(!chatMessages)
      return;




    const item =
      document.createElement(
        "div"
      );



    item.classList.add(

      "message-item",

      sender==="Me"
      ? "me"
      : "bot"

    );





    const messageText =
      document.createElement(
        "div"
      );


    messageText.className =
      "message-text";


    messageText.textContent =
      text || "";





    const time =
      document.createElement(
        "div"
      );


    time.className =
      "message-time";



    time.textContent =
      formatMessageTime(
        createdAt
      );





    item.appendChild(
      messageText
    );


    item.appendChild(
      time
    );



    chatMessages.appendChild(
      item
    );



    scrollToBottom();



  }







  // =========================================================
  // SCROLL
  // =========================================================


  function scrollToBottom(){


    if(!chatMessages)
      return;


    chatMessages.scrollTop =
      chatMessages.scrollHeight;


  }








  // =========================================================
  // LOAD HISTORY
  // =========================================================


  async function loadMessages(){



    const userId =
      getCurrentUserId();



    if(!userId)
      return;





    const {

      data,

      error

    }

    =
    await supabaseClient
    .from("messages")
    .select(
      "id,sender_id,receiver_id,content,created_at,is_read"
    )
    .or(

      `and(sender_id.eq.${userId},receiver_id.eq.1),and(sender_id.eq.1,receiver_id.eq.${userId})`

    )
    .order(

      "created_at",

      {
        ascending:true
      }

    );





    if(error){


      console.error(
        error
      );


      return;

    }





    if(!data || data.length===0){


      chatMessages.innerHTML =
      `
      <div style="
      text-align:center;
      color:#999;
      padding:20px;">
      No messages
      </div>
      `;


      return;

    }





    data.forEach(
      msg=>{


        appendMessage(

          msg.sender_id===userId
          ? "Me"
          : "Customer Service",

          msg.content,

          msg.created_at

        );


      }
    );



  }









  // =========================================================
  // MARK CUSTOMER SERVICE READ
  // =========================================================


  async function markMessagesAsRead(){


    const userId =
      getCurrentUserId();



    if(!userId)
      return;





    await supabaseClient
    .from("messages")
    .update({

      is_read:true

    })
    .eq(

      "receiver_id",

      userId

    )
    .eq(

      "is_read",

      false

    );



  }









  // =========================================================
  // REALTIME
  // =========================================================


  function listenForMessages(){


    const userId =
      getCurrentUserId();



    if(!userId)
      return;





    if(chatSubscription){


      supabaseClient.removeChannel(
        chatSubscription
      );


    }





    chatSubscription =

    supabaseClient

    .channel(
      "customer-service-" + userId
    )

    .on(

      "postgres_changes",

      {

        event:"INSERT",

        schema:"public",

        table:"messages",

        filter:
        `receiver_id=eq.${userId}`


      },

      async(payload)=>{


        const msg =
          payload.new;



        if(

          msg.sender_id===1

        ){



          if(

            chatWindow.style.display
            !==
            "none"

          ){



            appendMessage(

              "Customer Service",

              msg.content,

              msg.created_at

            );



            await markMessagesAsRead();



          }


        }



        await updateAllUnread();



      }

    )

    .subscribe();



  }









  // =========================================================
  // MOBILE KEYBOARD
  // =========================================================


  function adjustChatForKeyboard(){


    if(!chatWindow)
      return;




    const initialHeight =
      window.innerHeight;




    window.addEventListener(
      "resize",
      ()=>{


        const current =
          window.innerHeight;



        const keyboard =
          initialHeight-current;




        if(keyboard>100){


          chatWindow.style.bottom =
            "0";


          chatWindow.style.top =
            "auto";



        }
        else{


          chatWindow.style.top =
            "50%";


          chatWindow.style.bottom =
            "auto";


        }



        scrollToBottom();



      }
    );


  }








  // =========================================================
  // INIT
  // =========================================================


  adjustChatForKeyboard();


  updateAllUnread();



});
