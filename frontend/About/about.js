document.addEventListener("DOMContentLoaded", () => {
  const robot = document.querySelector(".robot-gif");
  const robotTexts = document.querySelectorAll(".robot-text p");
  const floatingItems = document.querySelectorAll(".floating-item");
  const hiddenCards = {
    hiddenCard1: document.getElementById("hiddenCard1"),
    hiddenCard2: document.getElementById("hiddenCard2")
  };

  // 卡片滚动进入视野渐显
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('show');
      }
    });
  }, { threshold: 0.3 });

  floatingItems.forEach(item => observer.observe(item));

  // 机器人点击彩蛋
  robot.addEventListener("click", () => {
    robotTexts[1].textContent = "彩蛋触发中... 🌱";
    robot.style.filter = "drop-shadow(0 0 15px #2e7d32)";
    setTimeout(() => {
      robotTexts[1].textContent = "点击我发现更多彩蛋 🌱✨";
      robot.style.filter = "drop-shadow(0 0 5px #2e7d32)";
      // 随机显示隐藏卡片
      const card = Math.random() > 0.5 ? hiddenCards.hiddenCard1 : hiddenCards.hiddenCard2;
      card.style.display = "block";
      setTimeout(() => card.style.display = "none", 1800);
    }, 1500);
  });

  // 鼠标移动卡片轻微跟随
  document.addEventListener("mousemove", (e) => {
    floatingItems.forEach(item => {
      const rect = item.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / 25;
      const y = (e.clientY - rect.top - rect.height / 2) / 25;
      item.style.transform = `translate(${x}px, ${y}px)`;
    });
  });
});
