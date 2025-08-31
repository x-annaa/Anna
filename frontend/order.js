/* ======================
   完成订单（返还本金+利润）
   ====================== */
async function completeOrder(order, currentBalance) {
  // 拿用户的实际余额（充值后）
  const { data: user } = await supabaseClient
    .from("users")
    .select("balance")
    .eq("id", window.currentUserId)
    .single();

  const balanceNow = user?.balance ?? currentBalance;

  // 用户下单时支付的本金 = 产品价格
  // 如果是欠款，用户充值后才有足够本金
  const refundPrincipal = order.total_price;

  // 利润 10%
  const profit = order.profit;

  // 新余额 = 当前余额 + 本金 + 利润
  const finalBalance = balanceNow + refundPrincipal + profit;

  // 更新用户余额
  await supabaseClient
    .from("users")
    .update({ balance: finalBalance })
    .eq("id", window.currentUserId);

  // 更新订单状态为已完成
  await supabaseClient
    .from("orders")
    .update({ status: "completed" })
    .eq("id", order.id);

  // 更新UI
  renderLastOrder({ ...order, status: "completed" }, finalBalance);
  updateBalanceUI(finalBalance);
  loadRecentOrders();

  // 完成按钮只允许点击一次
  const compBtn = document.getElementById("completeOrderBtn");
  if (compBtn) compBtn.remove();
}

/* ======================
   充值功能（触发未完成订单自动完成）
   ====================== */
async function rechargeBalance() {
  const amount = parseFloat(prompt("充值金额", "0"));
  if (isNaN(amount) || amount <= 0) { alert("金额无效"); return; }

  // 更新余额
  const { data: user } = await supabaseClient
    .from("users")
    .select("balance")
    .eq("id", window.currentUserId)
    .single();
  const newBalance = user.balance + amount;

  await supabaseClient
    .from("users")
    .update({ balance: newBalance })
    .eq("id", window.currentUserId);

  alert(`充值成功 ¥${amount}`);
  updateBalanceUI(newBalance);

  // 检查是否有待充值订单
  const { data: pending } = await supabaseClient
    .from("orders")
    .select(`id, total_price, profit, status, created_at, products ( name )`)
    .eq("user_id", window.currentUserId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  if (pending?.length && newBalance >= 0) {
    // 用户充值后余额够了，可以让他手动点完成按钮
    renderLastOrder(pending[0], newBalance);
  }

  loadLastOrder();
  loadRecentOrders();
}
