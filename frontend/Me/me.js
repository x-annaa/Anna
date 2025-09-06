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
      .select("id, username, platform_account, balance, withdraw_password")
      .eq("username", username)
      .single();

    if (error || !data) {
      console.error("加载用户失败：", error?.message);
      document.getElementById("platformAccount").textContent = "错误";
      document.getElementById("balance").textContent = "错误";
      return;
    }

    currentUser = data;

    // 更新显示
    document.getElementById("username").textContent = data.username || "未知";
    document.getElementById("platformAccount").textContent =
      data.platform_account || "未知";
    document.getElementById("balance").textContent = (
      Number(data.balance) || 0
    ).toFixed(2);

    // 保存 ID 和是否设置过提现密码
    window.currentUserId = data.id;
    localStorage.setItem("currentUserId", data.id);
    localStorage.setItem(
      "hasWithdrawPwd",
      data.withdraw_password ? "true" : "false"
    );
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
  localStorage.removeItem("currentUser");
  localStorage.removeItem("currentUserId");
  localStorage.removeItem("hasWithdrawPwd");
  window.location.href = "../index.html";
});

// ======================
// 点击遮罩层关闭所有弹窗
// ======================
window.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal")) {
    e.target.style.display = "none";
  }
});

// ======================
// 按 ESC 键关闭所有弹窗
// ======================
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal").forEach((m) => (m.style.display = "none"));
  }
});

// ======================
// 提现逻辑
// ======================
const withdrawBtn = document.getElementById("withdrawBtn");
const withdrawModal = document.getElementById("withdrawModal");
const cancelWithdraw = document.getElementById("cancelWithdraw");
const confirmWithdraw = document.getElementById("confirmWithdraw");
const withdrawBalance = document.getElementById("withdrawBalance");

withdrawBtn.addEventListener("click", () => {
  withdrawBalance.textContent = document.getElementById("balance").textContent;
  withdrawModal.style.display = "flex";
});

cancelWithdraw.addEventListener("click", () => {
  withdrawModal.style.display = "none";
});

confirmWithdraw.addEventListener("click", () => {
  const amount = document.getElementById("withdrawAmount").value;
  const address = document.getElementById("walletAddress").value;

  if (!amount || !address) {
    alert("请输入金额和钱包地址");
    return;
  }

  if (localStorage.getItem("hasWithdrawPwd") === "true") {
    document.getElementById("confirmPwdModal").style.display = "flex";
  } else {
    alert("请先设置提现密码！");
  }
});

// ======================
// 设置提现密码
// ======================
const setPasswordBtn = document.getElementById("setPasswordBtn");
const setPasswordModal = document.getElementById("setPasswordModal");
const cancelSetPwd = document.getElementById("cancelSetPwd");
const saveWithdrawPwd = document.getElementById("saveWithdrawPwd");

setPasswordBtn.addEventListener("click", () => {
  setPasswordModal.style.display = "flex";
});

cancelSetPwd.addEventListener("click", () => {
  setPasswordModal.style.display = "none";
});

saveWithdrawPwd.addEventListener("click", async () => {
  const pwd = document.getElementById("withdrawPwd").value;
  const confirmPwd = document.getElementById("confirmWithdrawPwd").value;

  if (pwd.length !== 6 || isNaN(pwd)) {
    alert("请输入6位数字密码");
    return;
  }
  if (pwd !== confirmPwd) {
    alert("两次输入的密码不一致");
    return;
  }

  const { error } = await supabaseClient
    .from("users")
    .update({ withdraw_password: pwd })
    .eq("id", currentUser.id);

  if (error) {
    alert("保存密码失败：" + error.message);
    return;
  }

  localStorage.setItem("hasWithdrawPwd", "true");
  alert("提现密码设置成功！");
  setPasswordModal.style.display = "none";
});

// ======================
// 确认提现密码
// ======================
const confirmPwdModal = document.getElementById("confirmPwdModal");
const cancelConfirmPwd = document.getElementById("cancelConfirmPwd");
const submitWithdrawFinal = document.getElementById("submitWithdrawFinal");

cancelConfirmPwd.addEventListener("click", () => {
  confirmPwdModal.style.display = "none";
});

submitWithdrawFinal.addEventListener("click", async () => {
  const inputPwd = document.getElementById("inputWithdrawPwd").value;

  if (inputPwd !== currentUser.withdraw_password) {
    alert("密码错误！");
    return;
  }

  // 模拟保存提现申请，实际你在后端审核
  const amount = document.getElementById("withdrawAmount").value;
  const address = document.getElementById("walletAddress").value;

  console.log("提现申请：", {
    userId: currentUser.id,
    amount,
    address,
  });

  alert("提现申请已提交，等待后台审核！");
  withdrawModal.style.display = "none";
  confirmPwdModal.style.display = "none";
});
