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
   更新余额 UI（只控制“余额<0”时的禁用）
   ====================== */
function updateBalanceUI(balanceRaw) {
  const balance = Number(balanceRaw) || 0;
  const ob = document.getElementById("orderBalance");
  const mb = document.getElementById("balance");
  if (ob) ob.textContent = balance.toFixed(2);
  if (mb) mb.textContent = balance.toFixed(2);

  if (balance < 0) {
    setOrderBtnDisabled(true, `余额为负（欠款 ¥${Math.abs(balance).toFixed(2)}），请先充值`);
  } else {
    setOrderBtnDisabled(false);
  }
}

/* ======================
   附加规则：存在待充值订单时也要锁定下单按钮
   ====================== */
async function checkPendingLock() {
  if (!window.currentUserId) return;

  const { data: pend } = await supabaseClient
    .from("orders")
    .select("id")
    .eq("user_id", window.currentUserId)
    .eq("status", "pending")
    .limit(1);

  if (pend && pend.length > 0) {
    setOrderBtnDisabled(true, "存在未完成订单，请先完成该订单");
  }
}

/* ======================
   加载余额（并套用 pending 锁）
   ====================== */
async function loadBalanceOrderPage() {
  if (!window.currentUserId) return;
  const { data, error } = await supabaseClient
    .from("users")
    .select("balance")
    .eq("id", window.currentUserId)
    .single();

  if (!error && data) {
    updateBalanceUI(data.balance);
    await checkPendingLock();
  }
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
   ✅ 已完成订单数（新增模块）
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

  // 绑定刷新按钮
  document.getElementById("refreshCompletedBtn")?.addEventListener("click", loadCompletedOrdersCount);
}

/* ======================
   渲染最近订单（含“完成订单”按钮）
   ====================== */
function renderLastOrder(order, balanceRaw) {
  const el = document.getElementById("orderResult");
  if (!el || !order) return;

  const balance = Number(balanceRaw) || 0;
  const price = Number(order.total_price) || 0;
  const profit = Number(order.profit) || 0;

  let html = `
    <h3>✅ 最近一次订单</h3>
    <p>商品：${order.products?.name || "未知商品"}</p>
    <p>价格：¥${price.toFixed(2)}</p>
    <p>利润：<span style="color:green;">+¥${profit.toFixed(2)}</span></p>
    <p>状态：${order.status === "completed" ? "✅ 已完成" : "⏳ 待充值"}</p>
    <p>时间：${new Date(order.created_at).toLocaleString()}</p>
    <p>当前余额：¥${balance.toFixed(2)}</p>
  `;

  if (order.status === "pending" && balance >= 0) {
    html += `<button id="completeOrderBtn">完成订单</button>`;
  }
  if (balance < 0) {
    html += `<p style="color:red;">⚠️ 您的余额已为负，欠款 ¥${Math.abs(balance).toFixed(2)}，请先充值。</p>`;
  }

  el.innerHTML = html;

  const compBtn = document.getElementById("completeOrderBtn");
  if (compBtn) {
    compBtn.addEventListener("click", async () => {
      compBtn.remove();
      await completeOrder(order, balance);
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
    .select("balance")
    .eq("id", window.currentUserId)
    .single();

  if (orders?.length) {
    renderLastOrder(orders[0], user?.balance ?? 0);
  }
}

/* ======================
   完成订单
   ====================== */
async function completeOrder(order, currentBalanceRaw) {
  if (completing) return;
  completing = true;

  try {
    if (order.status === "completed") {
      await loadBalanceOrderPage();
      await loadLastOrder();
      await loadRecentOrders();
      await loadCompletedOrdersCount();  // ✅ 刷新已完成统计
      return;
    }

    const currentBalance = Number(currentBalanceRaw) || 0;
    const price = Number(order.total_price) || 0;
    const profit = Number(order.profit) || 0;
    const finalBalance = currentBalance + price + profit;

    const { error: orderErr } = await supabaseClient
      .from("orders")
      .update({ status: "completed" })
      .eq("id", order.id)
      .eq("status", "pending");
    if (orderErr) throw new Error(orderErr.message);

    const { error: balErr } = await supabaseClient
      .from("users")
      .update({ balance: finalBalance })
      .eq("id", window.currentUserId);
    if (balErr) throw new Error(balErr.message);

    renderLastOrder({ ...order, status: "completed" }, finalBalance);
    updateBalanceUI(finalBalance);
    await checkPendingLock();
    await loadRecentOrders();
    await loadCompletedOrdersCount();  // ✅ 刷新已完成统计
  } catch (e) {
    alert(e.message || "完成订单失败");
  } finally {
    completing = false;
  }
}

/* ======================
   随机下单逻辑
   ====================== */
async function autoOrder() {
  if (!window.currentUserId) { alert("请先登录！"); return; }
  if (ordering) return;

  ordering = true;
  setOrderBtnDisabled(true, "下单中…");

  try {
    const { data: pend } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId)
      .eq("status", "pending")
      .limit(1);
    if (pend?.length) {
      alert("您有未完成的订单，请先完成该订单再继续下单。");
      await checkPendingLock();
      return;
    }

    const { data: user } = await supabaseClient
      .from("users")
      .select("balance")
      .eq("id", window.currentUserId)
      .single();
    const product = await getRandomProduct();

    const price = Number(product.price) || 0;
    const profit = +(price * 0.1).toFixed(2);

    const tempBalance = (Number(user.balance) || 0) - price;
    await supabaseClient
      .from("users")
      .update({ balance: tempBalance })
      .eq("id", window.currentUserId);

    const status = "pending";
    const { data: newOrder, error: orderErr } = await supabaseClient
      .from("orders")
      .insert({
        user_id: window.currentUserId,
        product_id: product.id,
        total_price: price,
        profit: profit,
        status
      })
      .select(`id, total_price, profit, status, created_at, products ( name )`)
      .single();
    if (orderErr) throw new Error(orderErr.message);

    if (tempBalance < 0) {
      alert(`⚠️ 余额不足，本次下单已进入欠款状态（余额：¥${tempBalance.toFixed(2)}），请充值后完成订单！`);
    }

    renderLastOrder(newOrder, tempBalance);
    updateBalanceUI(tempBalance);
    await checkPendingLock();
    await loadRecentOrders();
    await loadCompletedOrdersCount();  // ✅ 刷新已完成统计
  } catch (e) {
    alert(e.message || "下单失败");
  } finally {
    ordering = false;
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
  loadCompletedOrdersCount();  // ✅ 页面加载时初始化已完成统计
  loadLastOrder();
  loadRecentOrders();
});
