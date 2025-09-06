// ======================
// 当前登录用户（全局）
// ======================
window.currentUser = window.currentUser || null;

// ======================
// 页面初始化
// ======================
document.addEventListener("DOMContentLoaded", async () => {
  const username = localStorage.getItem("currentUser");
  if (!username) {
    window.location.href = "../index.html";
    return;
  }

  await loadUserInfo(username);
  setupLogout();
  setupWithdraw();
  setupWithdrawPassword();
});

// ======================
// 加载用户信息
// ======================
async function loadUserInfo(username) {
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

    window.currentUser = data;
    document.getElementById("username").textContent = data.username || "未知";
    document.getElementById("platformAccount").textContent = data.platform_account || "未知";
    document.getElementById("balance").textContent = (Number(data.balance) || 0).toFixed(2);

    window.currentUserId = data.id;
    localStorage.setItem("currentUserId", data.id);

    const setPasswordBtn = document.getElementById("setPasswordBtn");
    if (data.withdraw_password) {
      localStorage.setItem("hasWithdrawPwd", "true");
      setPasswordBtn.textContent = "更新密码";
    } else {
      localStorage.setItem("hasWithdrawPwd", "false");
      setPasswordBtn.textContent = "添加提现密码";
    }
  } catch (e) {
    console.error("加载用户信息异常：", e);
  }
}

// ======================
// Logout 弹窗
// ======================
function setupLogout() {
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
}

// ======================
// 提现流程
// ======================
function setupWithdraw() {
  const withdrawBtn = document.getElementById("withdrawBtn");
  const withdrawModal = document.getElementById("withdrawModal");
  const withdrawBalance = document.getElementById("withdrawBalance");

  withdrawBtn.addEventListener("click", () => {
    withdrawBalance.textContent = document.getElementById("balance").textContent;
    withdrawModal.style.display = "flex";
  });

  document.getElementById("cancelWithdraw").addEventListener("click", () => {
    withdrawModal.style.display = "none";
  });

  document.getElementById("confirmWithdraw").addEventListener("click", () => {
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

  document.getElementById("submitWithdrawFinal").addEventListener("click", async () => {
    const inputPwd = document.getElementById("inputWithdrawPwd").value;
    const amount = parseFloat(document.getElementById("withdrawAmount").value);
    const address = document.getElementById("walletAddress").value;

    if (inputPwd !== window.currentUser.withdraw_password) {
      alert("密码错误！");
      return;
    }
    if (!amount || amount < 10) {
      alert("提现金额必须 ≥ 10");
      return;
    }
    if (!address) {
      alert("请输入钱包地址");
      return;
    }
    if (amount > Number(window.currentUser.balance)) {
      alert("余额不足");
      return;
    }

    try {
      // 插入 withdrawals 表
      const { error } = await supabaseClient
        .from("withdrawals")
        .insert([{
          user_id: Number(window.currentUser.id),
          amount: amount,
          wallet_address: address,
          status: "pending"
        }]);
      if (error) throw error;

      // 插入系统消息到 messages 表
      if (window.addWithdrawMessage) {
        window.addWithdrawMessage(amount);
      }

      alert("提现申请已提交，等待后台审核！");

      // 前端更新余额
      window.currentUser.balance -= amount;
      document.getElementById("balance").textContent = window.currentUser.balance.toFixed(2);

      // 清理并关闭
      withdrawModal.style.display = "none";
      document.getElementById("confirmPwdModal").style.display = "none";
      document.getElementById("withdrawAmount").value = "";
      document.getElementById("walletAddress").value = "";
      document.getElementById("inputWithdrawPwd").value = "";
    } catch (e) {
      console.error("提现申请失败：", e.message);
      alert("提现申请失败：" + e.message);
    }
  });

  document.getElementById("cancelConfirmPwd").addEventListener("click", () => {
    document.getElementById("confirmPwdModal").style.display = "none";
  });

  // ESC / 点击遮罩层关闭
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) e.target.style.display = "none";
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal").forEach(m => (m.style.display = "none"));
    }
  });
}

// ======================
// 提现密码设置/更新
// ======================
function setupWithdrawPassword() {
  const setPasswordBtn = document.getElementById("setPasswordBtn");
  const setPasswordModal = document.getElementById("setPasswordModal");
  const updatePasswordModal = document.getElementById("updatePasswordModal");

  setPasswordBtn.addEventListener("click", () => {
    if (localStorage.getItem("hasWithdrawPwd") === "true") {
      updatePasswordModal.style.display = "flex";
    } else {
      setPasswordModal.style.display = "flex";
    }
  });

  // 设置密码
  document.getElementById("saveWithdrawPwd").addEventListener("click", async () => {
    const pwd = document.getElementById("withdrawPwd").value;
    const confirmPwd = document.getElementById("confirmWithdrawPwd").value;

    if (!/^\d{6}$/.test(pwd)) {
      alert("请输入6位数字密码");
      return;
    }
    if (pwd !== confirmPwd) {
      alert("两次输入密码不一致");
      return;
    }

    try {
      const { error } = await supabaseClient
        .from("users")
        .update({ withdraw_password: pwd })
        .eq("id", window.currentUser.id);
      if (error) throw error;

      localStorage.setItem("hasWithdrawPwd", "true");
      setPasswordBtn.textContent = "更新密码";
      window.currentUser.withdraw_password = pwd;
      alert("提现密码设置成功！");
      setPasswordModal.style.display = "none";
      document.getElementById("withdrawPwd").value = "";
      document.getElementById("confirmWithdrawPwd").value = "";
    } catch (e) {
      console.error("保存密码失败：", e.message);
      alert("保存密码失败：" + e.message);
    }
  });

  document.getElementById("cancelSetPwd").addEventListener("click", () => {
    setPasswordModal.style.display = "none";
  });

  // 更新密码
  document.getElementById("saveUpdatePwd").addEventListener("click", async () => {
    const oldPwd = document.getElementById("oldWithdrawPwd").value;
    const newPwd = document.getElementById("newWithdrawPwd").value;
    const confirmNewPwd = document.getElementById("confirmNewWithdrawPwd").value;

    if (oldPwd !== window.currentUser.withdraw_password) {
      alert("原密码错误！");
      return;
    }
    if (!/^\d{6}$/.test(newPwd)) {
      alert("新密码必须是6位数字");
      return;
    }
    if (newPwd !== confirmNewPwd) {
      alert("两次新密码不一致");
      return;
    }

    try {
      const { error } = await supabaseClient
        .from("users")
        .update({ withdraw_password: newPwd })
        .eq("id", window.currentUser.id);
      if (error) throw error;

      window.currentUser.withdraw_password = newPwd;
      alert("提现密码更新成功！");
      updatePasswordModal.style.display = "none";
      document.getElementById("oldWithdrawPwd").value = "";
      document.getElementById("newWithdrawPwd").value = "";
      document.getElementById("confirmNewWithdrawPwd").value = "";
    } catch (e) {
      console.error("更新密码失败：", e.message);
      alert("更新密码失败：" + e.message);
    }
  });

  document.getElementById("cancelUpdatePwd").addEventListener("click", () => {
    updatePasswordModal.style.display = "none";
  });
}
