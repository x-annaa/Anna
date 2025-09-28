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
