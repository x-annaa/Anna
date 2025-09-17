/* ======================
   order2.js - 下单限制 + 倒计时
   ====================== */
(() => {
  // 初始化用户信息
  const currentUserUuid = localStorage.getItem("currentUserUuid");
  if (!currentUserUuid) {
    console.error("currentUserUuid 未设置，请先登录");
    return;
  }

  let ordering = false;        // 下单并发保护
  let countdownTimer = null;   // 倒计时计时器

  // 设置按钮状态
  function setOrderBtn(disabled, reason = "") {
    const btn = document.getElementById("autoOrderBtn");
    if (btn) {
      btn.disabled = disabled;
      btn.title = reason || "";
      if (disabled && reason.includes("秒")) {
        btn.textContent = reason;
      } else {
        btn.textContent = disabled ? "🎲 一键刷单（不可用）" : "🎲 一键刷单";
      }
    }
  }

  // 调用 RPC 检查用户是否可以下单
  async function checkOrderLimit() {
    try {
      const { data, error } = await supabaseClient.rpc("can_user_order", { p_user_uuid: currentUserUuid });
      if (error) throw error;

      const { can_order, next_available } = data[0];
      if (can_order) {
        setOrderBtn(false);
      } else {
        const diff = Math.ceil((new Date(next_available) - new Date()) / 1000);
        startCountdown(diff);
      }
    } catch (e) {
      console.error("检查下单限制失败", e);
      setOrderBtn(true, "⚠️ 无法检查下单限制");
    }
  }

  // 倒计时显示
  function startCountdown(seconds) {
    clearInterval(countdownTimer);
    let remaining = seconds;
    setOrderBtn(true, `🕒 请稍候 ${remaining} 秒`);
    countdownTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(countdownTimer);
        setOrderBtn(false);
      } else {
        setOrderBtn(true, `🕒 请稍候 ${remaining} 秒`);
      }
    }, 1000);
  }

  // 自动下单
  async function autoOrder() {
    if (ordering) return;
    ordering = true;
    setOrderBtn(true, "下单中…");

    try {
      // 检查下单限制
      const { data, error } = await supabaseClient.rpc("can_user_order", { p_user_uuid: currentUserUuid });
      if (error) throw error;
      const { can_order, next_available } = data[0];
      if (!can_order) {
        const diff = Math.ceil((new Date(next_available) - new Date()) / 1000);
        startCountdown(diff);
        ordering = false;
        return;
      }

      // 获取随机产品（简单示例）
      const { data: products } = await supabaseClient
        .from("products")
        .select("*")
        .eq("enabled", true)
        .eq("manual_only", false);
      if (!products || products.length === 0) throw new Error("无可用产品");
      const product = products[Math.floor(Math.random() * products.length)];

      // 扣除用户金币
      const { data: user } = await supabaseClient
        .from("users")
        .select("coins")
        .eq("uuid", currentUserUuid)
        .single();
      const coins = Number(user.coins || 0);
      if (coins < Number(product.price)) throw new Error("金币不足");
      await supabaseClient
        .from("users")
        .update({ coins: coins - Number(product.price) })
        .eq("uuid", currentUserUuid);

      // 创建订单
      const { data: newOrder, error: orderErr } = await supabaseClient
        .from("orders")
        .insert({
          user_uuid: currentUserUuid,
          product_id: product.id,
          total_price: product.price,
          profit: +(product.price * product.profit).toFixed(2),
          status: "pending"
        })
        .select()
        .single();
      if (orderErr) throw new Error(orderErr.message);

      alert(`✅ 下单成功：${product.name} ¥${product.price}`);
      // 下单后立即刷新倒计时
      await checkOrderLimit();
    } catch (e) {
      alert(e.message || "下单失败");
    } finally {
      ordering = false;
    }
  }

  // 页面初始化
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
    console.log("✅ order2.js 已加载，按钮倒计时功能启用");
    checkOrderLimit();
    // 定时刷新限制状态，每 1 秒刷新一次（防止页面刷新丢失倒计时）
    setInterval(checkOrderLimit, 1000);
  });
})();
