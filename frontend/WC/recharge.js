document.addEventListener("DOMContentLoaded", () => {
  const methodBtns = document.querySelectorAll(".method-btn");
  const methodContent = document.getElementById("methodContent");
  const copyWalletBtn = document.getElementById("copyWalletBtn");
  const walletAddress = document.getElementById("walletAddress");
  const backBtn = document.getElementById("backBtn");
  const submitBtn = document.getElementById("submitBtn");

  const confirmModal = document.getElementById("confirmModal");
  const cancelConfirm = document.getElementById("cancelConfirm");
  const finishConfirm = document.getElementById("finishConfirm");
  const screenshotInput = document.getElementById("screenshotInput");

  const confirmMethod = document.getElementById("confirmMethod");
  const confirmUsername = document.getElementById("confirmUsername");
  const confirmAccount = document.getElementById("confirmAccount");

  // ====== 切换充值方式 ======
  methodBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      methodBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const method = btn.dataset.method;
      confirmMethod.textContent = method;

      if (method === "USDT") {
        methodContent.innerHTML = `
          <h3>USDT 充值</h3>
          <p><strong>网络协议：</strong> TRC20 (默认) / ERC20</p>
          <p><strong>充值币种：</strong> USDT（默认） / USDC</p>
          <p>扫码或使用以下地址完成存款：</p>
          <img src="your-usdt-qrcode.png" alt="USDT收款二维码" class="qr">
          <p><strong>最小充值金额：</strong> 10.00 USDT</p>
          <div class="wallet-box">
            <input type="text" id="walletAddress" value="TX6aSYyGVTf1NsXWzY3kUC9pTQPJPagJHh" readonly>
            <button id="copyWalletBtn">复制</button>
          </div>
        `;
      } else if (method === "BNB") {
        methodContent.innerHTML = `
          <h3>BNB 充值</h3>
          <p>使用 BSC 网络转账</p>
          <img src="your-bnb-qrcode.png" alt="BNB收款二维码" class="qr">
          <p><strong>最小充值金额：</strong> 0.05 BNB</p>
          <div class="wallet-box">
            <input type="text" id="walletAddress" value="bnb1xxxxxxxyyyyyzzzzz" readonly>
            <button id="copyWalletBtn">复制</button>
          </div>
        `;
      } else {
        methodContent.innerHTML = `
          <h3>Telegram 联系客服</h3>
          <p>请联系客服完成充值：</p>
          <p><a href="https://t.me/yourTelegram" target="_blank">📩 点击联系</a></p>
        `;
      }
    });
  });

  // ====== 复制钱包地址 ======
  document.body.addEventListener("click", (e) => {
    if (e.target.id === "copyWalletBtn") {
      const addr = document.getElementById("walletAddress");
      navigator.clipboard.writeText(addr.value).then(() => {
        alert("钱包地址已复制！");
      });
    }
  });

  // ====== 返回按钮 ======
  backBtn.addEventListener("click", () => {
    window.location.href = "../HOME.html";
  });

  // ====== 提交按钮 ======
  submitBtn.addEventListener("click", async () => {
    // 获取当前用户
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      confirmUsername.textContent = user.user_metadata?.username || user.email;
      confirmAccount.textContent = user.id;
    } else {
      confirmUsername.textContent = "未登录";
      confirmAccount.textContent = "-";
    }

    confirmModal.style.display = "block";
  });

  // ====== 上传截图后启用完成按钮 ======
  screenshotInput.addEventListener("change", () => {
    if (screenshotInput.files.length > 0) {
      finishConfirm.disabled = false;
    }
  });

  // ====== 取消提交 ======
  cancelConfirm.addEventListener("click", () => {
    confirmModal.style.display = "none";
  });

  // ====== 完成提交 ======
  finishConfirm.addEventListener("click", () => {
    alert("充值申请已提交，等待审核！");
    confirmModal.style.display = "none";
    window.location.href = "../HOME.html";
  });
});
