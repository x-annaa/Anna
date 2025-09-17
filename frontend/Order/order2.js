// ======================
// order2.js - 扩展优化逻辑（带倒计时）
// ======================

// 下单频率限制（30 秒内最多 3 单）
let orderTimestamps = [];
const ORDER_LIMIT = 3;
const TIME_WINDOW = 30 * 1000; // 30 秒

const originalAutoOrder = window.autoOrder;
window.autoOrder = async function () {
  const now = Date.now();

  // 清理超时记录
  orderTimestamps = orderTimestamps.filter(ts => now - ts < TIME_WINDOW);

  if (orderTimestamps.length >= ORDER_LIMIT) {
    const earliest = Math.min(...orderTimestamps); // 最早的时间
    let remainingSec = Math.ceil((TIME_WINDOW - (now - earliest)) / 1000);

    // 创建倒计时 modal
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.style.display = "flex";
    modal.innerHTML = `
      <div class="modal-content">
        <h3>⚠️ 下单过于频繁</h3>
        <p>请等待 <span id="countdown">${remainingSec}</span> 秒后再试</p>
        <div class="modal-actions">
          <button id="closeModalBtn">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // 倒计时逻辑
    const interval = setInterval(() => {
      remainingSec--;
      const el = document.getElementById("countdown");
      if (el) el.textContent = remainingSec;
      if (remainingSec <= 0) {
        clearInterval(interval);
        modal.remove();
      }
    }, 1000);

    // 手动关闭按钮
    document.getElementById("closeModalBtn").addEventListener("click", () => {
      clearInterval(interval);
      modal.remove();
    });

    return;
  }

  orderTimestamps.push(now);

  // 调用原始 autoOrder
  return await originalAutoOrder();
};

// ======================
// 替换 alert 为自定义 modal
// ======================
window.alert = function (msg) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "flex";
  modal.innerHTML = `
    <div class="modal-content">
      <p>${msg}</p>
      <div class="modal-actions">
        <button id="closeModalBtn">关闭</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById("closeModalBtn").addEventListener("click", () => modal.remove());
};

// ======================
// 页面加载提示
// ======================
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ order2.js 已加载，扩展功能启用（带倒计时）");
});
