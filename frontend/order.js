/* ======================
   初始化用户
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");

let ordering = false;
let completing = false;

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
   更新 balance2 UI
   ====================== */
function updateBalance2UI(balance2Raw, dailyOrders, dailyLimit) {
  const balance2 = Number(balance2Raw) || 0;
  document.getElementById("orderBalance2").textContent = balance2.toFixed(2);
  document.getElementById("balance2").textContent = balance2.toFixed(2);

  document.getElementById("dailyProgress").textContent =
    `${dailyOrders}/${dailyLimit}`;
}

/* ======================
   加载余额
   ====================== */
async function loadBalanceOrderPage() {
  if (!window.currentUserId) return;
  const { data, error } = await supabaseClient
    .from("users")
    .select("balance, balance2, daily_orders, daily_limit, last_order_date")
    .eq("id", window.currentUserId)
    .single();

  if (error || !data) return;

  // 普通余额
  document.getElementById("orderBalance").textContent = Number(data.balance).toFixed(2);
  document.getElementById("balance").textContent = Number(data.balance).toFixed(2);

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
   页面初始化
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);

  loadBalanceOrderPage();
  loadCompletedOrdersCount();
  loadLastOrder();
  loadRecentOrders();
});
