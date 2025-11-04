document.addEventListener("DOMContentLoaded", () => {
  loadShopProducts();
  setupSearch();
});

async function loadShopProducts() {
  try {
    const { data: products2, error } = await supabaseClient
      .from("products2")
      .select("*")
      .eq("is_visible", true);


    if (error) {
      console.error("Failed to load products2:", error.message);
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
        <img src="${item.image1_url}" class="product-image" alt="${item.product_code}" />
        <p class="product-name">${item.product_code}</p>
        <p><strong>Price:</strong> $${discountedPrice} ${
          item.discount > 0 ? `<span style="color:red;">-${item.discount}%</span>` : ""
        }</p>
        <p><strong>Rating:</strong> ⭐ ${item.rating?.toFixed(1) ?? '5.0'}</p>

        <button class="buyBtn"
          data-id="${item.id}"
          data-name="${item.product_code}"
          data-desc="${item.description ?? ''}"
          data-image1="${item.image1_url}"
          data-image2="${item.image2_url}"
          data-image3="${item.image3_url}"
          data-price="${discountedPrice}">
          Buy
        </button>
      `;
      shopContainer.appendChild(productDiv);
    });

    addBuyButtonListeners();
  } catch (e) {
    console.error("⚠️ Unexpected error:", e);
  }
}

function setupSearch() {
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

  searchBtn.addEventListener("click", doSearch);
  searchInput.addEventListener("keydown", (e) => e.key === "Enter" && doSearch());
}

const buyModal = document.getElementById("buyModal");
let quantity = 1;
let unitPrice = 0;

const qtyDisplay = document.getElementById("buyQuantity");
const priceDisplay = document.getElementById("buyProductPrice");

function addBuyButtonListeners() {
  const buyButtons = document.querySelectorAll(".buyBtn");

  buyButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const productId = btn.dataset.id;
      buyModal.dataset.id = productId;

      document.getElementById("buyImg1").src = btn.dataset.image1;
      document.getElementById("buyImg2").src = btn.dataset.image2;
      document.getElementById("buyImg3").src = btn.dataset.image3;

      document.getElementById("buyProductName").innerText = btn.dataset.name;
      document.getElementById("buyProductDesc").innerText = btn.dataset.desc;

      unitPrice = Number(btn.dataset.price);
      quantity = 1;
      qtyDisplay.textContent = quantity;
      updateTotalPrice();

      buyModal.style.display = "flex";
    });
  });
}

function updateTotalPrice() {
  const total = unitPrice * quantity;
  priceDisplay.innerHTML = `<strong>Total:</strong> $${total.toFixed(2)}`;
}

document.getElementById("qtyMinus").addEventListener("click", () => {
  if (quantity > 1) {
    quantity--;
    qtyDisplay.textContent = quantity;
    updateTotalPrice();
  }
});

document.getElementById("qtyPlus").addEventListener("click", () => {
  quantity++;
  qtyDisplay.textContent = quantity;
  updateTotalPrice();
});

document.getElementById("cancelBuy1").addEventListener("click", () => {
  buyModal.style.display = "none";
});

document.getElementById("confirmBuy1").addEventListener("click", async () => {
  const productId = parseInt(buyModal.dataset.id);
  const userId = parseInt(localStorage.getItem("currentUserId"));
  const username = localStorage.getItem("currentUser");

  const address = document.getElementById("buyAddress").value.trim();
  const phone = document.getElementById("buyPhone").value.trim();
  const email = document.getElementById("buyEmail").value.trim();

  if (!address || !phone || !email) {
    alert("⚠️ Fill all required fields!");
    return;
  }

  const totalCost = unitPrice * quantity;

  try {

    const { data: userData, error: userErr } = await supabaseClient
      .from("users")
      .select("balance")
      .eq("id", userId)
      .single();

    if (userErr || !userData) {
      alert("Failed to fetch user data.");
      return;
    }

    if (userData.balance < totalCost) {
      alert("Insufficient balance!");
      return;
    }

    const { error: updateErr } = await supabaseClient
      .from("users")
      .update({ balance: userData.balance - totalCost })
      .eq("id", userId);

    if (updateErr) {
      alert("Failed to update balance: " + updateErr.message);
      return;
    }

    const { error: orderErr } = await supabaseClient
      .from("order_reviews")
      .insert([
        {
          product2_id: productId,
          user_id: userId,
          username,
          platform: "",
          address,
          phone,
          email,
          quantity,
          amount: totalCost
        }
      ]);

    if (orderErr) {
      alert("Submit order failed: " + orderErr.message);
      return;
    }

    alert("Order submitted and balance deducted successfully!");

    buyModal.style.display = "none";
    document.getElementById("buyAddress").value = "";
    document.getElementById("buyPhone").value = "";
    document.getElementById("buyEmail").value = "";
    qtyDisplay.textContent = "1";
    quantity = 1;
    updateTotalPrice();

  } catch (e) {
    console.error(e);
    alert("⚠️ Unexpected error occurred.");
  }
});

// 🛒 查看订单按钮逻辑
document.getElementById("viewOrdersBtn").addEventListener("click", async () => {
  const userId = parseInt(localStorage.getItem("currentUserId"));
  if (!userId) {
    alert("Please login first!");
    return;
  }

  const modal = document.getElementById("orderListModal");
  const container = document.getElementById("orderListContainer");

  modal.style.display = "flex";
  container.innerHTML = "<p>Loading...</p>";

  try {
    const { data: orders, error } = await supabaseClient
      .from("order_reviews")
      .select("id, product2_id, amount, quantity, created_at, status, remark, products2(image1_url, product_code, price)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      container.innerHTML = `<p style="color:red;">Failed to load orders: ${error.message}</p>`;
      return;
    }

    if (!orders || orders.length === 0) {
      container.innerHTML = "<p>No orders found.</p>";
      return;
    }

    container.innerHTML = orders.map(o => `
      <div style="border-bottom:1px solid #ddd; padding:10px 0; display:flex; gap:10px; align-items:center;">
        <img src="${o.products2?.image1_url ?? ''}" 
             alt="Product"
             style="width:60px; height:60px; object-fit:cover; border-radius:5px; flex-shrink:0;">
        <div style="flex:1;">
          <strong>${o.products2?.product_code ?? 'Unknown Product'}</strong><br>
          Amount: $${Number(o.amount).toFixed(2)}<br>
          Quantity: ${o.quantity}<br>
          Date: ${new Date(o.created_at).toLocaleDateString()}<br>
          Remark: ${o.remark && o.remark.trim() !== "" ? o.remark : "Processing"}
        </div>
      </div>
    `).join("");
  } catch (e) {
    console.error(e);
    container.innerHTML = "<p style='color:red;'>Unexpected error occurred.</p>";
  }
});

document.getElementById("closeOrderListBtn").addEventListener("click", () => {
  document.getElementById("orderListModal").style.display = "none";
});
