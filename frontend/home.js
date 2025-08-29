// ⚡ 初始化 Supabase
const SUPABASE_URL = "https://ffdrwsemmfvqlqhyjlnb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZHJ3c2VtbWZ2cWxxaHlqbG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMDI1ODQsImV4cCI6MjA3MTg3ODU4NH0.x7TQHZ2af8O_f9ye__mT6eVstlH9BiyVkNVaOnL3h74";  
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 读取当前登录的用户
const currentUser = localStorage.getItem("currentUser");

if (!currentUser) {
  // 没有登录过 -> 跳回登录页面
  window.location.href = "../index.html";
}

// 页面切换
const buttons = document.querySelectorAll(".bottom-nav button");
const pages = document.querySelectorAll(".page");

buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    buttons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const pageId = btn.dataset.page;
    pages.forEach(p => p.classList.remove("active"));
    document.getElementById(pageId).classList.add("active");
  });
});

// 🔎 加载用户信息
async function loadUserInfo() {
  const { data, error } = await supabaseClient
    .from("users")
    .select("platform_account, balance")
    .eq("username", currentUser)
    .single();

  if (error) {
    console.error("加载用户失败：", error.message);
    document.getElementById("platformAccount").textContent = "错误";
    document.getElementById("balance").textContent = "错误";
  } else if (data) {
    document.getElementById("platformAccount").textContent = data.platform_account;
    document.getElementById("balance").textContent = data.balance;
  }
}

loadUserInfo();

// Logout 弹窗
const logoutBtn = document.getElementById("logoutBtn");
const logoutModal = document.getElementById("logoutModal");
const cancelLogout = document.getElementById("cancelLogout");
const confirmLogout = document.getElementById("confirmLogout");

logoutBtn.addEventListener("click", () => {
  logoutModal.style.display = "flex";
});

cancelLogout.addEventListener("click", () => {
  logoutModal.style.display = "none";
});

confirmLogout.addEventListener("click", () => {
  localStorage.removeItem("currentUser"); // ✅ 清除登录状态
  window.location.href = "../index.html"; // 回到登录注册页面
});
