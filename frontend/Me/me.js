// ======================
// 当前登录用户
// ======================
let currentUser = null;

// ======================
// 加载用户信息
// ======================
async function loadUserInfo(username) {
  if (!username) return;

  try {
    const { data, error } = await supabaseClient
      .from("users")
      .select("id, platform_account, balance") // 去掉 coins
      .eq("username", username)
      .single();

    if (error || !data) {
      console.error("加载用户失败：", error?.message);
      document.getElementById("platformAccount").textContent = "错误";
      document.getElementById("balance").textContent = "错误";
      return;
    }

    currentUser = data; // 保存当前用户对象

    // 更新页面显示
    document.getElementById("platformAccount").textContent =
      data.platform_account || "未知";
    document.getElementById("balance").textContent =
      (Number(data.balance) || 0).toFixed(2);

    // 同步 ID 给订单页用
    window.currentUserId = data.id;

    // ✅ 存到 localStorage，方便其他页面用
    localStorage.setItem("currentUserId", data.id);
  } catch (e) {
    console.error("加载用户信息异常：", e);
  }
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
// 点击遮罩层关闭弹窗
// ======================
window.addEventListener("click", (e) => {
  if (e.target === logoutModal) logoutModal.style.display = "none";
});

// ======================
// 按 ESC 键关闭弹窗
// ======================
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    logoutModal.style.display = "none";
  }
});
