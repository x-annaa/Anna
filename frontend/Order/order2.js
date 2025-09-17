/* ======================
   order2.js - 下单限制 + 倒计时功能
   ====================== */
if (!window.supabaseClient) {
  console.error("❌ supabaseClient 未初始化！");
}

// 并发保护
let orderingLimit = false;
let countdownTimer = null;

// 获取当前用户 ID 和 UUID
const currentUserId = localStorage.getItem("currentUserId");
let currentUserUuid = localStorage.getItem("currentUserUuid");

// 工具函数：设置按钮状态
function setOrderBtnDisabled2(disabled, reason = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.disabled = disabled;
    btn.title = reason || "";
    btn.textContent = disabled
      ? `🎲 一键刷单（${reason}）`
      : "🎲 一键刷单";
  }
}

// 倒计时显示
function startCountdown(nextAvailable) {
  if (!nextAvailable) return;
  const btn = document.getElementById("autoOrderBtn");
  if (!btn) return;

  clearInterval(countdownTimer);
  function updateCountdown() {
    const now = new Date();
    const diff = new Date(nextAvailable) - now;
    if (diff <= 0) {
      clearInterval(countdownTimer);
      setOrderBtnDisabled2(false);
    } else {
      const sec = Math.ceil(diff / 1000);
      btn.textContent = `⏳ 等待 ${sec}s`;
      btn.disabled = true;
    }
  }
  updateCountdown();
  countdownTimer = setInterval(updateCountdown, 500);
}

// 检查下单限制
async function checkOrderLimit() {
  if (!currentUserId) {
    console.warn("currentUserId 未设置");
    return;
  }

  // 如果没有 UUID，就从数据库获取
  if (!currentUserUuid) {
    const { data: user, error } = await supabaseClient
      .from("users")
      .select("uuid")
      .eq("id", currentUserId)
      .single();
    if (error || !user?.uuid) {
      console.error("获取用户 UUID 失败", error);
      return;
    }
    currentUserUuid = user.uuid;
    localStorage.setItem("currentUserUuid", currentUserUuid);
  }

  try {
    const { data, error } = await supabaseClient.rpc("can_user_order", {
      p_user_uuid: currentUserUuid,
    });

    if (error) throw error;
    if (!data || !data[0]) return;

    const { can_order, next_available } = data[0];

    if (!can_order && next_available) {
      startCountdown(next_available);
    } else {
      setOrderBtnDisabled2(false);
    }
  } catch (e) {
    console.error("检查下单限制失败", e);
  }
}

// 自动刷新下单限制
function autoRefreshLimit() {
  checkOrderLimit();
  setInterval(checkOrderLimit, 2000); // 每 2 秒刷新一次
}

// 页面初始化
document.addEventListener("DOMContentLoaded", () => {
  autoRefreshLimit();
  console.log("✅ order2.js 已加载，按钮倒计时功能启用");
});
