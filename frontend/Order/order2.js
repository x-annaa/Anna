// ======================
// order2.js - 扩展优化逻辑
// ======================

// ✅ 下单频率限制（30 秒内最多 3 单）
let orderTimestamps = [];
const ORDER_LIMIT = 3;
const TIME_WINDOW = 30 * 1000; // 30 秒

// 保存原始 autoOrder
const originalAutoOrder = window.autoOrder;
window.autoOrder = async function () {
  const now = Date.now();

  // 清理掉超出时间窗口的记录
  orderTimestamps = orderTimestamps.filter(ts => now - ts < TIME_WINDOW);

  if (orderTimestamps.length >= ORDER_LIMIT) {
    showModal(`
      <h3>⚠️ 下单过于频繁</h3>
      <p>限制：${TIME_WINDOW / 1000} 秒内最多 ${ORDER_LIMIT} 单</p>
      <p>请稍后再试！</p>
    `);
    return;
  }

  orderTimestamps.push(now);

  // 调用原始的 autoOrder
  return await originalAutoOrder();
};

// ======================
// 替换 alert 为自定义 modal
// ======================
window.alert = function (msg) {
  showModal(`<p>${msg}</p>`);
};

// ======================
// 页面加载时提示
// ======================
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ order2.js 已加载，扩展功能已启用");
});
