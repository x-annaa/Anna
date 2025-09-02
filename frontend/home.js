// ======================
// 当前登录用户
// ======================
let currentUser = null;

// ======================
// 页面切换
// ======================
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

// ======================
// 加载用户信息
// ======================
async function loadUserInfo(username) {
  if (!username) return;

  const { data, error } = await supabaseClient
    .from("users")
    .select("platform_account, coins, balance, level")
    .eq("username", username)
    .single();

  if (error || !data) {
    console.error("加载用户失败：", error?.message);
    document.getElementById("platformAccount").textContent = "错误";
    document.getElementById("coins").textContent = "错误";
    document.getElementById("balance").textContent = "错误";
    return;
  }

  currentUser = data; // 保存当前用户对象

  // 更新页面显示
  document.getElementById("platformAccount").textContent =
    data.platform_account || "未知";
  document.getElementById("coins").textContent =
    (Number(data.coins) || 0).toFixed(2);
  document.getElementById("ordercoins").textContent =
    (Number(data.coins) || 0).toFixed(2);
  document.getElementById("balance").textContent =
    (Number(data.balance) || 0).toFixed(2);

  // 同步 ID 给订单页用
  window.currentUserId = data.id;

  // ✅ 存到 localStorage，方便其他页面用
  localStorage.setItem("currentUserId", data.id);
}

// ======================
// 页面初始化
// ======================
document.addEventListener("DOMContentLoaded", () => {
  const username = localStorage.getItem("currentUser");

  if (!username) {
    window.location.href = "../index.html"; // 没有登录过 -> 回登录页
    return;
  }

  loadUserInfo(username);
});

// ======================
// Logout 弹窗
// ======================
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
  // ✅ 清理账号信息
  localStorage.removeItem("currentUser");
  localStorage.removeItem("currentUserId");
  window.location.href = "../index.html";
});

// ======================
// Coins 兑换弹窗
// ======================
const addCoinsBtn = document.getElementById("addCoinsBtn");
const addCoinsModal = document.getElementById("addCoinsModal");
const cancelAddCoins = document.getElementById("cancelAddCoins");
const confirmAddCoins = document.getElementById("confirmAddCoins");

if (addCoinsBtn) {
  addCoinsBtn.addEventListener("click", () => {
    addCoinsModal.style.display = "flex";
  });
}

if (cancelAddCoins) {
  cancelAddCoins.addEventListener("click", () => {
    addCoinsModal.style.display = "none";
  });
}

if (confirmAddCoins) {
  confirmAddCoins.addEventListener("click", () => {
    // TODO: 写兑换逻辑（balance 扣钱，coins 增加）
    addCoinsModal.style.display = "none";
  });
}

// ======================
// 点击遮罩层关闭弹窗
// ======================
window.addEventListener("click", (e) => {
  if (e.target === logoutModal) logoutModal.style.display = "none";
  if (e.target === addCoinsModal) addCoinsModal.style.display = "none";
});

// ======================
// 按 ESC 键关闭弹窗
// ======================
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    logoutModal.style.display = "none";
    addCoinsModal.style.display = "none";
  }
});
