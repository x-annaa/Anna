// 初始化 Shop 页面
async function loadShopProducts() {
  // 获取 products 和 product_details
  const { data: products, error } = await supabase
    .from('products')
    .select(`id, name, price, description, product_details(*)`);

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
        <p>${details.description || ''}</p>
        <p>Price: $${product.price}</p>
        <p>Discount: ${details.discount * 100}%</p>
        <p>Rating: ${'⭐'.repeat(details.rating)}</p>
        <button class="buy-btn" data-id="${product.id}">Buy</button>
      </div>
    `;
    container.appendChild(card);
  });

  initImageSlider();
  initBuyButtons();
}

// 图片轮播（点击切换）
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

// Buy 弹窗逻辑
function initBuyButtons() {
  const buyModal = document.getElementById('buyModal');
  const confirmBtn = document.getElementById('confirmBuy');
  const cancelBtn = document.getElementById('cancelBuy');

  document.querySelectorAll('.buy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const user = await getUserInfo(); // 你自己写的获取用户信息函数
      document.getElementById('buyUsername').textContent = user.username;
      document.getElementById('buyPlatform').textContent = user.platform_account;
      buyModal.classList.add('active');

      confirmBtn.onclick = async () => {
        const address = document.getElementById('buyAddress').value;
        const phone = document.getElementById('buyPhone').value;
        const email = document.getElementById('buyEmail').value;

        await submitOrder(btn.dataset.id, user.id, address, phone, email);
        alert('Order submitted!');
        buyModal.classList.remove('active');
      };
    });
  });

  cancelBtn.addEventListener('click', () => {
    buyModal.classList.remove('active');
  });
}

// 页面加载时调用
document.addEventListener('DOMContentLoaded', loadShopProducts);
