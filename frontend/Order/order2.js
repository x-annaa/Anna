/* ======================
   下单限制检查 + 倒计时
   ====================== */
async function checkOrderLimit() {
  if (!window.currentUserId) return { canOrder: true };

  try {
    const { data, error } = await supabaseClient
      .rpc("can_user_order", { p_user_uuid: window.currentUserId }) // UUID
      .single();

    if (error) throw error;

    const canOrder = data?.can_order ?? true;
    const nextAvailable = data?.next_available ? new Date(data.next_available) : null;

    if (!canOrder && nextAvailable) {
      const now = new Date();
      let diff = Math.floor((nextAvailable - now) / 1000);
      setOrderBtnDisabled(true, `⚠️ 下单过于频繁，${diff}s 后可下单`);

      // 倒计时更新
      const interval = setInterval(() => {
        diff -= 1;
        if (diff <= 0) {
          clearInterval(interval);
          setOrderBtnDisabled(false);
        } else {
          setOrderBtnDisabled(true, `⚠️ 下单过于频繁，${diff}s 后可下单`);
        }
      }, 1000);

      return { canOrder: false };
    }

    setOrderBtnDisabled(false);
    return { canOrder: true };
  } catch (err) {
    console.error("检查下单限制失败", err);
    return { canOrder: true };
  }
}

/* ======================
   自动下单（结合限制）
   ====================== */
async function autoOrder2() {
  if (!window.currentUserId) { alert("请先登录！"); return; }
  if (ordering) return;
  ordering = true;

  // 先检查限制
  const { canOrder } = await checkOrderLimit();
  if (!canOrder) { ordering = false; return; }

  setOrderBtnDisabled(true, "下单中…");

  try {
    // 获取随机产品或规则产品
    let product;
    const { data: orders } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId)
      .order("created_at", { ascending: false })
      .limit(1);

    const orderNumber = (orders?.length || 0) + 1;

    const ruleProductId = await getUserRuleProduct(window.currentUserId, orderNumber);
    if (ruleProductId) {
      const { data: pData } = await supabaseClient
        .from("products")
        .select("*")
        .eq("id", ruleProductId)
        .single();
      if (pData) product = pData;
    }
    if (!product) product = await getRandomProduct();

    // 扣 Coins & 创建订单
    const { data: user } = await supabaseClient
      .from("users")
      .select("coins")
      .eq("uuid", window.currentUserId)
      .single();
    const coins = Number(user?.coins || 0);
    if (coins < product.price) { alert("金币不足！"); return; }

    const tempCoins = coins - Number(product.price);
    await supabaseClient
      .from("users")
      .update({ coins: tempCoins })
      .eq("uuid", window.currentUserId);

    const { data: newOrder } = await supabaseClient
      .from("orders")
      .insert({
        user_id: user.id,
        product_id: product.id,
        total_price: Number(product.price),
        profit: +(Number(product.price) * Number(product.profit)).toFixed(2),
        status: "pending"
      })
      .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
      .single();

    renderLastOrder(newOrder, tempCoins);
    updateCoinsUI(tempCoins);
    await checkPendingLock();
    await loadRecentOrders();

  } catch (err) {
    console.error("下单失败", err);
    alert("下单失败");
  } finally {
    ordering = false;
  }
}

/* ======================
   页面初始化
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder2);
  console.log("✅ order2.js 已加载，按钮倒计时功能启用");
});
