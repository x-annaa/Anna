// ======================
// 当前登录用户
// ======================
let currentUser = null;

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

  // ====== 弹窗管理 ======
  const modalMap = {
    logoutBtn: "logoutModal",
    withdrawBtn: "withdrawModal",
    setPasswordBtn: "setPasswordModal", // 默认是设置密码，如果已设置会改成 updatePasswordModal
  };

  // 打开弹窗
  Object.keys(modalMap).forEach(btnId => {
    const btn = document.getElementById(btnId);
    const modalId = modalMap[btnId];
    if (!btn) return;
    btn.addEventListener("click", () => {
      // 特殊逻辑：设置/更新密码按钮
      if (btnId === "setPasswordBtn") {
        const modalToShow = localStorage.getItem("hasWithdrawPwd") === "true"
          ? document.getElementById("updatePasswordModal")
          : document.getElementById("setPasswordModal");
        modalToShow.style.display = "flex";
        return;
      }

      // 提现按钮逻辑
      if (btnId === "withdrawBtn") {
        document.getElementById("withdrawBalance").textContent =
          document.getElementById("balance").textContent;
      }

      document.getElementById(modalId).style.display = "flex";
    });
  });

  // 统一关闭弹窗（点击遮罩或取消按钮）
  document.body.addEventListener("click", e => {
    if (e.target.classList.contains("modal") ||
        e.target.dataset.dismiss === "modal") {
      const modal = e.target.classList.contains("modal")
        ? e.target
        : e.target.closest(".modal");
      if (modal) modal.style.display = "none";
    }
  });

  // ESC键关闭所有弹窗
  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal").forEach(m => m.style.display = "none");
    }
  });

  // ====== Logout 操作 ======
  document.getElementById("confirmLogout").addEventListener("click", () => {
    ["currentUser", "currentUserId", "hasWithdrawPwd"].forEach(k => localStorage.removeItem(k));
    window.location.href = "../index.html";
  });

  // ====== 提现逻辑 ======
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

  // ====== 设置提现密码 ======
  document.getElementById("saveWithdrawPwd").addEventListener("click", async () => {
    const pwd = document.getElementById("withdrawPwd").value;
    const confirmPwd = document.getElementById("confirmWithdrawPwd").value;

    if (!/^\d{6}$/.test(pwd)) {
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
    document.getElementById("setPasswordBtn").textContent = "更新密码";
    currentUser.withdraw_password = pwd;
    alert("提现密码设置成功！");
    document.getElementById("setPasswordModal").style.display = "none";
  });

  // ====== 更新提现密码 ======
  document.getElementById("saveUpdatePwd").addEventListener("click", async () => {
    const oldPwd = document.getElementById("oldWithdrawPwd").value;
    const newPwd = document.getElementById("newWithdrawPwd").value;
    const confirmNewPwd = document.getElementById("confirmNewWithdrawPwd").value;

    if (oldPwd !== currentUser.withdraw_password) {
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

    const { error } = await supabaseClient
      .from("users")
      .update({ withdraw_password: newPwd })
      .eq("id", currentUser.id);

    if (error) {
      alert("更新密码失败：" + error.message);
      return;
    }

    currentUser.withdraw_password = newPwd;
    alert("提现密码更新成功！");
    document.getElementById("updatePasswordModal").style.display = "none";
  });

  // ====== 确认提现密码 & 提交申请 ======
  document.getElementById("submitWithdrawFinal").addEventListener("click", async () => {
    const inputPwd = document.getElementById("inputWithdrawPwd").value;

    if (inputPwd !== currentUser.withdraw_password) {
      alert("密码错误！");
      return;
    }

    const amount = parseFloat(document.getElementById("withdrawAmount").value);
    const address = document.getElementById("walletAddress").value;

    if (!amount || amount < 10) {
      alert("提现金额必须 ≥ 10");
      return;
    }
    if (!address) {
      alert("请输入钱包地址");
      return;
    }
    if (amount > Number(currentUser.balance)) {
      alert("余额不足");
      return;
    }

    const { error } = await supabaseClient
      .from("withdrawals")
      .insert([{
        user_id: currentUser.id,
        amount,
        wallet_address: address,
        status: "pending"
      }]);

    if (error) {
      alert("提现申请失败：" + error.message);
      return;
    }

    alert("提现申请已提交，等待后台审核！");

    document.getElementById("withdrawModal").style.display = "none";
    document.getElementById("confirmPwdModal").style.display = "none";

    currentUser.balance -= amount;
    document.getElementById("balance").textContent = currentUser.balance.toFixed(2);
  });
});

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
