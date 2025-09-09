// ======================
// Order Page JS - 完整版
// ======================

// Supabase 客户端
const supabaseClient = window.supabaseClient;

// DOM 元素
const startTaskBtn = document.getElementById("startTaskBtn");
const autoOrderBtn = document.getElementById("autoOrderBtn");
const taskModal = document.getElementById("taskModal");
const cancelTaskBtn = document.getElementById("cancelTask");
const taskOptions = document.querySelectorAll(".task-option");
const orderCoinsEl = document.getElementById("ordercoins");
const orderResult = document.getElementById("orderResult");

let currentTask = null; // 当前任务对象
let coins = 0;          // 用户 Coins
let ordering = false;   // 防止并发刷单

// ======================
// 获取随机产品
// ======================
async function getRandomProduct() {
  const { data: products, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("enabled", true)
    .eq("manual_only", false);

  if (error) {
    console.error("读取产品失败:", error);
    throw new Error("产品列表读取失败");
  }

  if (!products || products.length === 0) {
    console.warn("产品列表为空，请检查数据库");
    throw new Error("产品列表为空");
  }

  return products[Math.floor(Math.random() * products.length)];
}

// ======================
// 获取用户手动规则产品
// ======================
async function getUserRuleProduct(userId, orderNumber) {
  const { data: rules, error } = await supabaseClient
    .from("user_product_rules")
    .select("product_id")
    .eq("user_id", userId)
    .eq("order_number", orderNumber)
    .eq("enabled", true)
    .limit(1);

  if (error) {
    console.error("读取手动规则失败", error);
    return null;
  }
  return rules?.[0]?.product_id || null;
}

// ======================
// 加载用户 Coins
// ======================
async function loadCoins() {
  const userId = localStorage.getItem("currentUserId");

  if (!userId) return;

  const { data, error } = await supabaseClient
    .from("users")
    .select("coins")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("加载 Coins 出错:", error.message);
    return;
  }

  coins = data.coins || 0;
  orderCoinsEl.textContent = coins.toFixed(2);
}

// ======================
// 更新用户 Coins
// ======================
async function updateCoins(newCoins) {
  const userId = localStorage.getItem("currentUserId");

  const { error } = await supabaseClient
    .from("users")
    .update({ coins: newCoins })
    .eq("id", userId);

  if (error) {
    console.error("更新 Coins 出错:", error.message);
  } else {
    coins = newCoins;
    orderCoinsEl.textContent = coins.toFixed(2);
  }
}

// ======================
// 打开 / 关闭任务单弹窗
// ======================
startTaskBtn.addEventListener("click", () => {
  taskModal.style.display = "block";
});

cancelTaskBtn.addEventListener("click", () => {
  taskModal.style.display = "none";
});

// ======================
// 选择任务单
// ======================
taskOptions.forEach(btn => {
  btn.addEventListener("click", async () => {
    const amount = parseInt(btn.dataset.amount);
    const totalOrders = parseInt(btn.dataset.orders);

    if (coins < amount) {
      alert("Coins 不足，无法开始该任务！");
      return;
    }

    // 扣除 coins
    await updateCoins(coins - amount);

    // 创建任务
    const userId = localStorage.getItem("currentUserId");
    const { data, error } = await supabaseClient
      .from("user_tasks")
      .insert([{
        user_id: userId,
        task_amount: amount,
        total_orders: totalOrders,
        completed_orders: 0,
        task_balance: amount,
        status: "active"
      }])
      .select()
      .single();

    if (error) {
      console.error("创建任务出错:", error.message);
      return;
    }

    currentTask = data;
    taskModal.style.display = "none";
    startTaskBtn.style.display = "none";
    autoOrderBtn.style.display = "inline-block";

    renderTaskProgress();
  });
});

// ======================
// 刷单逻辑 (随机产品 + 手动规则)
// ======================
autoOrderBtn.addEventListener("click", async () => {
  if (!currentTask) return;
  if (ordering) return;

  ordering = true;

  const userId = localStorage.getItem("currentUserId");
  const orderNumber = currentTask.completed_orders + 1;

  try {
    let product = null;

    // 先查手动规则
    const ruleProductId = await getUserRuleProduct(userId, orderNumber);
    if (ruleProductId) {
      const { data: pData, error } = await supabaseClient
        .from("products")
        .select("*")
        .eq("id", ruleProductId)
        .single();
      if (!error && pData) product = pData;
    }

    // 没有规则 -> 随机产品
    if (!product) product = await getRandomProduct();

    const price = Number(product.price) || 0;
    const profit = +(price * 0.1).toFixed(2);

    // 执行一单刷单
    if (currentTask.completed_orders < currentTask.total_orders) {
      currentTask.completed_orders++;
      currentTask.task_balance += price + profit;

      renderTaskProgress();

      // 更新数据库
      const { error } = await supabaseClient
        .from("user_tasks")
        .update({
          completed_orders: currentTask.completed_orders,
          task_balance: currentTask.task_balance
        })
        .eq("id", currentTask.id);

      if (error) console.error("更新任务出错:", error.message);
    }

    // 检查是否完成任务
    if (currentTask.completed_orders >= currentTask.total_orders) {
      showDoneButton();
    }

  } catch (err) {
    console.error("刷单失败:", err);
    alert("刷单失败，请重试");
  } finally {
    ordering = false;
  }
});

// ======================
// 渲染任务进度
// ======================
function renderTaskProgress() {
  if (!currentTask) return;
  orderResult.innerHTML = `
    当前任务：${currentTask.task_amount} - ${currentTask.completed_orders}/${currentTask.total_orders} 单
    <br>任务余额：${currentTask.task_balance.toFixed(2)}
  `;
}

// ======================
// 显示 Done 按钮
// ======================
function showDoneButton() {
  autoOrderBtn.style.display = "none";

  const doneBtn = document.createElement("button");
  doneBtn.textContent = "Done ✅";
  doneBtn.addEventListener("click", async () => {
    // 返回 Coins
    await updateCoins(coins + currentTask.task_balance);

    // 更新任务状态
    const { error } = await supabaseClient
      .from("user_tasks")
      .update({ status: "done" })
      .eq("id", currentTask.id);

    if (error) console.error("完成任务出错:", error.message);

    currentTask = null;
    orderResult.innerHTML = "";
    doneBtn.remove();
    startTaskBtn.style.display = "inline-block";
  });

  orderResult.appendChild(document.createElement("br"));
  orderResult.appendChild(doneBtn);
}

// ======================
// 初始化
// ======================
loadCoins();
