document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll(".about-section");
  const robot = document.querySelector(".robot-gif");
  const robotText = document.querySelector(".about-robot p");

  // 滚动触发元素渐显
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.style.opacity = 1;
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.3 });

  sections.forEach(section => observer.observe(section));

  // 机器人点击彩蛋
  robot.addEventListener("click", () => {
    robotText.textContent = "彩蛋触发 🎉🌱";
    robot.style.filter = "drop-shadow(0 0 15px #2e7d32)";
    setTimeout(() => {
      robotText.textContent = "嗨～我是 U9 小助手 🤖💚 点击我会有彩蛋哦";
      robot.style.filter = "drop-shadow(0 0 5px #2e7d32)";
    }, 1800);
  });
});
