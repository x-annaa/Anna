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
}, 5000);

// =======================
// 跑马灯动画
// =======================
const marqueeText = document.querySelector(".marquee-text");

function animateMarquee() {
  const wrapper = document.querySelector(".marquee-wrapper");
  const wrapperWidth = wrapper.offsetWidth;
  const textWidth = marqueeText.offsetWidth;
  let pos = -textWidth; // 初始位置：完全在左边外面
  const speed = 8; // 每帧移动像素

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
