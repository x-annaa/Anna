/* ======================
   order2.js - 用户等级 & 今日订单限制（带自动刷新）
   ====================== */

async function loadUserLevelAndDailyLimit() {
  if (!window.currentUserId) return;

  try {
    // 获取用户等级
    const { data: user, error: userErr } = await supabaseClient
      .from("users")
      .select("level")
      .eq("id", Number(window.currentUserId))
      .single();

    if (userErr || !user) throw new Error(userErr?.message || "加载用户等级失败");

    const userLevel = Number(user.level) || 1;
    const levelLimits = { 1: 10, 2: 15, 3: 20, 4: 25, 5: 30 };
    const maxOrders = levelLimits[userLevel] || 10;

    // 获取今日订单数量
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayOrders, error: ordersErr } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", Number(window.currentUserId))
      .gte("created_at", todayStart.toISOString());

    if (ordersErr) throw new Error(ordersErr.message);

    const todayCount = todayOrders?.length || 0;

    // 更新 UI
    showLevelAndDailyLimit(userLevel, todayCount, maxOrders);

    return { userLevel, todayCount, maxOrders };
  } catch (e) {
    console.error("加载用户等级或今日订单失败：", e.message);
  }
}

function showLevelAndDailyLimit(level, todayCount, maxOrders) {
  let container = document.getElementById("dailyLimitDisplay");
  if (!container) {
    container = document.createElement("span");
    container.id = "dailyLimitDisplay";
    container.style.marginLeft = "12px";
    container.style.fontSize = "14px";
    container.style.color = "#555";

    const btn = document.getElementById("autoOrderBtn");
    if (btn && btn.parentNode) {
      btn.parentNode.appendChild(container);
    }
  }

  container.textContent = `Level ${level} / 今日订单：${todayCount}/${maxOrders}`;
}

/* ======================
   点击自动刷单前检查今日数量
   ====================== */
async function checkDailyLimitBeforeOrder() {
  const info = await loadUserLevelAndDailyLimit();
  if (!info) return true;

  if (info.todayCount >= info.maxOrders) {
    alert(`今日订单已达上限（${info.maxOrders} 单），请明日再试`);
    return false;
  }
  return true;
}

/* ======================
   自动刷新今日订单数
   ====================== */
async function refreshDailyLimitAfterOrder() {
  await loadUserLevelAndDailyLimit();
}

/* ======================
   绑定事件
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  const autoBtn = document.getElementById("autoOrderBtn");
  if (autoBtn) {
    autoBtn.addEventListener("click", async (e) => {
      const canOrder = await checkDailyLimitBeforeOrder();
      if (!canOrder) return;

      // 调用 order.js 的 autoOrder 函数
      if (typeof autoOrder === "function") {
        await autoOrder();
        // 自动刷新今日订单数
        await refreshDailyLimitAfterOrder();
      }
    });
  }

  // Coins 兑换完成后也刷新今日订单数显示（可选）
  const confirmBtn = document.getElementById("confirmAddCoins");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      setTimeout(refreshDailyLimitAfterOrder, 500);
    });
  }

  // 页面加载时显示等级 & 今日订单
  loadUserLevelAndDailyLimit();
});
