window.alert = function(message) {
  let overlay = document.getElementById("customAlert");
  if (!overlay) {

    overlay = document.createElement("div");
    overlay.id = "customAlert";
    overlay.className = "alert-overlay";
    overlay.innerHTML = `
      <div class="alert-box">
        <p id="alertText"></p>
        <button id="alertOk">OK</button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  const text = document.getElementById("alertText");
  const ok = document.getElementById("alertOk");

  text.textContent = message;
  overlay.style.display = "flex";

  ok.onclick = () => {
    overlay.style.display = "none";
  };
};
