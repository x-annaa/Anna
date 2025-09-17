/* ======================
   order2.js - 下单限制 & 倒计时版本
   ====================== */

window.currentUserId = localStorage.getItem("currentUserId");
window.currentUserUuid = localStorage.getItem("currentUserUuid"); // UUID
window.currentUsername = localStorage.getItem("currentUser");

if (!window.supabaseClient) {
  console.error("❌ supabaseClient 未初始化！");
}

let ordering = false;
let countdownTimer = null;

/* ======================
   按钮状态 & 倒计时
   ====================== */
function setOrderBtnDisabled(disabled, reason = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (!btn) return;
  btn.disabled = disabled;
  if (disabled && reason) {
    btn.textContent = reason;
  } else {
    btn.textContent = "🎲 一键刷单";
  }
}

/* ======================
   检查下单限制
   ====================== */
async function checkOrderLimit() {
  if (!window.currentUserUuid) return true;

  try {
    const { data, error } = await supabaseClient.rpc("can_user_order", {
      p_user_uuid: window.currentUserUuid
    });

    if (error) throw error;
    if (!data || !data[0]) return true;

    const { can_order, next_available } = data[0];

    if (can_order) {
      setOrderBtnDisabled(false);
      return true;
    } else if (next_available) {
      startCountdown(new Date(next_available));
      return false;
    }
  } catch (e) {
    console.error("检查下单限制失败", e);
    return true;
  }
}

/* ======================
   倒计时逻辑
   ====================== */
function startCountdown(endTime) {
  clearInterval(countdownTimer);
  const btn = document.getElementById("autoOrderBtn");
  if (!btn) return;

  function update() {
    const now = new Date();
    const diff = Math.ceil((endTime - now) / 1000);
    if (diff <= 0) {
      clearInterval(countdownTimer);
      setOrderBtnDisabled(false);
    } else {
      btn.disabled = true;
      btn.textContent = `⏳ 等待 ${diff} 秒`;
    }
  }

  update();
  countdownTimer = setInterval(update, 1000);
}

/* ======================
   获取随机产品
   ====================== */
async function getRandomProduct() {
  const { data: products, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("enabled", true)
    .eq("manual_only", false);

  if (error || !products || products.length === 0) {
    throw new Error("产品列表为空或读取失败！");
  }
  return products[Math.floor(Math.random() * products.length)];
}

/* ======================
   渲染最近订单
   ====================== */
function renderLastOrder(order, coinsRaw) {
  const el = document.getElementById("orderResult");
  if (!el || !order) return;
  const coins = Number(coinsRaw) || 0;
  const price = Number(order.total_price) || 0;
  const profit = Number(order.profit) || 0;

  let html = `
    <h3>✅ 最近一次订单</h3>
    <p>商品：${order.products?.name || "未知商品"}</p>
    <p>价格：¥${price.toFixed(2)}</p>
    <p>收入：+¥${profit.toFixed(2)}</p>
    <p>状态：${order.status === "completed" ? "✅ 已完成" : "⏳ 待完成"}</p>
    <p>时间：${new Date(order.created_at).toLocaleString()}</p>
    <p>当前金币：¥${coins.toFixed(2)}</p>
  `;

  if (order.status === "pending" && coins >= 0) {
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
async function completeOrder(order, currentCoinsRaw) {
  if (ordering) return;
  ordering = true;

  try {
    if (order.status === "completed") return;

    const currentCoins = Number(currentCoinsRaw) || 0;
    const price = Number(order.total_price) || 0;
    const profit = Number(order.profit) || 0;
    const finalCoins = currentCoins + price + profit;

    const { error: orderErr } = await supabaseClient
      .from("orders")
      .update({ status: "completed" })
      .eq("id", order.id)
      .eq("status", "pending");
    if (orderErr) throw new Error(orderErr.message);

    const { error: coinErr } = await supabaseClient
      .from("users")
      .update({ coins: finalCoins })
      .eq("id", window.currentUserId);
    if (coinErr) throw new Error(coinErr.message);

    renderLastOrder({ ...order, status: "completed" }, finalCoins);
  } catch (e) {
    alert(e.message || "完成订单失败");
  } finally {
    ordering = false;
    checkOrderLimit();
  }
}

/* ======================
   自动下单
   ====================== */
async function autoOrder() {
  if (!window.currentUserUuid) { alert("请先登录！"); return; }
  if (ordering) return;

  const canOrder = await checkOrderLimit();
  if (!canOrder) return;

  ordering = true;
  setOrderBtnDisabled(true, "下单中…");

  try {
    const { data: user } = await supabaseClient
      .from("users")
      .select("coins")
      .eq("id", window.currentUserId)
      .single();

    const coins = Number(user?.coins || 0);
    if (coins < 50) { alert("金币不足，至少 50"); setOrderBtnDisabled(false); return; }

    const product = await getRandomProduct();
    const price = Number(product.price) || 0;
    const profitRatio = Number(product.profit) || 0;
    const profit = +(price * profitRatio).toFixed(2);
    const tempCoins = coins - price;

    await supabaseClient.from("users").update({ coins: tempCoins }).eq("id", window.currentUserId);

    const { data: newOrder, error: orderErr } = await supabaseClient
      .from("orders")
      .insert({
        user_id: window.currentUserId,
        product_id: product.id,
        total_price: price,
        profit: profit,
        status: "pending"
      })
      .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
      .single();
    if (orderErr) throw new Error(orderErr.message);

    renderLastOrder(newOrder, tempCoins);
  } catch (e) {
    alert(e.message || "下单失败");
  } finally {
    ordering = false;
    checkOrderLimit();
  }
}

/* ======================
   页面初始化
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  checkOrderLimit();
});
