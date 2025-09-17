/* ======================
   order2.js - 订单限制 & 倒计时
   ====================== */

if (!window.supabaseClient) {
  console.error("❌ supabaseClient 未初始化！");
}

let orderCooldownTimer = null; // 倒计时定时器
let ordering2 = false; // 下单保护

/* ======================
   按钮状态控制
   ====================== */
function setOrder2BtnDisabled(disabled, reason = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (!btn) return;
  btn.disabled = disabled;
  btn.title = reason;
  btn.textContent = disabled ? `🎲 一键刷单（${reason}）` : "🎲 一键刷单";
}

/* ======================
   检查用户下单限制（通过 Supabase RPC）
   ====================== */
async function checkOrderLimit(userId) {
  try {
    const { data, error } = await supabaseClient.rpc("can_user_order", {
      p_user_id: userId
    });

    if (error) throw error;
    // 返回 { can_order: boolean, cooldown_seconds: int, remaining_count: int }
    return data?.[0] || { can_order: true, cooldown_seconds: 0, remaining_count: 3 };
  } catch (err) {
    console.error("检查下单限制失败", err);
    return { can_order: true, cooldown_seconds: 0, remaining_count: 3 };
  }
}

/* ======================
   开启倒计时
   ====================== */
function startCooldown(seconds) {
  clearInterval(orderCooldownTimer);
  const btn = document.getElementById("autoOrderBtn");
  let remaining = seconds;

  if (!btn) return;

  setOrder2BtnDisabled(true, `请稍等 ${remaining}s`);

  orderCooldownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(orderCooldownTimer);
      setOrder2BtnDisabled(false);
    } else {
      setOrder2BtnDisabled(true, `请稍等 ${remaining}s`);
    }
  }, 1000);
}

/* ======================
   自动下单（替代 order.js 下单前检查）
   ====================== */
async function autoOrder2() {
  if (!window.currentUserId) { alert("请先登录！"); return; }
  if (ordering2) return;
  ordering2 = true;

  try {
    const limitInfo = await checkOrderLimit(window.currentUserId);
    if (!limitInfo.can_order) {
      startCooldown(limitInfo.cooldown_seconds);
      alert(`⚠️ 下单过于频繁\n限制：${limitInfo.remaining_count}/3 单\n请稍后再试！`);
      return;
    }

    // ✅ 可以下单时，触发 order.js 的 autoOrder
    if (typeof window.autoOrder === "function") {
      await window.autoOrder();
    }

  } catch (err) {
    console.error("自动下单失败", err);
    alert("自动下单失败，请重试！");
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

  // 页面加载时检查限制
  if (window.currentUserId) {
    const limitInfo = await checkOrderLimit(window.currentUserId);
    if (!limitInfo.can_order && limitInfo.cooldown_seconds > 0) {
      startCooldown(limitInfo.cooldown_seconds);
    }
  }

  console.log("✅ order2.js 已加载，按钮倒计时功能启用");
});
