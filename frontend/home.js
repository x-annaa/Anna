// 页面切换
const buttons = document.querySelectorAll(".bottom-nav button");
const pages = document.querySelectorAll(".page");

buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    // 切换高亮
    buttons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // 切换页面
    const pageId = btn.dataset.page;
    pages.forEach(p => p.classList.remove("active"));
    document.getElementById(pageId).classList.add("active");
  });
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
  // 清除用户信息（如果有）
  localStorage.removeItem("user");
  // 跳转到登录页面
  window.location.href = "../index.html";
});
