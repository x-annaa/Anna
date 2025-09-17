/* ======================
   order2.js - 优化版
   下单限制 & 倒计时
   ====================== */

window.currentUserUuid = localStorage.getItem("currentUserUuid");
window.currentUserId = localStorage.getItem("currentUserId");

window.ordering = window.ordering || false;
window.completing = window.completing || false;
window.exchanging = window.exchanging || false;
window.orderCooldownTimer = null;

/* ======================
   按钮状态
   ====================== */
function setOrderBtnDisabled(disabled, reason = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.disabled = disabled;
    btn.title = reason || "";
    btn.textContent = disabled
      ? `🎲 一键刷单（${reason || "不可用"}）`
      : "🎲 一键刷单";
  }
}

/* ======================
   检查下单限制
   ====================== */
async function checkOrderLimit() {
  if (!window.currentUserUuid) return { can_order: true };

  try {
    const { data, error } = await supabaseClient
      .rpc("can_user_order", { p_user_uuid: window.currentUserUuid });

    if (error) throw error;
    return data?.[0] || { can_order: true };
  } catch (e) {
    console.error("检查下单限制失败", e);
    return { can_order: true };
  }
}

/* ======================
   自动下单
   ====================== */
async function autoOrder() {
  if (!window.currentUserUuid) { alert("请先登录"); return; }
  if (window.ordering) return;

  window.ordering = true;
  setOrderBtnDisabled(true, "下单中…");

  try {
    // 1. 检查下单限制
    const limit = await checkOrderLimit();
    if (!limit.can_order) {
      const next = new Date(limit.next_available);
      startCooldown(next);
      window.ordering = false;
      return;
    }

    // 2. 获取用户 coins
    const { data: user } = await supabaseClient
      .from("users")
      .select("coins")
      .eq("id", window.currentUserId)
      .single();

    const coins = Number(user?.coins || 0);
    if (coins < 50) { alert("余额不足 50 coins"); return; }

    // 3. 获取随机产品
    const { data: products } = await supabaseClient
      .from("products")
      .select("*")
      .eq("enabled", true)
      .eq("manual_only", false);

    if (!products?.length) { alert("产品列表为空"); return; }
    const product = products[Math.floor(Math.random() * products.length)];

    const price = Number(product.price) || 0;
    const profit = +(price * (Number(product.profit) || 0)).toFixed(2);
    const tempCoins = coins - price;

    // 4. 扣 coins
    await supabaseClient
      .from("users")
      .update({ coins: tempCoins })
      .eq("id", window.currentUserId);

    // 5. 创建订单
    const { data: newOrder, error: orderErr } = await supabaseClient
      .from("orders")
      .insert({
        user_id: window.currentUserId,
        product_id: product.id,
        total_price: price,
        profit,
        status: "pending"
      })
      .select(`id, total_price, profit, status, created_at, products(name, profit)`)
      .single();
    if (orderErr) throw orderErr;

    renderLastOrder(newOrder, tempCoins);
    updateCoinsUI(tempCoins);
  } catch (e) {
    alert(e.message || "下单失败");
  } finally {
    window.ordering = false;
  }
}

/* ======================
   倒计时
   ====================== */
function startCooldown(nextAvailable) {
  clearInterval(window.orderCooldownTimer);

  function update() {
    const now = new Date();
    const diff = Math.max(0, Math.floor((new Date(nextAvailable) - now) / 1000));
    if (diff <= 0) {
      setOrderBtnDisabled(false);
      clearInterval(window.orderCooldownTimer);
    } else {
      setOrderBtnDisabled(true, `请等待 ${diff}s`);
    }
  }

  update();
  window.orderCooldownTimer = setInterval(update, 1000);
  update();
}

/* ======================
   渲染最近订单
   ====================== */
function renderLastOrder(order, coinsRaw) {
  const el = document.getElementById("orderResult");
  if (!el || !order) return;

  const coins = Number(coinsRaw || 0);
  const price = Number(order.total_price || 0);
  const profit = Number(order.profit || 0);

  let html = `
    <h3>✅ 最近一次订单</h3>
    <p>商品：${order.products?.name || "未知商品"}</p>
    <p>价格：¥${price.toFixed(2)}</p>
    <p>收入：+¥${profit.toFixed(2)}</p>
    <p>状态：${order.status === "completed" ? "✅ 已完成" : "⏳ 待完成"}</p>
    <p>当前金币：¥${coins.toFixed(2)}</p>
  `;

  if (order.status === "pending") {
    html += `<button id="completeOrderBtn">完成订单</button>`;
  }

  el.innerHTML = html;

  const compBtn = document.getElementById("completeOrderBtn");
  if (compBtn) {
    compBtn.addEventListener("click", async () => {
      compBtn.disabled = true;
      await completeOrder(order, coins);
    });
  }
}

/* ======================
   完成订单
   ====================== */
async function completeOrder(order, coinsRaw) {
  if (window.completing) return;
  window.completing = true;

  try {
    const currentCoins = Number(coinsRaw || 0);
    const finalCoins = currentCoins + Number(order.total_price || 0) + Number(order.profit || 0);

    await supabaseClient
      .from("orders")
      .update({ status: "completed" })
      .eq("id", order.id)
      .eq("status", "pending");

    await supabaseClient
      .from("users")
      .update({ coins: finalCoins })
      .eq("id", window.currentUserId);

    renderLastOrder({ ...order, status: "completed" }, finalCoins);
    updateCoinsUI(finalCoins);
  } catch (e) {
    alert(e.message || "完成订单失败");
  } finally {
    window.completing = false;
  }
}

/* ======================
   初始化
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  updateCoinsUI(0);

  // 页面刷新时也检查下单限制
  (async () => {
    const limit = await checkOrderLimit();
    if (!limit.can_order && limit.next_available) startCooldown(limit.next_available);
  })();
});
