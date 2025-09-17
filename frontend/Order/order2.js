/* ======================
   order2.js - 下单限制 & 倒计时
   独立模块，不污染全局
   ====================== */
(async () => {
  const currentUserUuid = localStorage.getItem("currentUserUuid");
  if (!window.supabaseClient) {
    console.error("❌ supabaseClient 未初始化！");
    return;
  }

  let ordering2 = false;      // 下单中并发保护
  let countdownInterval = null;

  /* ======================
     按钮状态控制
     ====================== */
  function setOrderBtnDisabled(disabled, text = "") {
    const btn = document.getElementById("autoOrderBtn");
    if (!btn) return;
    btn.disabled = disabled;
    btn.textContent = text || (disabled ? "🎲 一键刷单（不可用）" : "🎲 一键刷单");
  }

  /* ======================
     检查下单限制
     ====================== */
  async function checkOrderLimit() {
    if (!currentUserUuid) return { can_order: true };

    try {
      const { data, error } = await supabaseClient
        .rpc("can_user_order", { p_user_uuid: currentUserUuid })
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("检查下单限制失败", err);
      return { can_order: true };
    }
  }

  /* ======================
     启动倒计时
     ====================== */
  function startCooldown(nextAvailable) {
    if (countdownInterval) clearInterval(countdownInterval);
    const btn = document.getElementById("autoOrderBtn");
    if (!btn) return;

    countdownInterval = setInterval(() => {
      const diff = new Date(nextAvailable) - new Date();
      if (diff <= 0) {
        clearInterval(countdownInterval);
        btn.disabled = false;
        btn.textContent = "🎲 一键刷单";
      } else {
        const sec = Math.ceil(diff / 1000);
        btn.textContent = `🕐 冷却中 ${sec}s`;
        btn.disabled = true;
      }
    }, 250);
  }

  /* ======================
     自动下单入口
     ====================== */
  async function autoOrder2() {
    if (!currentUserUuid) { alert("请先登录！"); return; }
    if (ordering2) return;
    ordering2 = true;

    setOrderBtnDisabled(true, "检测下单限制…");

    try {
      const { can_order, next_available } = await checkOrderLimit();

      if (!can_order) {
        if (next_available) {
          startCooldown(next_available);
          return;
        } else {
          alert("⚠️ 下单过于频繁，请稍后再试！");
          setOrderBtnDisabled(true);
          return;
        }
      }

      // ✅ 可以下单，调用旧 order.js 的 autoOrder
      if (typeof window.autoOrder === "function") {
        await window.autoOrder();
      }

    } catch (e) {
      alert("下单失败：" + (e.message || e));
    } finally {
      ordering2 = false;
    }
  }

  /* ======================
     页面初始化
     ====================== */
  document.addEventListener("DOMContentLoaded", async () => {
    const btn = document.getElementById("autoOrderBtn");
    if (btn) btn.addEventListener("click", autoOrder2);

    // 页面加载就检查一次下单限制
    const { can_order, next_available } = await checkOrderLimit();
    if (!can_order && next_available) startCooldown(next_available);

    console.log("✅ order2.js 已加载，按钮倒计时功能启用");
  });
})();
