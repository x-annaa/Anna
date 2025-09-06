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
      .select("id, platform_account, balance")
      .eq("username", username)
      .single();

    if (error || !data) {
      console.error("加载用户失败：", error?.message);
      document.getElementById("platformAccount").textContent = "错误";
      document.getElementById("balance").textContent = "错误";
      return;
    }

    currentUser = data;

    document.getElementById("platformAccount").textContent =
      data.platform_account || "未知";
    document.getElementById("balance").textContent =
      (Number(data.balance) || 0).toFixed(2);

    window.currentUserId = data.id;
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
  localStorage.removeItem("currentUser");
  localStorage.removeItem("currentUserId");
  window.location.href = "../index.html";
});

// ======================
// 点击遮罩层 & ESC 关闭弹窗
// ======================
window.addEventListener("click", (e) => {
  if (
    e.target === logoutModal ||
    e.target === rechargeModal ||
    e.target === withdrawModal
  ) {
    e.target.style.display = "none";
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    logoutModal.style.display = "none";
    rechargeModal.style.display = "none";
    withdrawModal.style.display = "none";
  }
});

// ======================
// Withdraw / Recharge 弹窗
// ======================
const withdrawBtn = document.getElementById("withdrawBtn");
const rechargeBtn = document.getElementById("rechargeBtn");
const withdrawModal = document.getElementById("withdrawModal");
const rechargeModal = document.getElementById("rechargeModal");
const cancelWithdraw = document.getElementById("cancelWithdraw");
const confirmWithdraw = document.getElementById("confirmWithdraw");
const cancelRecharge = document.getElementById("cancelRecharge");
const submitRecharge = document.getElementById("submitRecharge");

// 显示弹窗
withdrawBtn.addEventListener("click", () => (withdrawModal.style.display = "flex"));
rechargeBtn.addEventListener("click", () => (rechargeModal.style.display = "flex"));

// 取消弹窗
cancelWithdraw.addEventListener("click", () => (withdrawModal.style.display = "none"));
cancelRecharge.addEventListener("click", () => (rechargeModal.style.display = "none"));

// 确认提现（这里可调用 API 或 Supabase 更新余额）
confirmWithdraw.addEventListener("click", async () => {
  const amount = parseFloat(document.getElementById("withdrawAmount").value);
  if (!amount || amount <= 0) return alert("请输入正确金额");

  // 示例：直接显示提示，实际可调用提现接口
  alert(`提现成功: ${amount} USDT`);
  withdrawModal.style.display = "none";
});

// ======================
// 充值逻辑
// ======================
const rechargeOptions = document.querySelectorAll(".recharge-options button");
const selectedMethodEl = document.getElementById("selectedMethod");
const networkProtocolEl = document.getElementById("networkProtocol");
const walletAddressEl = document.getElementById("walletAddress");
const copyWalletBtn = document.getElementById("copyWallet");

rechargeOptions.forEach((btn) => {
  btn.addEventListener("click", () => {
    const method = btn.dataset.method;
    selectedMethodEl.textContent = method;

    // 根据选择切换显示
    if (method === "USDT") {
      networkProtocolEl.textContent = "TRC20";
      walletAddressEl.textContent = "TX6aSYyGVTf1NsXWzY3kUC9pTQPJPagJH";
    } else if (method === "BNB") {
      networkProtocolEl.textContent = "BEP20";
      walletAddressEl.textContent = "BNB1234567890EXAMPLE";
    } else if (method === "Telegram") {
      networkProtocolEl.textContent = "-";
      walletAddressEl.textContent = "@你的Telegram";
    }
  });
});

// 复制钱包地址
copyWalletBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(walletAddressEl.textContent).then(() => {
    alert("已复制钱包地址");
  });
});

// 提交充值（示例逻辑）
submitRecharge.addEventListener("click", () => {
  alert(`充值方式: ${selectedMethodEl.textContent} 提交成功`);
  rechargeModal.style.display = "none";
});
