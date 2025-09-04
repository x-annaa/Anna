/* ======================
   order2.js - 用户等级 & 每日订单限制
   ====================== */

let userLevel = 1;
let todayOrders = 0;
let maxOrders = 10;

async function loadUserLevelAndDailyLimit() {
  if (!window.currentUserId) return null;

  try {
    const { data: user } = await supabaseClient
      .from("users")
      .select("level")
      .eq("id", window.currentUserId)
      .single();

    userLevel = Number(user?.level || 1);
    maxOrders = {1:10,2:15,3:20,4:25,5:30}[userLevel] || 10;

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const { data: orders } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId)
      .gte("created_at", startOfDay);

    todayOrders = orders?.length || 0;
    updateLevelUI();

    return { userLevel, todayOrders, maxOrders };
  } catch (e) {
    console.error("加载用户等级或今日订单失败：", e.message || e);
    return null;
  }
}

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

async function checkDailyLimitBeforeOrder() {
  await loadUserLevelAndDailyLimit();
  if (todayOrders >= maxOrders) {
    showDailyLimitModal();
    return false;
  }
  return true;
}

function showDailyLimitModal() {
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

  modal.querySelector("#closeDailyLimitModal").addEventListener("click", () => modal.remove());
}

document.addEventListener("DOMContentLoaded", () => {
  const autoBtn = document.getElementById("autoOrderBtn");
  if (autoBtn) {
    autoBtn.addEventListener("click", async () => {
      const canOrder = await checkDailyLimitBeforeOrder();
      if (!canOrder) return;
      if (typeof autoOrder === "function") await autoOrder();
      await loadUserLevelAndDailyLimit();
    });
  }

  loadUserLevelAndDailyLimit();
});
