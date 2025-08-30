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
  if (!btn) return;
  btn.disabled = disabled;
  btn.title = reason;
  btn.textContent = disabled ? "🎲 一键刷单（不可用）" : "🎲 一键刷单";
}

/* ======================
   更新余额到页面
   ====================== */
function updateBalanceUI(balance) {
  const ob = document.getElementById("orderBalance");
  const mb = document.getElementById("balance");
  if (ob) ob.textContent = balance;
  if (mb) mb.textContent = balance;

  // 如果余额为负 → 禁止继续下单
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

  if (error || !data) {
    console.error("加载余额失败：", error?.message);
    return;
  }
  updateBalanceUI(data.balance);
}

/* ======================
   随机获取一个产品
   ====================== */
async function getRandomProduct() {
  const { data: products, error } = await supabaseClient
    .from("products")
    .select("*");

  if (error) throw new Error("读取产品失败：" + error.message);
  if (!products || products.length === 0) throw new Error("产品列表为空！");
  return products[Math.floor(Math.random() * products.length)];
}

/* ======================
   一键刷单
   ====================== */
async function autoOrder() {
  if (!window.currentUserId) {
    alert("请先登录！");
    return;
  }
  if (ordering) return;

  ordering = true;
  setOrderBtnDisabled(true, "下单中…");

  try {
    // 查余额
    const { data: user, error: uErr } = await supabaseClient
      .from("users")
      .select("balance")
      .eq("id", window.currentUserId)
      .single();

    if (uErr || !user) throw new Error("读取余额失败！");
    if (user.balance < 0) {
      alert(`⚠️ 欠款 ¥${Math.abs(user.balance)}，请充值后再下单！`);
      updateBalanceUI(user.balance);
      return;
    }

    // 随机选产品
    const product = await getRandomProduct();

    // 创建订单
    const { error: orderErr } = await supabaseClient
      .from("orders")
      .insert({
        user_id: window.currentUserId,
        product_id: product.id,
        quantity: 1,
        total_price: product.price,
      });

    if (orderErr) throw new Error("下单失败：" + orderErr.message);

    // 扣余额
    const newBalance = user.balance - product.price;
    const { error: balErr } = await supabaseClient
      .from("users")
      .update({ balance: newBalance })
      .eq("id", window.currentUserId);

    if (balErr) throw new Error("扣款失败：" + balErr.message);

    // 显示结果
    const el = document.getElementById("orderResult");
    if (el) {
      let html = `
        <h3>✅ 下单成功！</h3>
        <p>商品：${product.name}</p>
        <p>价格：¥${product.price}</p>
        <p>剩余余额：¥${newBalance}</p>
      `;
      if (newBalance < 0) {
        html += `<p style="color:red;">⚠️ 您的余额已为负，欠款 ¥${Math.abs(newBalance)}，请先充值。</p>`;
      }
      el.innerHTML = html;
    }

    // 更新余额 + 历史
    updateBalanceUI(newBalance);
    loadRecentOrders();
  } catch (e) {
    alert(e.message || "下单异常");
  } finally {
    ordering = false;
  }
}

/* ======================
   最近 5 个订单
   ====================== */
async function loadRecentOrders() {
  if (!window.currentUserId) return;

  const { data: orders, error } = await supabaseClient
    .from("orders")
    .select(`
      id,
      total_price,
      created_at,
      products ( name )
    `)
    .eq("user_id", window.currentUserId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("获取订单历史失败：", error.message);
    return;
  }

  const list = document.getElementById("recentOrders");
  if (list) {
    list.innerHTML = orders
      .map(
        (o) => `
        <li>
          🛒 ${o.products?.name || "未知商品"}  
          ¥${o.total_price}  
          <small>${new Date(o.created_at).toLocaleString()}</small>
        </li>`
      )
      .join("");
  }
}

/* ======================
   充值
   ====================== */
async function rechargeBalance() {
  const amount = parseFloat(prompt("请输入充值金额：", "100"));
  if (isNaN(amount) || amount <= 0) {
    alert("❌ 金额无效！");
    return;
  }

  const { data: user, error } = await supabaseClient
    .from("users")
    .select("balance")
    .eq("id", window.currentUserId)
    .single();

  if (error || !user) {
    alert("获取余额失败！");
    return;
  }

  const newBalance = user.balance + amount;
  const { error: upErr } = await supabaseClient
    .from("users")
    .update({ balance: newBalance })
    .eq("id", window.currentUserId);

  if (upErr) {
    alert("充值失败：" + upErr.message);
    return;
  }

  alert(`✅ 充值成功！已充值 ¥${amount}`);
  updateBalanceUI(newBalance);
}

/* ======================
   初始化
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) btn.addEventListener("click", autoOrder);

  const rechargeBtn = document.getElementById("rechargeBtn");
  if (rechargeBtn) rechargeBtn.addEventListener("click", rechargeBalance);

  loadBalanceOrderPage();
  loadRecentOrders();
});
