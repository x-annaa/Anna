/* ======================
   全局状态
   ====================== */
let userLevel = 1;
let todayOrdersCount = 0;
let maxOrdersPerLevel = {
  1: 10,
  2: 15,
  3: 20,
  4: 25,
  5: 30
};

/* ======================
   获取用户等级和今日订单
   ====================== */
async function loadUserLevelAndOrders() {
  if (!window.currentUserId) return;

  try {
    // 获取用户 level
    const { data: user, error: userErr } = await supabaseClient
      .from("users")
      .select("level")
      .eq("id", Number(window.currentUserId))
      .single();
    if (userErr) throw userErr;

    userLevel = Number(user.level) || 1;

    // 获取今天订单数
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 今天凌晨
    const { data: orders, error: orderErr } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", Number(window.currentUserId))
      .gte("created_at", today.toISOString());
    if (orderErr) throw orderErr;

    todayOrdersCount = orders?.length || 0;

    renderOrderLevelUI();
  } catch (e) {
    console.error("加载用户等级或今日订单失败：", e.message);
  }
}

/* ======================
   渲染 level 和 今日订单
   ====================== */
function renderOrderLevelUI() {
  let container = document.getElementById("orderLevelContainer");

  if (!container) {
    // 创建显示区域放在 🎲 一键刷单旁边
    const autoBtn = document.getElementById("autoOrderBtn");
    container = document.createElement("span");
    container.id = "orderLevelContainer";
    container.style.marginLeft = "12px";
    container.style.fontSize = "0.9em";
    container.style.color = "#1976d2";
    if (autoBtn && autoBtn.parentNode) {
      autoBtn.parentNode.insertBefore(container, autoBtn.nextSibling);
    }
  }

  container.textContent = `Level ${userLevel} | 今日订单：${todayOrdersCount}/${maxOrdersPerLevel[userLevel]}`;
}

/* ======================
   自动刷新今日订单数量
   ====================== */
async function refreshTodayOrdersCount() {
  await loadUserLevelAndOrders();
}

/* ======================
   页面加载时初始化
   ====================== */
document.addEventListener("DOMContentLoaded", async () => {
  await loadUserLevelAndOrders();

  // 每次点击一键刷单后刷新今日订单数量
  const autoBtn = document.getElementById("autoOrderBtn");
  if (autoBtn) {
    autoBtn.addEventListener("click", async () => {
      setTimeout(() => {
        refreshTodayOrdersCount();
      }, 500); // 延迟刷新，确保订单写入数据库后刷新
    });
  }
});
