(() => {
  let countdownInterval = null;

  // 检查用户是否可以下单，返回 { canOrder: bool, remainingSec: int }
  async function checkOrderLimit(userId) {
    const { data, error } = await supabaseClient.rpc("can_user_order", { uid: userId });
    if (error) {
      console.error("检查下单限制失败", error);
      return { canOrder: false, remainingSec: 0 };
    }
    const remainingSec = Number(data || 0);
    return { canOrder: remainingSec === 0, remainingSec };
  }

  // 倒计时显示在按钮上
  function startButtonCountdown(seconds) {
    clearInterval(countdownInterval);
    const btn = document.getElementById("autoOrderBtn");
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = `⏳ 等待 ${seconds}s`;

    countdownInterval = setInterval(() => {
      seconds--;
      if (seconds > 0) {
        btn.textContent = `⏳ 等待 ${seconds}s`;
      } else {
        clearInterval(countdownInterval);
        btn.textContent = "🎲 一键刷单";
        btn.disabled = false;
      }
    }, 1000);
  }

  // 替换原 autoOrder
  const originalAutoOrder = window.autoOrder;
  window.autoOrder = async function () {
    if (!window.currentUserId) { alert("请先登录！"); return; }
    if (ordering) return;

    ordering = true;
    setOrderBtnDisabled(true, "检查下单限制…");

    try {
      const { canOrder, remainingSec } = await checkOrderLimit(window.currentUserId);

      if (!canOrder) {
        startButtonCountdown(Math.ceil(remainingSec));
        return;
      }

      // 可以下单，调用原来的 autoOrder
      await originalAutoOrder();

      // 下单后再检查限制（避免连续点击）
      const { canOrder: canAfter, remainingSec: remAfter } = await checkOrderLimit(window.currentUserId);
      if (!canAfter) startButtonCountdown(Math.ceil(remAfter));

    } catch (e) {
      console.error(e);
      alert(e.message || "下单失败");
    } finally {
      ordering = false;
      if (!countdownInterval) setOrderBtnDisabled(false);
    }
  };

  // 页面加载时同步按钮状态
  document.addEventListener("DOMContentLoaded", async () => {
    const btn = document.getElementById("autoOrderBtn");
    if (!btn || !window.currentUserId) return;

    try {
      const { canOrder, remainingSec } = await checkOrderLimit(window.currentUserId);
      if (!canOrder) startButtonCountdown(Math.ceil(remainingSec));
    } catch (e) {
      console.error("初始化下单限制失败", e);
    }
    console.log("✅ order2.js 已加载，按钮倒计时功能启用");
  });
})();
