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
        ${item.rating ? item.rating.toFixed(1) : '5.0'}

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
