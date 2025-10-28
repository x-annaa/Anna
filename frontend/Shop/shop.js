// ----------------------------
// 初始化 Shop 页面
// ----------------------------
document.addEventListener('DOMContentLoaded', async () => {
  await loadShopProducts();
  initBuyModal();
});

// ----------------------------
// 加载产品
// ----------------------------
async function loadShopProducts() {
  if (!window.supabase) {
    console.error('Supabase not initialized');
    return;
  }

  try {
    // 联表查询 products + product_details
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id, name, price, description,
        product_details(id, product_id, image1_url, image2_url, image3_url, product_code, discount, rating, description)
      `);

    if (error) {
      console.error(error);
      return;
    }

    const container = document.getElementById('shopProducts');
    container.innerHTML = '';

    products.forEach(product => {
      const details = product.product_details[0]; // 假设一对一关系
      const card = document.createElement('div');
      card.className = 'product-card';

      card.innerHTML = `
        <div class="image-slider">
          <img src="${details.image1_url}" data-images='["${details.image1_url}","${details.image2_url}","${details.image3_url}"]'>
        </div>
        <div class="product-info">
          <h4>${details.product_code} ${product.name}</h4>
          <p>${details.description || product.description || ''}</p>
          <p>Price: $${product.price}</p>
          <p>Discount: ${details.discount || 0}%</p>
          <p>Rating: ${'⭐'.repeat(details.rating || 5)}</p>
          <button class="buy-btn" data-id="${product.id}">Buy</button>
        </div>
      `;
      container.appendChild(card);
    });

    initImageSlider();
    initBuyButtons();

  } catch (err) {
    console.error(err);
  }
}

// ----------------------------
// 图片轮播功能
// ----------------------------
function initImageSlider() {
  document.querySelectorAll('.image-slider img').forEach(img => {
    const images = JSON.parse(img.dataset.images);
    let index = 0;

    img.addEventListener('click', () => {
      index = (index + 1) % images.length;
      img.src = images[index];
    });
  });
}

// ----------------------------
// Buy 按钮事件
// ----------------------------
function initBuyButtons() {
  document.querySelectorAll('.buy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const user = await getUserInfo();
      document.getElementById('buyUsername').textContent = user.username;
      document.getElementById('buyPlatform').textContent = user.platform_account;

      const buyModal = document.getElementById('buyModal');
      buyModal.classList.add('active');

      const confirmBtn = document.getElementById('confirmBuy');
      const cancelBtn = document.getElementById('cancelBuy');

      // 先移除之前的事件监听，防止重复触发
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;

      confirmBtn.onclick = () => {
        const orderData = {
          product_id: btn.dataset.id,
          user_id: user.id,
          address: document.getElementById('buyAddress').value,
          phone: document.getElementById('buyPhone').value,
          email: document.getElementById('buyEmail').value
        };

        console.log('Order submitted:', orderData);
        alert('Order submitted! (检查控制台数据)');

        // 清空输入框
        document.getElementById('buyAddress').value = '';
        document.getElementById('buyPhone').value = '';
        document.getElementById('buyEmail').value = '';

        buyModal.classList.remove('active');

        // TODO: 这里可以调用 submitOrder(orderData) 写入数据库
      };

      cancelBtn.onclick = () => {
        buyModal.classList.remove('active');
      };
    });
  });
}

// ----------------------------
// 获取用户信息（示例函数）
// ----------------------------
async function getUserInfo() {
  // 假设有 session 或者全局用户对象
  // 这里写死示例
  return {
    id: 1,
    username: 'Anna',
    platform_account: 'U9_001'
  };
}

// ----------------------------
// 初始化 Buy Modal
// ----------------------------
function initBuyModal() {
  const buyModal = document.getElementById('buyModal');
  buyModal.addEventListener('click', e => {
    if (e.target === buyModal) buyModal.classList.remove('active');
  });
}
