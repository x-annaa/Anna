document.addEventListener("DOMContentLoaded", () => {
  const rechargeBtn = document.getElementById("rechargeBtn");
  const rechargeModal = document.getElementById("rechargeModal");
  const cancelRecharge = document.getElementById("cancelRecharge");
  const submitRecharge = document.getElementById("submitRecharge");
  const confirmRechargeModal = document.getElementById("confirmRechargeModal");
  const cancelConfirm = document.getElementById("cancelConfirm");
  const finishConfirm = document.getElementById("finishConfirm");
  const screenshotInput = document.getElementById("screenshotInput");

  // 打开充值窗口
  rechargeBtn.addEventListener("click", () => {
    rechargeModal.style.display = "flex";
  });

  // 关闭充值窗口
  cancelRecharge.addEventListener("click", () => {
    rechargeModal.style.display = "none";
  });

  // 切换 tab
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const method = tab.dataset.method;
      document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));
      if (method === "USDT") document.getElementById("usdtTab").classList.add("active");
      if (method === "BNB") document.getElementById("bnbTab").classList.add("active");
      if (method === "TG") document.getElementById("tgTab").classList.add("active");
    });
  });

  // 点击提交 → 打开确认窗口
  submitRecharge.addEventListener("click", () => {
    const method = document.querySelector(".tab.active").dataset.method;
    document.getElementById("confirmMethod").textContent = method;
    document.getElementById("confirmUsername").textContent = localStorage.getItem("currentUsername") || "未知";
    document.getElementById("confirmAccount").textContent = localStorage.getItem("platformAccount") || "未知";

    rechargeModal.style.display = "none";
    confirmRechargeModal.style.display = "flex";
  });

  // 关闭确认窗口
  cancelConfirm.addEventListener("click", () => {
    confirmRechargeModal.style.display = "none";
  });

  // 检查是否上传截图
  screenshotInput.addEventListener("change", () => {
    finishConfirm.disabled = screenshotInput.files.length === 0;
  });

  // 完成提交
  finishConfirm.addEventListener("click", () => {
    alert("提交成功！请等待后台审核。");
    confirmRechargeModal.style.display = "none";
    screenshotInput.value = "";
    finishConfirm.disabled = true;
  });
});

// 复制钱包地址
function copyWallet(id) {
  const text = document.getElementById(id).textContent;
  navigator.clipboard.writeText(text).then(() => {
    alert("钱包地址已复制！");
  });
}
