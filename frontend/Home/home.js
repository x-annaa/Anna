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

// ========== HOME 页面广告轮播 ==========

// 轮播广告图片 URL
const adImages = [
  "https://via.placeholder.com/400x200/FFB6C1/000000?text=广告1",
  "https://via.placeholder.com/400x200/87CEFA/000000?text=广告2",
  "https://via.placeholder.com/400x200/90EE90/000000?text=广告3"
];

let currentAdIndex = 0;
const adImageElement = document.getElementById("adImage");

// 初始显示第一张
adImageElement.src = adImages[currentAdIndex];

// 每5秒切换一张广告
setInterval(() => {
  currentAdIndex = (currentAdIndex + 1) % adImages.length;
  adImageElement.src = adImages[currentAdIndex];
}, 5000);

// ========== 跑马灯广告文字 ==========
const marqueeText = "欢迎来到我的平台，恭喜发出🎉！";
const marqueeSpan = document.getElementById("marqueeContent");

// 无限循环：空白 + 文字 + 空白
function startMarquee() {
  const blankSpace = "     "; // 空格长度，可调节
  marqueeSpan.textContent = blankSpace + marqueeText + blankSpace;
}

startMarquee();
