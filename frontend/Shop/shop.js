// shop.js

document.addEventListener("DOMContentLoaded", () => {
  const username = localStorage.getItem("currentUser") || "";
  const platform = localStorage.getItem("platformAccount") || "";
  const userId = localStorage.getItem("currentUserId");

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
      productDiv.classList.add("container-s4");
      productDiv.innerHTML = `
        <img src="${item.image1_url}" class="product-image" alt="product" />
        <p><strong>Code:</strong> ${item.product_code}</p>
        <p><strong>Price:</strong> $${item.price}</p>
        <p><strong>Rating:</strong> ⭐ ${item.rating}</p>
        <button class="buyBtn" data-id="${item.id}" data-img1="${item.image1_url}" data-img2="${item.image2_url}" data-img3="${item.image3_url}" data-price="${item.price}">Buy</button>
      `;
      shopContainer.appendChild(productDiv);
    });

    addBuyButtonListeners();
  } catch (e) {
    console.error("⚠️ Unexpected error:", e);
  }
}

// Buy 按钮事件
function addBuyButtonListeners() {
  const buyButtons = document.querySelectorAll(".buyBtn");
  const buyModal = document.getElementById("buyModal");

  buyButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const productId = btn.dataset.id;
      const img1 = btn.dataset.img1;
      const img2 = btn.dataset.img2;
      const img3 = btn.dataset.img3;
      const price = parseFloat(btn.dataset.price);

      buyModal.dataset.id = productId;
      buyModal.dataset.price = price;

      document.getElementById("buyImg1").src = img1;
      document.getElementById("buyImg2").src = img2;
      document.getElementById("buyImg3").src = img3;

      buyModal.style.display = "flex";
    });
  });

  // 取消按钮
  document.getElementById("cancelBuy").addEventListener("click", () => {
    buyModal.style.display = "none";
  });

  // 确认提交订单
  document.getElementById("confirmBuy").addEventListener("click", async () => {
    const buyModal = document.getElementById("buyModal");
    const productId = buyModal.dataset.id;
    const price = parseFloat(buyModal.dataset.price);

    const userId = localStorage.getItem("currentUserId");
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
      // 获取用户余额
      const { data: userData, error: userErr } = await supabaseClient
        .from("users")
        .select("balance")
        .eq("id", userId)
        .maybeSingle();

      if (userErr || !userData) {
        alert("Failed to fetch user balance");
        return;
      }

      if (parseFloat(userData.balance) < price) {
        alert("❌ Not enough balance to buy this product!");
        return;
      }

      // 扣除余额
      const { error: updateErr } = await supabaseClient
        .from("users")
        .update({ balance: parseFloat(userData.balance) - price })
        .eq("id", userId);

      if (updateErr) {
        alert("Failed to update balance: " + updateErr.message);
        return;
      }

      // 插入到 order_reviews
      const { data, error } = await supabaseClient.rpc("add_order_review", {
        p_product_id: parseInt(productId),
        p_user_id: parseInt(userId),
        p_username: username,
        p_platform: platform,
        p_address: address,
        p_phone: phone,
        p_email: email,
        p_amount: price
      });

      if (error) {
        console.error("❌ Failed to submit order:", error.message);
        alert("Failed to submit order: " + error.message);
        return;
      }

      alert("✅ Your order has been submitted for review!");
      buyModal.style.display = "none";

      // 清空输入框
      document.getElementById("buyAddress").value = "";
      document.getElementById("buyPhone").value = "";
      document.getElementById("buyEmail").value = "";
    } catch (e) {
      console.error("⚠️ Unexpected error:", e);
      alert("An unexpected error occurred.");
    }
  });
}
