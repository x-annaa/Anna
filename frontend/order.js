/* ======================
   初始化用户
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");

let ordering = false;

/* ======================
   工具：更新按钮状态
   ====================== */
function setOrderBtnDisabled(disabled, reason = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.disabled = disabled;
    btn.title = reason;
    btn.textContent = disabled ? "🎲 一键刷单（不可用）" : "🎲 一键刷单";
  }
}

/* ======================
   更新余额 UI
   ====================== */
function updateBalanceUI(balance) {
  const ob = document.getElementById("orderBalance");
  const mb = document.getElementById("balance");
  if (ob) ob.textContent = balance.toFixed(2);
  if (mb) mb.textContent = balance.toFixed(2);

  if (balance < 0) {
    setOrderBtnDisabled(true, `余额为负（欠款 ¥${Math.abs(balance)}），请先充值`);
  } else {
    setOrderBtnDisabled(false);
  }
}

/* ======================
   加载余额
   ====================== */
async function loadBalanceOrderPage() {
  if (!window.currentUserId) return;
  const { data, error } = await supabaseClient
    .from("users")
    .select("balance")
    .eq("id", window.currentUserId)
    .single();
  if (!error && data) updateBalanceUI(data.balance);
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
   渲染最近订单（含完成按钮）
   ====================== */
function renderLastOrder(order, balance) {
  const el = document.getElementById("orderResult");
  if (!el || !order) return;

  let html = `
    <h3>✅ 最近一次订单</h3>
    <p>商品：${order.products?.name || "未知商品"}</p>
    <p>价格：¥${order.total_price}</p>
    <p>利润：<span style="color:green;">+¥${order.profit?.toFixed(2) || "0.00"}</span></p>
    <p>状态：${order.status === "completed" ? "已完成" : "⏳ 待充值"}</p>
    <p>时间：${new Date(order.created_at).toLocaleString()}</p>
    <p>当前余额：¥${balance.toFixed(2)}</p>
  `;

  if (order.status === "pending" && balance >= 0) {
    html += `<button id="completeOrderBtn">完成订单</button>`;
  }
  if (balance < 0) {
    html += `<p style="color:red;">⚠️ 您的余额已为负，欠款 ¥${Math.abs(balance)}，请先充值。</p>`;
  }

  el.innerHTML = html;

  // 完成按钮点击绑定
  const compBtn = document.getElementById("completeOrderBtn");
  if (compBtn) {
    compBtn.addEventListener("click", async () => {
      compBtn.remove(); // 点击一次后按钮消失
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

  if (orders?.length) renderLastOrder(orders[0], user?.balance ?? 0);
}

/* ======================
   完成订单（返还本金+利润）
   ====================== */
async function completeOrder(order, currentBalance) {
  // 防止重复完成
  if (order.status === "completed") {
    alert("订单已完成，不能重复操作！");
    return;
  }

  const finalBalance = currentBalance + order.total_price + order.profit;

  // 更新用户余额
  await supabaseClient.from("users")
    .update({ balance: finalBalance })
    .eq("id", window.currentUserId);

  // 更新订单状态
  await supabaseClient.from("orders")
    .update({ status: "completed" })
    .eq("id", order.id)
    .eq("status", "pending");

  renderLastOrder({ ...order, status: "completed" }, finalBalance);
  updateBalanceUI(finalBalance);
  loadRecentOrders();

  // ✅ 完成订单后恢复刷单按钮
  setOrderBtnDisabled(false);
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
    const { data: user } = await supabaseClient.from("users")
      .select("balance")
      .eq("id", window.currentUserId)
      .single();

    const product = await getRandomProduct();
    const tempBalance = user.balance - product.price;

    // 扣本金
    await supabaseClient.from("users")
      .update({ balance: tempBalance })
      .eq("id", window.currentUserId);

    // 新订单
    const profit = product.price * 0.1;
    const { data: newOrder } = await supabaseClient.from("orders")
      .insert({
        user_id: window.currentUserId,
        product_id: product.id,
        total_price: product.price,
        profit,
        status: tempBalance >= 0 ? "completed" : "pending"
      })
      .select(`id, total_price, profit, status, created_at, products ( name )`)
      .single();

    if (tempBalance >= 0) {
      await completeOrder(newOrder, tempBalance);
    } else {
      alert(`⚠️ 余额不足，本次下单已进入欠款状态 (余额：¥${tempBalance})，请充值后完成订单！`);
      renderLastOrder(newOrder, tempBalance);
      updateBalanceUI(tempBalance);
    }
  } catch (e) {
    alert(e.message || "下单失败");
  } finally {
    ordering = false;
    loadRecentOrders();
  }
}

/* ======================
   最近 5 笔订单历史
   ====================== */
async function loadRecentOrders() {
  if (!window.currentUserId) return;
  const { data: orders } = await supabaseClient.from("orders")
    .select(`id, total_price, profit, status, created_at, products ( name )`)
    .eq("user_id", window.currentUserId)
    .order("created_at", { ascending: false })
    .limit(5);

  const list = document.getElementById("recentOrders");
  if (list) {
    list.innerHTML = orders.map(o => `
      <li>
        🛒 ${o.products?.name || "未知商品"} /
        ¥${o.total_price} /
        利润 +¥${o.profit?.toFixed(2) || "0.00"} /
        状态：${o.status === "completed" ? "已完成" : "待充值"} /
        <small>${new Date(o.created_at).toLocaleString()}</small>
      </li>
    `).join("");
  }
}

/* ======================
   充值功能
   ====================== */
async function rechargeBalance() {
  const amount = parseFloat(prompt("充值金额", "0"));
  if (isNaN(amount) || amount <= 0) { alert("金额无效"); return; }

  const { data: user } = await supabaseClient.from("users")
    .select("balance")
    .eq("id", window.currentUserId)
    .single();

  const newBalance = user.balance + amount;
  await supabaseClient.from("users")
    .update({ balance: newBalance })
    .eq("id", window.currentUserId);

  alert(`充值成功 ¥${amount}`);
  updateBalanceUI(newBalance);

  // 自动完成待充值订单
  const { data: pending } = await supabaseClient.from("orders")
    .select(`id, total_price, profit, status, created_at, products ( name )`)
    .eq("user_id", window.currentUserId)
    .eq("status", "pending");

  if (pending?.length && newBalance >= 0) {
    await completeOrder(pending[0], newBalance);
  }

  loadLastOrder();
  loadRecentOrders();
}

/* ======================
   页面初始化
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  document.getElementById("rechargeBtn")?.addEventListener("click", rechargeBalance);

  loadBalanceOrderPage();
  loadLastOrder();
  loadRecentOrders();
});
