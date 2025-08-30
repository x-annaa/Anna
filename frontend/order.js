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
// 最近 5 个订单
// ======================
async function loadRecentOrders() {
  if (!window.currentUserId) return;

  const { data: orders, error } = await supabaseClient
    .from("orders")
    .select("id, total_price, created_at, products(name)")
    .eq("user_id", window.currentUserId)
    .order("created_at", { ascending: false })
    .limit(5);

  const list = document.getElementById("recentOrders");
  if (!list) return;

  if (error || !orders || orders.length === 0) {
    list.innerHTML = "<li>暂无订单</li>";
    return;
  }

  list.innerHTML = "";
  orders.forEach(order => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${order.products?.name || "未知商品"}</strong> 
      - ¥${order.total_price} 
      <small>(${new Date(order.created_at).toLocaleString()})</small>
    `;
    list.appendChild(li);
  });
}

// ======================
// 一键刷单
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

  // 检查余额
  if (user.balance < randomProduct.price) {
    alert("❌ 余额不足，请先充值！");
    return;
  }

  const newBalance = user.balance - randomProduct.price;

  // 扣余额
  const { error: balanceError } = await supabaseClient
    .from("users")
    .update({ balance: newBalance })
    .eq("id", window.currentUserId);

  if (balanceError) {
    alert("扣款失败：" + balanceError.message);
    return;
  }

  // 生成订单
  const { data: orderData, error: orderError } = await supabaseClient
    .from("orders")
    .insert({
      user_id: window.currentUserId,
      product_id: randomProduct.id,
      quantity: 1,
      total_price: randomProduct.price,
    })
    .select("id, created_at");

  if (orderError) {
    alert("下单失败：" + orderError.message);
    return;
  }

  // 显示结果
  if (document.getElementById("orderResult")) {
    document.getElementById("orderResult").innerHTML = `
      <h3>✅ 下单成功！</h3>
      <p>商品：${randomProduct.name}</p>
      <p>价格：¥${randomProduct.price}</p>
      <p>剩余余额：¥${newBalance}</p>
    `;
  }

  // 更新余额
  if (document.getElementById("balance")) {
    document.getElementById("balance").textContent = newBalance;
  }
  if (document.getElementById("orderBalance")) {
    document.getElementById("orderBalance").textContent = newBalance;
  }

  // ✅ 刷新最近订单（保证最新的一单会出现在历史里）
  await loadRecentOrders();
}

// ======================
// 绑定按钮 & 初始加载
// ======================
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.addEventListener("click", autoOrder);
  }

  loadBalanceOrderPage();
  loadRecentOrders();
});
