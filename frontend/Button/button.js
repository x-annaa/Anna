document.addEventListener("DOMContentLoaded", () => {

  const pages =
    document.querySelectorAll(".page");

  const navButtons =
    document.querySelectorAll("#Menu-button .nav-button");


  function showPage(pageId) {

    // Hide all pages
    pages.forEach(page => {
      page.classList.remove("active");
    });


    // Show target page
    const target =
      document.getElementById(pageId);

    if (target) {
      target.classList.add("active");
    }


    // Update active navigation button
    navButtons.forEach(button => {

      button.classList.remove("active");

      if (button.dataset.page === pageId) {
        button.classList.add("active");
      }

    });

  }


  // Navigation click
  navButtons.forEach(button => {

    button.addEventListener("click", () => {

      const pageId =
        button.dataset.page;

      if (!pageId) return;

      showPage(pageId);

    });

  });


  // Make sure Home is active on startup
  showPage("homePage");

});
