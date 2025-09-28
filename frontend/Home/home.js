// =======================
// HOME 页面登录状态检查
// =======================
async function checkSession() {
  const userId = localStorage.getItem("currentUserId");
  const sessionToken = localStorage.getItem("sessionToken");

  if (!userId || !sessionToken) {
    alert("请先登录");
    window.location.href = "../index.html";
    return;
  }

  const { data, error } = await supabaseClient
    .from("users")
    .select("session_token")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    alert("验证失败，请重新登录");
    window.location.href = "../index.html";
    return;
  }

  if (data.session_token !== sessionToken) {
    alert("您的账号已在别处登录");
    localStorage.clear();
    window.location.href = "../index.html";
  }
}

// 页面一加载就检查
checkSession();

// =======================
// 登出按钮
// =======================
window.logout = async function () {
  const userId = localStorage.getItem("currentUserId");

  if (userId) {
    await supabaseClient
      .from("users")
      .update({ session_token: null })
      .eq("id", userId);
  }

  localStorage.clear();
  window.location.href = "../index.html";
};

// =======================
// 广告轮播
// =======================
const adUrls = [
  "https://airkbwolmkidaokqhxjj.supabase.co/storage/v1/object/public/Photos/w1.jpg",
  "https://airkbwolmkidaokqhxjj.supabase.co/storage/v1/object/public/Photos/w2.png",
  "https://airkbwolmkidaokqhxjj.supabase.co/storage/v1/object/public/Photos/w3.jpg"
];

let currentAdIndex = 0;
const adImage = document.getElementById("adImage");

function showAd(index) {
  if (adImage) {
    adImage.style.opacity = 0; // 先淡出
    setTimeout(() => {
      adImage.src = adUrls[index];
      adImage.style.opacity = 1; // 再淡入
    }, 300);
  }
}

// 初始化显示第一张
showAd(currentAdIndex);

// 每 5 秒切换
setInterval(() => {
  currentAdIndex = (currentAdIndex + 1) % adUrls.length;
  showAd(currentAdIndex);
}, 15000);

// =======================
// 跑马灯动画
// =======================
const marqueeText = document.querySelector(".marquee-text");

function animateMarquee() {
  const wrapper = document.querySelector(".marquee-wrapper");
  const wrapperWidth = wrapper.offsetWidth;
  const textWidth = marqueeText.offsetWidth;
  let pos = -textWidth; // 初始位置：完全在左边外面
  const speed = 1; // 每帧移动像素

  function step() {
    pos += speed; // 文字向右移动
    if (pos > wrapperWidth) {
      pos = -textWidth; // 移动到左侧重新开始
    }
    marqueeText.style.transform = `translateX(${pos}px)`;
    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

// 等 DOM 加载完再启动动画
window.addEventListener("load", animateMarquee);


// ===== 分类广告切换 =====
const categoryBtns = document.querySelectorAll(".category-btn");
const adItems = document.querySelectorAll(".ad-item");

// 示例广告 URL 数据
const adsData = {
  phone: [
    "https://airkbwolmkidaokqhxjj.supabase.co/storage/v1/object/public/Home%20Photos/p1.avif",
    "https://airkbwolmkidaokqhxjj.supabase.co/storage/v1/object/public/Home%20Photos/p1.jpg",
    "https://airkbwolmkidaokqhxjj.supabase.co/storage/v1/object/public/Home%20Photos/p2.webp",
    "https://airkbwolmkidaokqhxjj.supabase.co/storage/v1/object/public/Home%20Photos/c1.avif"
  ],
  clothes: [
    "https://via.placeholder.com/200x200?text=衣服1",
    "https://via.placeholder.com/200x200?text=衣服2",
    "https://via.placeholder.com/200x200?text=衣服3",
    "https://via.placeholder.com/200x200?text=衣服4"
  ],
  car: [
    "https://via.placeholder.com/200x200?text=汽车1",
    "https://via.placeholder.com/200x200?text=汽车2",
    "https://via.placeholder.com/200x200?text=汽车3",
    "https://via.placeholder.com/200x200?text=汽车4"
  ],
  cosmetics: [
    "https://via.placeholder.com/200x200?text=化妆品1",
    "https://via.placeholder.com/200x200?text=化妆品2",
    "https://via.placeholder.com/200x200?text=化妆品3",
    "https://via.placeholder.com/200x200?text=化妆品4"
  ],
  diamond: [
    "https://via.placeholder.com/200x200?text=钻石1",
    "https://via.placeholder.com/200x200?text=钻石2",
    "https://via.placeholder.com/200x200?text=钻石3",
    "https://via.placeholder.com/200x200?text=钻石4"
  ]
};

// 初始显示 phone 分类
updateAds("phone");

// 点击按钮切换
categoryBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    // 更新按钮样式
    categoryBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // 切换广告
    const category = btn.dataset.category;
    updateAds(category);
  });
});

function updateAds(category) {
  // 遍历所有 ad-item
  let idx = 0;
  adItems.forEach(item => {
    if (item.dataset.category === category) {
      item.classList.remove("hidden");
      item.innerHTML = `<img src="${adsData[category][idx]}" alt="${category}">`;
      idx++;
    } else {
      item.classList.add("hidden");
      item.innerHTML = "";
    }
  });
}
