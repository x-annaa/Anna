// ======================
// 初始化用户信息
// ======================
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");

// ======================
// 加载余额（订单页面）
// ======================
async function loadBalanceOrderPage() {
  if (!window.currentUserId) return;

  const { data, error } = await supabaseClient
    .from("users")
    .select("balance")
    .eq("id", window.currentUserId)
    .single();

  if (!error && data) {
    if (document.getElementById("orderBalance")) {
      document.getElementById("orderBalance").textContent = data.balance;
    }
    if (document.getElementById("balance")) {
      document.getElementById("balance").textContent = data.balance;
    }
  }
}

// ======================
// 一键刷单（允许负数余额）
// ======================
async function autoOrder() {
  if (!window.currentUserId) {
    alert("请先登录！");
    return;
  }

  // 取所有产品
  const { data: products, error } = await supabaseClient
    .from("products")
    .select("*");

  if (error || !products || products.length === 0) {
    alert("❌ 产品列表为空！");
    return;
  }

  // 随机选一个
  const randomProduct = products[Math.floor(Math.random() * products.length)];

  // 查余额
  const { data: user } = await supabaseClient
    .from("users")
    .select("balance")
    .eq("id", window.currentUserId)
    .single();

  if (!user) {
    alert("用户不存在！");
    return;
  }

  // ⚡ 直接扣款（允许负数）
  const newBalance = user.balance - randomProduct.price;

  const { error: balanceError } = await supabaseClient
    .from("users")
    .update({ balance: newBalance })
    .eq("id", window.currentUserId);

  if (balanceError) {
    alert("扣款失败：" + balanceError.message);
    return;
  }

  // 生成订单
  const { error: orderError } = await supabaseClient
    .from("orders")
    .insert({
      user_id: window.currentUserId,
      product_id: randomProduct.id,
      quantity: 1,
      total_price: randomProduct.price,
    });

  if (orderError) {
    alert("下单失败：" + orderError.message);
    return;
  }

  // 显示结果（余额不足时额外提醒）
  let msg = `
    <h3>✅ 下单成功！</h3>
    <p>商品：${randomProduct.name}</p>
    <p>价格：¥${randomProduct.price}</p>
    <p>剩余余额：¥${newBalance}</p>
  `;

  if (newBalance < 0) {
    msg += `<p style="color:red;">⚠️ 您的余额已不足，需要充值 ¥${Math.abs(newBalance)} 才能恢复！</p>`;
  }

  if (document.getElementById("orderResult")) {
    document.getElementById("orderResult").innerHTML = msg;
  }

  // 更新余额
  if (document.getElementById("balance")) {
    document.getElementById("balance").textContent = newBalance;
  }
  if (document.getElementById("orderBalance")) {
    document.getElementById("orderBalance").textContent = newBalance;
  }
}

// ======================
// 用户充值
// ======================
async function rechargeBalance() {
  if (!window.currentUserId) {
    alert("请先登录！");
    return;
  }

  const amount = parseFloat(prompt("请输入充值金额：", "100"));
  if (isNaN(amount) || amount <= 0) {
    alert("❌ 金额无效！");
    return;
  }

  // 查询当前余额
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

  // 更新余额
  const { error: updateError } = await supabaseClient
    .from("users")
    .update({ balance: newBalance })
    .eq("id", window.currentUserId);

  if (updateError) {
    alert("充值失败：" + updateError.message);
    return;
  }

  alert(`✅ 充值成功！已充值 ¥${amount}`);
  loadBalanceOrderPage(); // 刷新余额
}

// ======================
// 绑定按钮 & 初始加载
// ======================
document.addEventListener("DOMContentLoaded", () => {
  // 绑定刷单按钮
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.addEventListener("click", autoOrder);
  }

  // 绑定充值按钮
  const rechargeBtn = document.getElementById("rechargeBtn");
  if (rechargeBtn) {
    rechargeBtn.addEventListener("click", rechargeBalance);
  }

  // 加载余额
  loadBalanceOrderPage();
});
