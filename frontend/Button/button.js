const buttons = document.querySelectorAll(".bottom-nav button");
const pages = document.querySelectorAll(".page");

buttons.forEach(btn => {
  btn.addEventListener("click", () => {
 
    buttons.forEach(b => b.classList.remove("active"));

    btn.classList.add("active");

    const pageId = btn.dataset.page;
 
    pages.forEach(p => p.classList.remove("active"));
  
    document.getElementById(pageId).classList.add("active");
  });
});
