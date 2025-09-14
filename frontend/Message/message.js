const chatUsersList = document.getElementById("chatUsersList");
const adminChatWindow = document.getElementById("adminChatWindow");
const adminBackBtn = document.getElementById("adminBackBtn");
const adminChatUserInfo = document.getElementById("adminChatUserInfo");
const adminChatMessages = document.getElementById("adminChatMessages");
const adminChatInput = document.getElementById("adminChatInput");
const adminSendBtn = document.getElementById("adminSendBtn");

let currentChatUserId = null;
let adminChatSubscription = null;

// =======================
// 加载所有发消息的用户
// =======================
async function loadChatUsers() {
  const { data, error } = await supabaseClient
    .from("messages")
    .select(`sender_id, sender:users(username)`)
    .eq("receiver_id", 1) // 客服ID
    .order("created_at", { ascending: false });

  if (error) return console.error(error);

  // 去重用户
  const uniqueUsersMap = {};
  data.forEach(msg => {
    uniqueUsersMap[msg.sender_id] = msg.sender?.username || "用户" + msg.sender_id;
  });

  chatUsersList.innerHTML = "";
  Object.entries(uniqueUsersMap).forEach(([id, name]) => {
    const li = document.createElement("li");
    li.textContent = `ID: ${id} - ${name}`;
    li.dataset.userid = id;
    li.dataset.username = name;
    li.addEventListener("click", () => openAdminChat(id, name));
    chatUsersList.appendChild(li);
  });
}

// =======================
// 打开聊天窗口
// =======================
async function openAdminChat(userId, username) {
  currentChatUserId = userId;
  adminChatUserInfo.textContent = `用户ID: ${userId} - ${username}`;
  adminChatMessages.innerHTML = "";
  adminChatWindow.style.display = "flex";

  await loadAdminMessages(userId);
  listenAdminMessages(userId);
}

// =======================
// 关闭聊天窗口
// =======================
adminBackBtn.addEventListener("click", () => {
  adminChatWindow.style.display = "none";
  if (adminChatSubscription) {
    supabaseClient.removeChannel(adminChatSubscription);
    adminChatSubscription = null;
  }
});

// =======================
// 发送消息
// =======================
adminSendBtn.addEventListener("click", async () => {
  const content = adminChatInput.value.trim();
  if (!content || !currentChatUserId) return;

  const { data, error } = await supabaseClient
    .from("messages")
    .insert([
      {
        sender_id: 1, // 管理员/客服
        receiver_id: currentChatUserId,
        content: content
      }
    ]);

  if (error) return console.error(error);

  appendAdminMessage("admin", content);
  adminChatInput.value = "";
});

// =======================
// 显示消息
// =======================
function appendAdminMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("admin-message-item");
  msg.classList.add(sender);
  msg.textContent = text;
  adminChatMessages.prepend(msg);
  adminChatMessages.scrollTop = adminChatMessages.scrollHeight;
}

// =======================
// 加载历史消息
// =======================
async function loadAdminMessages(userId) {
  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .or(`and(sender_id.eq.${userId},receiver_id.eq.1),and(sender_id.eq.1,receiver_id.eq.${userId})`)
    .order("created_at", { ascending: true });

  if (error) return console.error(error);

  data.forEach(msg => {
    appendAdminMessage(msg.sender_id === 1 ? "admin" : "user", msg.content);
  });
}

// =======================
// 实时监听用户消息
// =======================
function listenAdminMessages(userId) {
  if (adminChatSubscription) {
    supabaseClient.removeChannel(adminChatSubscription);
  }

  adminChatSubscription = supabaseClient
    .channel("admin-realtime")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `sender_id=eq.${userId}`
      },
      (payload) => {
        const msg = payload.new;
        if (msg.receiver_id === 1) appendAdminMessage("user", msg.content);
      }
    )
    .subscribe();
}

// =======================
// 初始化
// =======================
loadChatUsers();
