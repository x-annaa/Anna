document.addEventListener("DOMContentLoaded", () => {
  loadShopProducts();
});

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
      const discountedPrice = item.discount > 0
        ? (item.price * (1 - item.discount / 100)).toFixed(2)
        : item.price.toFixed(2);

      const productDiv = document.createElement("div");
      productDiv.classList.add("container-s4");
      productDiv.innerHTML = `
        <img src="${item.image1_url || 'placeholder.png'}" class="product-image" alt="${item.product_code}" />
        <p class="product-name">${item.product_code}</p>
        <p>
          <strong>Price:</strong> $${discountedPrice} 
          ${item.discount > 0 ? `<span style="color:red;">${item.discount}%</span>` : ''}
        <p>
        <p><strong>Rating:</strong> ⭐ ${item.rating ? item.rating.toFixed(1) : '0.0'}</p>
        <button class="buyBtn" 
          data-id="${item.id}" 
          data-name="${item.product_code}"
          data-desc="${item.description || 'No description'}"
          data-image1="${item.image1_url || ''}" 
          data-image2="${item.image2_url || ''}" 
          data-image3="${item.image3_url || ''}"
          data-price="${discountedPrice}">Buy</button>
      `;
      shopContainer.appendChild(productDiv);
    });

    addBuyButtonListeners();
  } catch (e) {
    console.error("⚠️ Unexpected error:", e);
  }
}

function addBuyButtonListeners() {
  const buyButtons = document.querySelectorAll(".buyBtn");
  const buyModal = document.getElementById("buyModal");

  buyButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const productId = btn.dataset.id;
      buyModal.dataset.id = productId;

      document.getElementById("buyImg1").src = btn.dataset.image1 || 'placeholder.png';
      document.getElementById("buyImg2").src = btn.dataset.image2 || 'placeholder.png';
      document.getElementById("buyImg3").src = btn.dataset.image3 || 'placeholder.png';

      document.getElementById("buyProductName").innerText = btn.dataset.name;
      document.getElementById("buyProductPrice").innerHTML = `<strong>Price:</strong> $${btn.dataset.price}`;
      document.getElementById("buyProductDesc").innerText = btn.dataset.desc;

      buyModal.style.display = "flex";
    });
  });

  document.getElementById("cancelBuy1").addEventListener("click", () => {
    buyModal.style.display = "none";
  });

  document.getElementById("confirmBuy1").addEventListener("click", async () => {
    const productId = buyModal.dataset.id;
    const userId = parseInt(localStorage.getItem("currentUserId"));
    const username = localStorage.getItem("currentUser");
    const address = document.getElementById("buyAddress").value.trim();
    const phone = document.getElementById("buyPhone").value.trim();
    const email = document.getElementById("buyEmail").value.trim();

    if (!address || !phone || !email) {
      alert("Please fill out all fields");
      return;
    }

    try {
      const { data: productData, error: prodErr } = await supabaseClient
        .from("products2")
        .select("price")
        .eq("id", productId)
        .single();

      if (prodErr || !productData) {
        alert("Failed to fetch product price");
        return;
      }

      const price = parseFloat(productData.price);

      const { data, error } = await supabaseClient.rpc("add_order_review", {
        p_product_id: parseInt(productId),
        p_user_id: userId,
        p_username: username,
        p_platform: "",   // 提交但不显示
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

      alert(`✅ Your order has been submitted! Remaining balance: $${data[0].remaining_balance}`);
      buyModal.style.display = "none";

      document.getElementById("buyAddress").value = "";
      document.getElementById("buyPhone").value = "";
      document.getElementById("buyEmail").value = "";
    } catch (e) {
      console.error("⚠️ Unexpected error:", e);
      alert("An unexpected error occurred.");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("shopSearchInput");
  const searchBtn = document.getElementById("shopSearchBtn");
  const shopProducts = document.getElementById("shopProducts");

  function doSearch() {
    const keyword = searchInput.value.toLowerCase();
    const productCards = shopProducts.querySelectorAll(".container-s4");

    productCards.forEach(card => {
      const name = card.querySelector(".product-name").textContent.toLowerCase();
      card.style.display = name.includes(keyword) ? "" : "none";
    });
  }

  // 点击按钮搜索
  searchBtn.addEventListener("click", doSearch);

  // 按回车搜索
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      doSearch();
    }
  });
});
