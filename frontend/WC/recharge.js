// frontend/WC/recharge.js
(() => {
  console.log("✅ recharge.js loaded");

  // ======================
  // 元素获取
  // ======================
  const rechargeBtn = document.getElementById("rechargeBtn");
  const rechargeModal = document.getElementById("rechargeModal");
  const cancelRecharge = document.getElementById("cancelRecharge");
  const submitRecharge = document.getElementById("submitRecharge");

  const rechargeOptions = document.querySelectorAll(".recharge-options button");
  const selectedMethodEl = document.getElementById("selectedMethod");
  const networkProtocolEl = document.getElementById("networkProtocol");
  const walletAddressEl = document.getElementById("walletAddress");
  const copyWalletBtn = document.getElementById("copyWallet");

  // ======================
  // 充值配置
  // ======================
  const rechargeConfig = {
    USDT: {
      protocols: {
        TRC20: {
          address: "TX6aSYyGVTf1NsXWzY3kUC9pTQPJPagJH",
          qr: "images/trc20_qr.png"
        },
        ERC20: {
          address: "0x1234567890abcdef1234567890abcdef12345678",
          qr: "images/erc20_qr.png"
        }
      }
    },
    BNB: {
      protocols: {
        BEP20: {
          address: "bnb1abcdef1234567890abcdef1234567890abc",
          qr: "images/bnb_qr.png"
        }
      }
    },
    Telegram: {
      protocols: {
        Default: {
          address: "@YourTelegramBot",
          qr: "images/telegram_qr.png"
        }
      }
    }
  };

  let currentMethod = "USDT";
  let currentProtocol = "TRC20";

  // ======================
  // 打开充值窗口
  // ======================
  rechargeBtn?.addEventListener("click", () => {
    rechargeModal.style.display = "flex";
    updateRechargeUI();
  });

  // ======================
  // 取消关闭
  // ======================
  cancelRecharge?.addEventListener("click", () => {
    rechargeModal.style.display = "none";
  });

  // ======================
  // 切换充值方式
  // ======================
  rechargeOptions.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentMethod = btn.dataset.method;
      // 默认取第一个协议
      const protocols = Object.keys(rechargeConfig[currentMethod].protocols);
      currentProtocol = protocols[0];
      updateRechargeUI();
    });
  });

  // ======================
  // 更新充值详情
  // ======================
  function updateRechargeUI() {
    selectedMethodEl.textContent = currentMethod;
    networkProtocolEl.textContent = currentProtocol;
    walletAddressEl.textContent =
      rechargeConfig[currentMethod].protocols[currentProtocol].address;
  }

  // ======================
  // 复制钱包地址
  // ======================
  copyWalletBtn?.addEventListener("click", () => {
    const address = walletAddressEl.textContent;
    navigator.clipboard.writeText(address).then(() => {
      alert("钱包地址已复制: " + address);
    });
  });

  // ======================
  // 提交充值（只是前端提示，后台要人工审核）
  // ======================
  submitRecharge?.addEventListener("click", () => {
    alert(
      `充值申请已提交\n方式: ${currentMethod}\n网络: ${currentProtocol}\n地址: ${walletAddressEl.textContent}\n\n后台会人工审核`
    );
    rechargeModal.style.display = "none";
  });

  // ======================
  // 点击遮罩层关闭
  // ======================
  window.addEventListener("click", (e) => {
    if (e.target === rechargeModal) {
      rechargeModal.style.display = "none";
    }
  });

  // ======================
  // 按 ESC 键关闭
  // ======================
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      rechargeModal.style.display = "none";
    }
  });
})();
