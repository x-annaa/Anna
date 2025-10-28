// 直接从 products2 表获取数据
const { data: products2, error } = await supabase
  .from('products2')
  .select('*'); // 或者选择你需要的字段

if (error) {
  console.error(error);
  return;
}

// 渲染
const container = document.getElementById('shopProducts');
container.innerHTML = '';

products2.forEach(item => {
  const card = document.createElement('div');
  card.className = 'product-card';

  card.innerHTML = `
    <div class="image-slider">
      <img src="${item.image1_url}" data-images='["${item.image1_url}","${item.image2_url}","${item.image3_url}"]'>
    </div>
    <div class="product-info">
      <h4>${item.product_code}</h4>
      <p>${item.description || ''}</p>
      <p>Price: $${item.price || 0}</p>
      <p>Discount: ${item.discount}%</p>
      <p>Rating: ${'⭐'.repeat(Math.round(item.rating))}</p>
      <button class="buy-btn" data-id="${item.id}">Buy</button>
    </div>
  `;
  container.appendChild(card);
});
