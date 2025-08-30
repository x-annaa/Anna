// 当前登录用户
let currentUser = null;

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
async function loadUserInfo(username) {
  if (!username) return;

  const { data, error } = await supabaseClient
    .from("users")
    .select("id, platform_account, balance")
    .eq("username", username)
    .single();

  if (error || !data) {
    console.error("加载用户失败：", error?.message);
    document.getElementById("platformAccount").textContent = "错误";
    document.getElementById("balance").textContent = "错误";
    return;
  }

  currentUser = data; // 保存当前用户对象

  document.getElementById("platformAccount").textContent = data.platform_account;
  document.getElementById("balance").textContent = data.balance;

  // 同步给订单页面用
  document.getElementById("orderBalance").textContent = data.balance;
  window.currentUserId = data.id;
}

document.addEventListener("DOMContentLoaded", () => {
  const username = localStorage.getItem("currentUser");

  if (!username) {
    window.location.href = "../index.html";
    return;
  }

  loadUserInfo(username);
});

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
  localStorage.removeItem("currentUser");
  window.location.href = "../index.html";
});
