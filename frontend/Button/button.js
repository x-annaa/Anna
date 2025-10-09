document.addEventListener("DOMContentLoaded", () => {
  const robot = document.querySelector(".robot-gif");

  // 点击机器人让它“摇头”一下
  robot.addEventListener("click", () => {
    robot.style.animation = "shake 0.5s ease";
    setTimeout(() => {
      robot.style.animation = "floatRobot 3s ease-in-out infinite";
    }, 500);
  });
});

const style = document.createElement("style");
style.textContent = `
@keyframes shake {
  0% { transform: rotate(0deg); }
  25% { transform: rotate(10deg); }
  50% { transform: rotate(-10deg); }
  75% { transform: rotate(8deg); }
  100% { transform: rotate(0deg); }
}`;
document.head.appendChild(style);
