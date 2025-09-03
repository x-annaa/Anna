// =======================
// 加载用户信息
// =======================
async function loadUserInfo() {
  const userId = localStorage.getItem("currentUserId");
  if (!userId) {
    alert("未登录，请重新登录");
    window.location.href = "../index.html";
    return;
  }

  try {
    // 去数据库获取用户完整信息
    const { data, error } = await supabaseClient
      .from("users")
      .select("id, username, platform_account, coins, balance")
      .eq("id", userId)
      .single();

    if (error) throw error;

    // 显示在页面上
    document.getElementById("platformAccount").textContent =
      data.platform_account || "未知";
    document.getElementById("coins").textContent = data.coins ?? 0;
    document.getElementById("balance").textContent = data.balance ?? 0;
  } catch (err) {
    console.error("❌ 加载用户失败：", err);
    alert("加载用户信息失败，请重新登录");
    localStorage.clear();
    window.location.href = "../index.html";
  }
}

// =======================
// 退出登录
// =======================
document.getElementById("logoutBtn").addEventListener("click", () => {
  const modal = document.getElementById("logoutModal");
  modal.style.display = "block";

  document.getElementById("cancelLogout").onclick = () => {
    modal.style.display = "none";
  };
  document.getElementById("confirmLogout").onclick = () => {
    localStorage.clear();
    window.location.href = "../index.html";
  };
});

// =======================
// 页面切换（底部导航）
// =======================
document.querySelectorAll(".bottom-nav button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetPage = btn.getAttribute("data-page");

    document.querySelectorAll(".page").forEach((page) => {
      page.classList.remove("active");
    });
    document.querySelectorAll(".bottom-nav button").forEach((b) => {
      b.classList.remove("active");
    });

    document.getElementById(targetPage).classList.add("active");
    btn.classList.add("active");
  });
});

// =======================
// 初始化
// =======================
document.addEventListener("DOMContentLoaded", loadUserInfo);
