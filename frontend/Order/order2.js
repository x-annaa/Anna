/* ======================
   Order Level 限制逻辑
   ====================== */

// 每个 level 的每日上限
const ORDER_LIMITS = {
  1: 10,
  2: 15,
  3: 20,
  4: 25,
  5: 30
};

let currentUserLevel = 1;
let todayOrderCount = 0;
let todayOrderLimit = ORDER_LIMITS[1];

/* ======================
   初始化：获取用户等级 + 今日订单数
   ====================== */
async function loadUserLevelAndOrders() {
  if (!window.currentUserId) return;

  try {
    // 读取用户等级
    const { data: user } = await supabaseClient
      .from("users")
      .select("level")
      .eq("id", window.currentUserId)
      .single();

    if (user?.level) {
      currentUserLevel = user.level;
      todayOrderLimit = ORDER_LIMITS[currentUserLevel] || 10;
    }

    // 读取今日订单数
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { count: todayCount } = await supabaseClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", window.currentUserId)
      .gte("created_at", startOfDay.toISOString());

    todayOrderCount = todayCount || 0;

    updateOrderLevelUI();
  } catch (err) {
    console.error("加载用户等级/今日订单数失败:", err);
  }
}

/* ======================
   更新 UI：Level / 今日订单
   ====================== */
function updateOrderLevelUI() {
  const autoBtn = document.getElementById("autoOrderBtn");
  if (!autoBtn) return;

  // 检查是否已有显示容器
  let infoSpan = document.getElementById("orderLevelInfo");
  if (!infoSpan) {
    infoSpan = document.createElement("span");
    infoSpan.id = "orderLevelInfo";
    infoSpan.style.marginLeft = "10px";
    infoSpan.style.fontSize = "0.9em";
    infoSpan.style.color = "#555";
    autoBtn.insertAdjacentElement("afterend", infoSpan);
  }

  infoSpan.textContent = `Level ${currentUserLevel} ｜ 今日订单：${todayOrderCount}/${todayOrderLimit}`;
}

/* ======================
   覆盖 autoOrder：增加每日上限判断
   ====================== */
const originalAutoOrder = window.autoOrder; // 保存 order.js 里的 autoOrder

window.autoOrder = async function () {
  if (todayOrderCount >= todayOrderLimit) {
    alert(`❌ 今日下单已达上限：${todayOrderLimit} 单`);
    return;
  }

  // 执行原来的下单逻辑
  await originalAutoOrder();

  // 成功后刷新今日订单数
  await loadUserLevelAndOrders();
};

/* ======================
   页面初始化
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  loadUserLevelAndOrders();
});
