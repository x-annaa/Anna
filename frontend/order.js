/* ======================
   初始化用户
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");

let ordering = false;      // 下单中的并发保护
let completing = false;    // 完成订单中的并发保护

/* ======================
   工具：更新按钮状态
   ====================== */
function setOrderBtnDisabled(disabled, reason = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.disabled = disabled;
    btn.title = reason || "";
    btn.textContent = disabled ? "🎲 一键刷单（不可用）" : "🎲 一键刷单";
  }
}

/* ======================
   更新 balance & balance2 UI
   ====================== */
function updateBalanceUI(balanceRaw) {
  const balance = Number(balanceRaw) || 0;
  document.getElementById("orderBalance").textContent = balance.toFixed(2);
  document.getElementById("balance").textContent = balance.toFixed(2);
}

function updateBalance2UI(balance2Raw, dailyOrders, dailyLimit) {
  const balance2 = Number(balance2Raw) || 0;
  document.getElementById("orderBalance2").textContent = balance2.toFixed(2);
  document.getElementById("balance2").textContent = balance2.toFixed(2);

  document.getElementById("dailyProgress").textContent =
    `${dailyOrders}/${dailyLimit}`;
}

/* ======================
   加载余额 + 刷单额度
   ====================== */
async function loadBalanceOrderPage() {
  if (!window.currentUserId) return;
  const { data, error } = await supabaseClient
    .from("users")
    .select("balance, balance2, daily_orders, daily_limit, last_order_date")
    .eq("id", window.currentUserId)
    .single();

  if (error || !data) return;

  updateBalanceUI(data.balance);

  // 检查每日是否需要重置
  const today = new Date().toISOString().split("T")[0];
  let dailyOrders = data.daily_orders || 0;
  if (data.last_order_date !== today) {
    dailyOrders = 0;
    await supabaseClient.from("users").update({
      daily_orders: 0,
      last_order_date: today
    }).eq("id", window.currentUserId);
  }

  updateBalance2UI(data.balance2, dailyOrders, data.daily_limit);
}

/* ======================
   获取随机产品
   ====================== */
async function getRandomProduct() {
  const { data: products, error } = await supabaseClient
    .from("products")
    .select("*");
  if (error || !products || products.length === 0) {
    throw new Error("产品列表为空或读取失败！");
  }
  return products[Math.floor(Math.random() * products.length)];
}

/* ======================
   ✅ 已完成订单数统计
   ====================== */
async function loadCompletedOrdersCount() {
  if (!window.currentUserId) return;

  const { count, error } = await supabaseClient
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("user_id", window.currentUserId)
    .eq("status", "completed");

  const container = document.getElementById("completedOrdersBox");
  if (!container) return;

  if (error) {
    container.innerHTML = `<p style="color:red;">加载已完成订单失败: ${error.message}</p>`;
    return;
  }

  container.innerHTML = `
    <h3>📦 已完成订单统计</h3>
    <p>已完成：<strong>${count}</strong> 单</p>
    <button id="refreshCompletedBtn">🔄 刷新</button>
  `;

  document.getElementById("refreshCompletedBtn")
    ?.addEventListener("click", loadCompletedOrdersCount);
}

/* ======================
   渲染最近一次订单
   ====================== */
function renderLastOrder(order, balance2Raw) {
  const el = document.getElementById("orderResult");
  if (!el || !order) return;

  const balance2 = Number(balance2Raw) || 0;
  const price = Number(order.total_price) || 0;
  const profit = Number(order.profit) || 0;

  let html = `
    <h3>✅ 最近一次订单</h3>
    <p>商品：${order.products?.name || "未知商品"}</p>
    <p>价格：¥${price.toFixed(2)}</p>
    <p>利润：<span style="color:green;">+¥${profit.toFixed(2)}</span></p>
    <p>状态：${order.status === "completed" ? "✅ 已完成" : "⏳ 待充值"}</p>
    <p>时间：${new Date(order.created_at).toLocaleString()}</p>
    <p>当前刷单余额：¥${balance2.toFixed(2)}</p>
  `;

  if (order.status === "pending") {
    html += `<button id="completeOrderBtn">完成订单</button>`;
  }

  el.innerHTML = html;

  const compBtn = document.getElementById("completeOrderBtn");
  if (compBtn) {
    compBtn.addEventListener("click", async () => {
      compBtn.remove();
      await completeOrder(order, balance2);
    });
  }
}

/* ======================
   加载最近 1 单
   ====================== */
async function loadLastOrder() {
  if (!window.currentUserId) return;

  const { data: orders } = await supabaseClient
    .from("orders")
    .select(`id, total_price, profit, status, created_at, products ( name )`)
    .eq("user_id", window.currentUserId)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: user } = await supabaseClient
    .from("users")
    .select("balance2")
    .eq("id", window.currentUserId)
    .single();

  if (orders?.length) {
    renderLastOrder(orders[0], user?.balance2 ?? 0);
  }
}

/* ======================
   完成订单（返到 balance2）
   ====================== */
async function completeOrder(order, currentBalance2) {
  if (completing) return;
  completing = true;

  try {
    const price = Number(order.total_price) || 0;
    const profit = Number(order.profit) || 0;
    const finalBalance2 = currentBalance2 + price + profit;

    await supabaseClient.from("orders")
      .update({ status: "completed" })
      .eq("id", order.id)
      .eq("status", "pending");

    await supabaseClient.from("users")
      .update({ balance2: finalBalance2 })
      .eq("id", window.currentUserId);

    renderLastOrder({ ...order, status: "completed" }, finalBalance2);
    await loadBalanceOrderPage();
    await loadRecentOrders();
    await loadCompletedOrdersCount();
  } catch (e) {
    alert(e.message || "完成订单失败");
  } finally {
    completing = false;
  }
}

/* ======================
   自动下单（用 balance2）
   ====================== */
async function autoOrder() {
  if (!window.currentUserId) { alert("请先登录！"); return; }
  if (ordering) return;

  ordering = true;
  setOrderBtnDisabled(true, "下单中…");

  try {
    const { data: user } = await supabaseClient
      .from("users")
      .select("balance2, daily_orders, daily_limit, last_order_date")
      .eq("id", window.currentUserId)
      .single();

    const today = new Date().toISOString().split("T")[0];
    let dailyOrders = user.daily_orders || 0;
    if (user.last_order_date !== today) {
      dailyOrders = 0;
      await supabaseClient.from("users").update({
        daily_orders: 0,
        last_order_date: today
      }).eq("id", window.currentUserId);
    }

    if (dailyOrders >= user.daily_limit) {
      alert("今天的刷单次数已达上限！");
      return;
    }

    const product = await getRandomProduct();
    const price = Number(product.price) || 0;
    const profit = +(price * 0.1).toFixed(2);

    const tempBalance2 = (Number(user.balance2) || 0) - price;
    await supabaseClient.from("users").update({
      balance2: tempBalance2,
      daily_orders: dailyOrders + 1,
      last_order_date: today
    }).eq("id", window.currentUserId);

    const { data: newOrder } = await supabaseClient
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

    renderLastOrder(newOrder, tempBalance2);
    updateBalance2UI(tempBalance2, dailyOrders + 1, user.daily_limit);
    await loadRecentOrders();
    await loadCompletedOrdersCount();
  } catch (e) {
    alert(e.message || "下单失败");
  } finally {
    ordering = false;
    setOrderBtnDisabled(false);
  }
}

/* ======================
   最近 5 笔订单历史
   ====================== */
async function loadRecentOrders() {
  if (!window.currentUserId) return;
  const { data: orders } = await supabaseClient
    .from("orders")
    .select(`id, total_price, profit, status, created_at, products ( name )`)
    .eq("user_id", window.currentUserId)
    .order("created_at", { ascending: false })
    .limit(5);

  const list = document.getElementById("recentOrders");
  if (list) {
    list.innerHTML = (orders || []).map(o => {
      const price = Number(o.total_price) || 0;
      const profit = Number(o.profit) || 0;
      return `
        <li>
          🛒 ${o.products?.name || "未知商品"} /
          ¥${price.toFixed(2)} /
          利润 +¥${profit.toFixed(2)} /
          状态：${o.status === "completed" ? "已完成" : "待充值"} /
          <small>${new Date(o.created_at).toLocaleString()}</small>
        </li>`;
    }).join("");
  }
}

/* ======================
   页面初始化
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);

  loadBalanceOrderPage();
  loadCompletedOrdersCount();
  loadLastOrder();
  loadRecentOrders();
});
