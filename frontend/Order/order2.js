/* ======================
   order2.js - 下单限制 + 倒计时
   ====================== */
(() => {
  // ======================
  // 初始化用户信息
  // ======================
  const currentUserUuid = localStorage.getItem("currentUserUuid");
  if (!currentUserUuid) {
    console.error("❌ currentUserUuid 未设置，请先登录");
    return;
  }

  let ordering = false; // 下单中的并发保护
  let cooldownTimer = null;

  // ======================
  // 工具函数
  // ======================
  function setOrderBtnDisabled(disabled, reason = "") {
    const btn = document.getElementById("autoOrderBtn");
    if (!btn) return;
    btn.disabled = disabled;
    btn.title = reason || "";
    btn.textContent = disabled
      ? reason ? `🎲 一键刷单（${reason}）` : "🎲 一键刷单（不可用）"
      : "🎲 一键刷单";
  }

  function startCooldown(nextAvailableTime) {
    if (!nextAvailableTime) return;

    if (cooldownTimer) clearInterval(cooldownTimer);

    function updateBtn() {
      const now = new Date();
      const diff = new Date(nextAvailableTime) - now;
      if (diff <= 0) {
        clearInterval(cooldownTimer);
        setOrderBtnDisabled(false);
      } else {
        const sec = Math.ceil(diff / 1000);
        setOrderBtnDisabled(true, `⏳ 等待 ${sec}s`);
      }
    }

    updateBtn();
    cooldownTimer = setInterval(updateBtn, 250);
  }

  // ======================
  // 检查用户下单限制
  // ======================
  async function checkOrderLimit() {
    try {
      const { data, error } = await supabaseClient
        .rpc("can_user_order", { p_user_uuid: currentUserUuid })
        .single();

      if (error) throw error;

      if (!data.can_order && data.next_available) {
        startCooldown(data.next_available);
        return false;
      } else {
        setOrderBtnDisabled(false);
        return true;
      }
    } catch (e) {
      console.error("检查下单限制失败", e);
      setOrderBtnDisabled(true, "检查下单限制失败");
      return false;
    }
  }

  // ======================
  // 自动下单函数（简化示例）
  // ======================
  async function autoOrder() {
    if (ordering) return;
    ordering = true;

    try {
      const canOrder = await checkOrderLimit();
      if (!canOrder) {
        ordering = false;
        return;
      }

      // ✅ 可以下单，调用你现有的下单逻辑
      // 这里仅做示例，你可以调用 order.js 的 autoOrder 逻辑或复制
      console.log("✅ 可以下单，执行下单逻辑");

      // 模拟下单成功后更新数据库 user_limits
      await supabaseClient.from("user_limits")
        .update({ orders_count: supabaseClient.raw("orders_count + 1"), last_order_at: new Date().toISOString() })
        .eq("user_uuid", currentUserUuid);

      // 下单后再次检查限制，启动倒计时（如果达上限）
      await checkOrderLimit();

    } catch (e) {
      console.error("下单失败", e);
      alert("下单失败：" + e.message);
    } finally {
      ordering = false;
    }
  }

  // ======================
  // 页面初始化
  // ======================
  document.addEventListener("DOMContentLoaded", async () => {
    const btn = document.getElementById("autoOrderBtn");
    if (btn) btn.addEventListener("click", autoOrder);

    // 页面加载时检查一次下单限制
    await checkOrderLimit();

    console.log("✅ order2.js 已加载，按钮倒计时功能启用");
  });
})();
