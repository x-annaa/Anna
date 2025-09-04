/* ======================
   Order2.js - 用户等级 & 每日订单限制
   ====================== */

/* ======================
   全局状态
   ====================== */
let userLevel = 1;          // 默认等级
let todayOrders = 0;        // 今日已下单数量
let maxOrders = 10;         // 每日上限，随等级调整

/* ======================
   获取用户等级与今日订单
   ====================== */
async function loadUserLevelAndDailyLimit() {
  if (!window.currentUserId) return null;

  try {
    // 获取用户等级
    const { data: user, error: userErr } = await supabaseClient
      .from("users")
      .select("level")
      .eq("id", window.currentUserId)
      .single();

    if (userErr) throw userErr;
    userLevel = Number(user?.level || 1);

    // 设置每日最大订单数
    switch (userLevel) {
      case 1: maxOrders = 10; break;
      case 2: maxOrders = 15; break;
      case 3: maxOrders = 20; break;
      case 4: maxOrders = 25; break;
      case 5: maxOrders = 30; break;
      default: maxOrders = 10;
    }

    // 获取今日订单数量（按用户和当天计算）
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const { data: orders, error: orderErr } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId)
      .gte("created_at", startOfDay);

    if (orderErr) throw orderErr;
    todayOrders = orders?.length || 0;

    // 更新 UI
    updateLevelUI();

    return { userLevel, todayOrders, maxOrders };
  } catch (e) {
    console.error("加载用户等级或今日订单失败：", e.message || e);
    return null;
  }
}

/* ======================
   更新 🎲 一键刷单旁边显示
   ====================== */
function updateLevelUI() {
  const btn = document.getElementById("autoOrderBtn");
  if (!btn) return;

  let infoSpan = document.getElementById("orderLevelInfo");
  if (!infoSpan) {
    infoSpan = document.createElement("span");
    infoSpan.id = "orderLevelInfo";
    infoSpan.style.marginLeft = "10px";
    infoSpan.style.fontWeight = "bold";
    btn.parentNode.insertBefore(infoSpan, btn.nextSibling);
  }

  infoSpan.textContent = `Level ${userLevel} / 今日订单：${todayOrders}/${maxOrders}`;
}

/* ======================
   检查每日上限
   ====================== */
async function checkDailyLimitBeforeOrder() {
  await loadUserLevelAndDailyLimit();

  if (todayOrders >= maxOrders) {
    showDailyLimitModal();
    return false;
  }
  return true;
}

/* ======================
   显示每日订单上限提示窗口
   ====================== */
function showDailyLimitModal() {
  // 防止重复创建
  if (document.getElementById("dailyLimitModal")) return;

  const modal = document.createElement("div");
  modal.id = "dailyLimitModal";
  modal.className = "modal";
  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";

  modal.innerHTML = `
    <div class="modal-content">
      <p>今日订单已达上限（${maxOrders} 单），请明日再试！</p>
      <button id="closeDailyLimitModal">关闭</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("closeDailyLimitModal").addEventListener("click", () => {
    modal.remove();
  });
}

/* ======================
   点击 🎲 一键刷单事件
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  const autoBtn = document.getElementById("autoOrderBtn");
  if (autoBtn) {
    autoBtn.addEventListener("click", async (e) => {
      const canOrder = await checkDailyLimitBeforeOrder();
      if (!canOrder) return; // 超限，阻止下单

      // 调用 order.js 的 autoOrder
      if (typeof autoOrder === "function") {
        await autoOrder();
        // 下单后刷新今日订单
        await loadUserLevelAndDailyLimit();
      }
    });
  }

  // 页面初始化
  loadUserLevelAndDailyLimit();
});
