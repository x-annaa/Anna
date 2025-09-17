// ======================
// order2.js - 下单限制 + 倒计时
// ======================

let ordering = false; // 下单保护
let countdownInterval = null;

// RPC 名称，假设你在 Supabase 建了 can_user_order(uid)
async function checkOrderLimit(userId) {
  const { data, error } = await supabaseClient.rpc("can_user_order", { uid: userId });
  if (error) {
    console.error("检查下单限制失败", error);
    return { canOrder: false, remaining: 0 };
  }
  const remainingSec = Number(data || 0);
  return { canOrder: remainingSec === 0, remainingSec };
}

// 显示倒计时 modal
function showCountdownModal(seconds) {
  clearInterval(countdownInterval);

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "flex";
  modal.innerHTML = `
    <div class="modal-content">
      <h3>⚠️ 下单过于频繁</h3>
      <p>请等待 <span id="countdown">${seconds}</span> 秒后再试</p>
      <div class="modal-actions">
        <button id="closeModalBtn">关闭</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  countdownInterval = setInterval(() => {
    seconds--;
    const el = document.getElementById("countdown");
    if (el) el.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(countdownInterval);
      modal.remove();
      setOrderBtnDisabled(false);
    }
  }, 1000);

  document.getElementById("closeModalBtn").addEventListener("click", () => {
    clearInterval(countdownInterval);
    modal.remove();
    setOrderBtnDisabled(false);
  });
}

// ======================
// 替换 autoOrder
// ======================
const originalAutoOrder = window.autoOrder;
window.autoOrder = async function () {
  if (!window.currentUserId) { alert("请先登录！"); return; }
  if (ordering) return;

  ordering = true;
  setOrderBtnDisabled(true, "检查下单限制…");

  try {
    const { canOrder, remainingSec } = await checkOrderLimit(window.currentUserId);

    if (!canOrder) {
      showCountdownModal(Math.ceil(remainingSec));
      return;
    }

    // 可以下单，调用原来的 autoOrder
    await originalAutoOrder();

  } catch (e) {
    console.error(e);
    alert(e.message || "下单失败");
  } finally {
    ordering = false;
    setOrderBtnDisabled(false);
  }
};

// ======================
// 页面加载提示
// ======================
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ order2.js 已加载，扩展功能启用（下单限制 + 倒计时）");
});
