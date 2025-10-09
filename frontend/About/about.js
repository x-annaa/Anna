document.addEventListener("DOMContentLoaded", () => {
  const page = document.getElementById("msgPage");

  // 页面切换到关于我们时触发动画
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          page.classList.add("fade-in");
        }
      });
    },
    { threshold: 0.2 }
  );

  observer.observe(page);
});
