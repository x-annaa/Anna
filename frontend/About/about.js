document.addEventListener("DOMContentLoaded", () => {
  const robot = document.querySelector(".robot-gif");
  const robotTexts = document.querySelectorAll(".robot-text p");

  robot.addEventListener("click", () => {
    robotTexts[1].textContent = "彩蛋已触发 🍃✨";
    robot.style.filter = "drop-shadow(0 0 15px #2e7d32)";
    setTimeout(() => {
      robotTexts[1].textContent = "点击我，发现隐藏彩蛋 🌱✨";
      robot.style.filter = "drop-shadow(0 0 5px #2e7d32)";
    }, 1500);
  });
});
