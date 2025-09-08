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
  setupUpload(); // 初始化上传功能

  // ====== Logout 弹窗 ======
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

  // ====== 提现逻辑 ======
  const withdrawBtn = document.getElementById("withdrawBtn");
  const withdrawModal = document.getElementById("withdrawModal");
  const withdrawBalance = document.getElementById("withdrawBalance");

  withdrawBtn.addEventListener("click", () => {
    withdrawBalance.textContent = document.getElementById("balance").textContent;
    withdrawModal.style.display = "flex";
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

  // ====== 设置/更新提现密码 ======
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

  // ---- 设置密码 ----
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
    setPasswordBtn.textContent = "更新密码";
    currentUser.withdraw_password = pwd;
    alert("提现密码设置成功！");
    setPasswordModal.style.display = "none";
  });

  document.getElementById("cancelSetPwd").addEventListener("click", () => {
    setPasswordModal.style.display = "none";
  });

  // ---- 更新密码 ----
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
    updatePasswordModal.style.display = "none";
  });

  document.getElementById("cancelUpdatePwd").addEventListener("click", () => {
    updatePasswordModal.style.display = "none";
  });

  // ---- 确认提现密码 & 提交申请 ----
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
        amount: amount,
        wallet_address: address,
        status: "pending"
      }]);

    if (error) {
      alert("提现申请失败：" + error.message);
      return;
    }

    alert("提现申请已提交，等待后台审核！");

    withdrawModal.style.display = "none";
    document.getElementById("confirmPwdModal").style.display = "none";

    currentUser.balance -= amount;
    document.getElementById("balance").textContent = currentUser.balance.toFixed(2);
  });

  // ====== 事件代理：点击遮罩层或取消按钮关闭弹窗 ======
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) {
      e.target.style.display = "none";
    }
    if (e.target.id === "cancelConfirmPwd") {
      document.getElementById("confirmPwdModal").style.display = "none";
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal").forEach((m) => (m.style.display = "none"));
    }
  });
});

// ======================
// 加载用户信息函数
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

// ======================
// 上传充值截图功能（使用用户会话上传）
// ======================
function setupUpload() {
  const uploadBtn = document.getElementById("uploadBtn");
  const fileInput = document.getElementById("fileInput");
  const uploadList = document.getElementById("uploadList");

  async function loadUploads() {
    if (!currentUser) return;

    const { data, error } = await supabaseClient
      .from("recharge")
      .select("image_url, created_at")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("加载上传记录失败:", error.message);
      return;
    }

    uploadList.innerHTML = data.map(item => `
      <div style="margin-bottom:10px;">
        <a href="${item.image_url}" target="_blank">
          <img src="${item.image_url}" width="100" style="border:1px solid #ccc;"/>
        </a>
        <span>${new Date(item.created_at).toLocaleString()}</span>
      </div>
    `).join("");
  }

  uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) return alert("请选择文件");
    if (!currentUser) return alert("用户未登录");

    const safeFileName = `user_${currentUser.id}_${Date.now()}_${file.name.replace(/\s/g, '_')}`;

    // 创建一个使用当前登录用户 token 的 Supabase Client
    const userClient = supabase.createClient(
      supabaseClient.supabaseUrl,
      localStorage.getItem("currentUserToken") // 这里需要在用户登录时保存 session.access_token
    );

    // 上传文件
    const { data: storageData, error: storageError } = await userClient
      .storage
      .from("Supabasephotos")
      .upload(safeFileName, file);

    if (storageError) {
      console.error(storageError);
      return alert("上传失败: " + storageError.message);
    }

    // 获取 Public URL
    const { data: publicUrlData } = userClient
      .storage
      .from("Supabasephotos")
      .getPublicUrl(safeFileName);

    const publicUrl = publicUrlData.publicUrl;

    // 保存到 recharge 表
    const { error: rechargeError } = await supabaseClient
      .from("recharge")
      .insert([{ user_id: currentUser.id, image_url: publicUrl }]);

    if (rechargeError) {
      console.error(rechargeError);
      return alert("保存记录失败: " + rechargeError.message);
    }

    alert("上传成功！");
    fileInput.value = "";
    loadUploads();
  });

  loadUploads();
}
