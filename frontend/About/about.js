document.addEventListener("DOMContentLoaded", () => {
  const robot = document.querySelector(".robot-cyber-gif");
  const caption = document.querySelector(".robot-cyber-caption");

  robot.addEventListener("click", () => {
    caption.textContent = "⚡ SYSTEM REBOOTING...";
    robot.style.filter = "drop-shadow(0 0 25px #ff00ff)";
    setTimeout(() => {
      caption.textContent = "U9 ONLINE... ⚙️🤖";
      robot.style.filter = "drop-shadow(0 0 10px #00fff7)";
    }, 1500);
  });
});
