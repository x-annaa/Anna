document.addEventListener("DOMContentLoaded", () => {
  // 显示当前用户信息到 Buy 弹窗
  const username = localStorage.getItem("currentUser") || "";
  const platform = localStorage.getItem("platformAccount") || "";

  document.getElementById("buyUsername").innerText = username;
  document.getElementById("buyPlatform").innerText = platform;

  loadShopProducts();
});

// 加载 products2 表数据
async function loadShopProducts() {
  try {
    const { data: products2, error } = await supabaseClient
      .from("products2")
      .select("*");

    if (error) {
      console.error("❌ Failed to load products2:", error.message);
      return;
    }

    const shopContainer = document.getElementById("shopProducts");
    shopContainer.innerHTML = "";

    products2.forEach(item => {
      const productDiv = document.createElement("div");
      productDiv.classList.add("product-card");
      productDiv.innerHTML = `
        <img src="${item.image1_url}" class="product-image" alt="product">
        <p><strong>Code:</strong> ${item.product_code}</p>
        <p><strong>Price:</strong> $${item.price?.toFixed(2) || 0}</p>
        <p><strong>Rating:</strong> ⭐ ${item.rating}</p>
        <button class="buyBtn" data-id="${item.id}" 
                data-image1="${item.image1_url}" 
                data-image2="${item.image2_url}" 
                data-image3="${item.image3_url}" 
                data-price="${item.price}">Buy</button>
      `;
      shopContainer.appendChild(productDiv);
    });

    addBuyButtonListeners();
  } catch (e) {
    console.error("⚠️ Unexpected error:", e);
  }
}

// Buy 模态框事件
function addBuyButtonListeners() {
  const buyButtons = document.querySelectorAll(".buyBtn");
  const buyModal = document.getElementById("buyModal");

  buyButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const productId = btn.getAttribute("data-id");
      const image1 = btn.getAttribute("data-image1");
      const image2 = btn.getAttribute("data-image2");
      const image3 = btn.getAttribute("data-image3");
      const price = parseFloat(btn.getAttribute("data-price")) || 0;

      // 显示图片
      document.getElementById("buyImg1").src = image1;
      document.getElementById("buyImg2").src = image2;
      document.getElementById("buyImg3").src = image3;

      // 保存 productId 和 price 到 modal dataset
      buyModal.dataset.productId = productId;
      buyModal.dataset.price = price;

      buyModal.style.display = "flex";
    });
  });

  // 取消按钮
  document.getElementById("cancelBuy").addEventListener("click", () => {
    buyModal.style.display = "none";
  });

  // 确认提交
  document.getElementById("confirmBuy").addEventListener("click", async () => {
    const productId = buyModal.dataset.productId;
    const price = parseFloat(buyModal.dataset.price);
    const userId = parseInt(localStorage.getItem("currentUserId"));
    const username = localStorage.getItem("currentUser");
    const platform = localStorage.getItem("platformAccount");
    const address = document.getElementById("buyAddress").value.trim();
    const phone = document.getElementById("buyPhone").value.trim();
    const email = document.getElementById("buyEmail").value.trim();

    if (!address || !phone || !email) {
      alert("Please fill out all fields");
      return;
    }

    try {
      // 检查余额
      const { data: user, error: userErr } = await supabaseClient
        .from("users")
        .select("balance")
        .eq("id", userId)
        .maybeSingle();

      if (userErr) throw new Error(userErr.message);
      if (!user) throw new Error("User not found");
      if (user.balance < price) {
        alert("❌ Insufficient balance!");
        return;
      }

      // 扣除余额
      const { error: deductErr } = await supabaseClient
        .from("users")
        .update({ balance: user.balance - price })
        .eq("id", userId);

      if (deductErr) throw new Error(deductErr.message);

      // 提交订单到 RPC
      const { data, error: rpcErr } = await supabaseClient.rpc("add_order_review", {
        p_product_id: parseInt(productId),
        p_user_id: userId,
        p_username: username,
        p_platform: platform,
        p_address: address,
        p_phone: phone,
        p_email: email,
        p_amount: price
      });

      if (rpcErr) throw new Error(rpcErr.message);

      alert("✅ Your order has been submitted for review!");
      buyModal.style.display = "none";

      // 清空输入框
      document.getElementById("buyAddress").value = "";
      document.getElementById("buyPhone").value = "";
      document.getElementById("buyEmail").value = "";

    } catch (e) {
      console.error("❌ Failed to submit order:", e.message);
      alert("Failed to submit order: " + e.message);
    }
  });
}
