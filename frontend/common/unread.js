async function updateAllUnread(){

    const userId =
        Number(localStorage.getItem("currentUserId"));


    if(!userId) return;



    // =========================
    // Customer Service unread
    // =========================

    const {
        count: chatUnread
    } =
    await supabaseClient
    .from("messages")
    .select(
        "id",
        {
            count:"exact",
            head:true
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



    // =========================
    // Inbox unread
    // =========================

    const {
        count: inboxUnread
    }
    =
    await supabaseClient
    .from("inbox_messages")
    .select(
        "id",
        {
            count:"exact",
            head:true
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



    const chat =
        chatUnread || 0;


    const inbox =
        inboxUnread || 0;



    // =========================
    // Customer Service dot
    // =========================

    updateDot(
        document.querySelector(
            "#openChatBtn .unread-dot"
        ),
        chat
    );



    // =========================
    // Inbox dot
    // =========================

    updateDot(
        document.getElementById(
            "inboxUnreadDot"
        ),
        inbox
    );



    // =========================
    // Bottom Chat total
    // =========================

    updateDot(
        document.querySelector(
            "button[data-page='msgPage'] .bottom-unread-dot"
        ),
        chat + inbox
    );


}




function updateDot(
    element,
    number
){

    if(!element)
        return;


    if(number > 0){

        element.textContent =
            number > 99
            ? "99+"
            : number;


        element.style.display =
            "inline-block";


        element.classList.remove(
            "show"
        );


        void element.offsetWidth;


        element.classList.add(
            "show"
        );


    }
    else{


        element.textContent =
            "";


        element.style.display =
            "none";


        element.classList.remove(
            "show"
        );

    }

}
