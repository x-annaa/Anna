/* ======================
   初始化
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
let ordering = false;
let completing = false;

/* ======================
   加载订单信息
   ====================== */
async function loadOrderInfo() {
  if (!window.currentUserId) return;

  const { data, error } = await supabaseClient
    .from("users")
    .select("coins, balance, daily_order_limit, daily_order_count, last_order_date")
    .eq("id", window.currentUserId)
    .single();

  if (error || !data) return;

  const today = new Date().toISOString().split("T")[0];
  let { daily_order_limit, daily_order_count, last_order_date } = data;

  // 如果不是今天，重置
  if (last_order_date !== today) {
    daily_order_count = 0;
    await supabaseClient
      .from("users")
      .update({ daily_order_count: 0, last_order_date: today })
      .eq("id", window.currentUserId);
  }

  document.getElementById("ordercoins").textContent = data.coins.toFixed(2);
  document.getElementById("coins").textContent = data.coins.toFixed(2);
  document.getElementById("balance").textContent = data.balance.toFixed(2);
  document.getElementById("orderProgress").textContent =
    `${daily_order_count}/${daily_order_limit} 单`;

  // 按钮状态
  const exchangeBtn = document.getElementById("exchangeBtn");
  exchangeBtn.disabled = daily_order_count < daily_order_limit;
}

/* ======================
   下单
   ====================== */
async function autoOrder() {
  if (ordering) return;
  ordering = true;

  try {
    const { data: user } = await supabaseClient
      .from("users")
      .select("coins, daily_order_limit, daily_order_count, last_order_date")
      .eq("id", window.currentUserId)
      .single();

    const today = new Date().toISOString().split("T")[0];
    let { coins, daily_order_limit, daily_order_count, last_order_date } = user;

    if (last_order_date !== today) daily_order_count = 0;
    if (coins < 50) { alert("⚠️ 需要至少 50 Coins 才能下单"); return; }
    if (daily_order_count >= daily_order_limit) { alert("⚠️ 今日订单已达上限"); return; }

    // 取一个随机产品
    const { data: products } = await supabaseClient
      .from("products")
      .select("*")
      .eq("enabled", true)
      .eq("manual_only", false);
    if (!products?.length) throw new Error("没有可用产品");

    const product = products[Math.floor(Math.random() * products.length)];
    const price = Number(product.price);
    const profit = +(price * 0.1).toFixed(2);
    const newCoins = coins - price;

    // 插入订单
    const { data: newOrder, error: orderErr } = await supabaseClient
      .from("orders")
      .insert({
        user_id: window.currentUserId,
        product_id: product.id,
        total_price: price,
        profit: profit,
        status: "pending"
      })
      .select(`id, total_price, profit, status, created_at, products ( name )`)
      .single();
    if (orderErr) throw orderErr;

    // 更新用户
    await supabaseClient
      .from("users")
      .update({
        coins: newCoins,
        daily_order_count: daily_order_count + 1,
        last_order_date: today
      })
      .eq("id", window.currentUserId);

    alert("✅ 下单成功！");
    renderLastOrder(newOrder, newCoins);
    await loadOrderInfo();
    await loadRecentOrders();

  } catch (e) {
    alert("下单失败：" + (e.message || e));
  } finally {
    ordering = false;
  }
}

/* ======================
   最近订单
   ====================== */
async function loadRecentOrders() {
  const { data: orders } = await supabaseClient
    .from("orders")
    .select(`id, total_price, profit, status, created_at, products ( name )`)
    .eq("user_id", window.currentUserId)
    .order("created_at", { ascending: false })
    .limit(5);

  const list = document.getElementById("recentOrders");
  if (!list) return;

  list.innerHTML = (orders || []).map(o => `
    <li>
      🛒 ${o.products?.name || "未知"} /
      ¥${o.total_price.toFixed(2)} /
      利润 +¥${o.profit.toFixed(2)} /
      状态：${o.status === "completed" ? "✅ 已完成" : "⏳ 待充值"} /
      <small>${new Date(o.created_at).toLocaleString()}</small>
    </li>
  `).join("") || "<li>暂无订单！</li>";
}

/* ======================
   Coins → Balance 兑换
   ====================== */
async function exchangeCoinsToBalance() {
  const { data: user } = await supabaseClient
    .from("users")
    .select("coins, balance, daily_order_limit, daily_order_count, last_order_date")
    .eq("id", window.currentUserId)
    .single();

  const today = new Date().toISOString().split("T")[0];
  if (user.last_order_date !== today || user.daily_order_count < user.daily_order_limit) {
    alert("⚠️ 必须完成今日所有订单才可兑换");
    return;
  }

  if (user.coins <= 0) { alert("⚠️ 没有可兑换的 Coins"); return; }

  const newBalance = user.balance + user.coins;
  await supabaseClient
    .from("users")
    .update({ balance: newBalance, coins: 0 })
    .eq("id", window.currentUserId);

  alert("✅ 兑换成功！");
  await loadOrderInfo();
}

/* ======================
   渲染最近订单结果
   ====================== */
function renderLastOrder(order, coins) {
  const el = document.getElementById("orderResult");
  if (!el) return;

  el.innerHTML = `
    <h3>✅ 最近一次订单</h3>
    <p>商品：${order.products?.name || "未知商品"}</p>
    <p>价格：¥${order.total_price.toFixed(2)}</p>
    <p>利润：+¥${order.profit.toFixed(2)}</p>
    <p>状态：${order.status === "completed" ? "✅ 已完成" : "⏳ 待充值"}</p>
    <p>时间：${new Date(order.created_at).toLocaleString()}</p>
    <p>当前 Coins：${coins.toFixed(2)}</p>
  `;
}

/* ======================
   页面初始化
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  document.getElementById("exchangeBtn")?.addEventListener("click", exchangeCoinsToBalance);

  loadOrderInfo();
  loadRecentOrders();
});
