/* =========================================================
   LOGIN / REGISTER BUTTON STATE
========================================================= */

let loginProcessing = false;
let registerProcessing = false;


/* -----------------------------------------
   SET LOGIN BUTTON LOADING
----------------------------------------- */

function setLoginLoading() {

  const btn =
    document.getElementById("loginBtn");

  if (!btn) return;

  loginProcessing = true;

  btn.disabled = true;

  btn.style.background = "#f1f3f7";
  btn.style.color = "#9ca3af";
  btn.style.cursor = "not-allowed";

  btn.textContent = "Logging in...";

}


/* -----------------------------------------
   SET REGISTER BUTTON LOADING
----------------------------------------- */

function setRegisterLoading() {

  const btn =
    document.getElementById("registerBtn");

  if (!btn) return;

  registerProcessing = true;

  btn.disabled = true;

  btn.style.background = "#f1f3f7";
  btn.style.color = "#9ca3af";
  btn.style.cursor = "not-allowed";

  btn.textContent = "Registering...";

}


/* -----------------------------------------
   RESET LOGIN BUTTON
----------------------------------------- */

function resetLoginButton() {

  const btn =
    document.getElementById("loginBtn");

  if (!btn) return;

  loginProcessing = false;

  btn.disabled = false;

  btn.style.background = "";
  btn.style.color = "";
  btn.style.cursor = "";

  btn.textContent = "Login";

}


/* -----------------------------------------
   RESET REGISTER BUTTON
----------------------------------------- */

function resetRegisterButton() {

  const btn =
    document.getElementById("registerBtn");

  if (!btn) return;

  registerProcessing = false;

  btn.disabled = false;

  btn.style.background = "";
  btn.style.color = "";
  btn.style.cursor = "";

  btn.textContent = "Register";

}


/* =========================================================
   PASSWORD SHOW / HIDE
========================================================= */

document.querySelectorAll(".toggle-password").forEach(btn => {

  btn.addEventListener("click", () => {

    const targetId =
      btn.getAttribute("data-target");

    const input =
      document.getElementById(targetId);

    if (!input) return;

    const eyeIcon =
      btn.querySelector(".eye-icon");


    if (input.type === "password") {

      input.type = "text";

      btn.setAttribute(
        "aria-label",
        "Hide password"
      );


      /*
       * Password visible
       * Change eye to crossed-eye style
       */
      if (eyeIcon) {

        eyeIcon.innerHTML = `
          <path
            d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"
          ></path>

          <circle
            cx="12"
            cy="12"
            r="3"
          ></circle>

          <path
            d="M4 4l16 16"
          ></path>
        `;

      }

    } else {

      input.type = "password";

      btn.setAttribute(
        "aria-label",
        "Show password"
      );


      /*
       * Password hidden
       * Normal eye
       */
      if (eyeIcon) {

        eyeIcon.innerHTML = `
          <path
            d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"
          ></path>

          <circle
            cx="12"
            cy="12"
            r="3"
          ></circle>
        `;

      }

    }

  });

});


/* =========================================================
   LOGIN / REGISTER TAB
========================================================= */

const loginForm =
  document.getElementById("loginForm");

const registerForm =
  document.getElementById("registerForm");

const showLoginBtn =
  document.getElementById("showLogin");

const showRegisterBtn =
  document.getElementById("showRegister");


/* -----------------------------------------
   SHOW LOGIN
----------------------------------------- */

showLoginBtn.addEventListener("click", () => {

  loginForm.classList.remove("hidden");

  registerForm.classList.add("hidden");

  showLoginBtn.classList.add("active");

  showRegisterBtn.classList.remove("active");

});


/* -----------------------------------------
   SHOW REGISTER
----------------------------------------- */

showRegisterBtn.addEventListener("click", () => {

  loginForm.classList.add("hidden");

  registerForm.classList.remove("hidden");

  showLoginBtn.classList.remove("active");

  showRegisterBtn.classList.add("active");

});


/* =========================================================
   GENERATE PLATFORM ACCOUNT
========================================================= */

function generatePlatformAccount() {

  const letters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const digits =
    "0123456789";

  const allChars =
    letters + digits;

  let result = "";


  /*
   * First character must be a letter
   */
  const firstIndex =
    Math.floor(
      Math.random() * letters.length
    );

  result += letters[firstIndex];


  const remaining = [];


  /*
   * One of the next 5 positions
   * must contain a number
   */
  const digitPosition =
    Math.floor(
      Math.random() * 5
    );


  for (let i = 0; i < 5; i++) {

    if (i === digitPosition) {

      const digitIndex =
        Math.floor(
          Math.random() * digits.length
        );

      remaining.push(
        digits[digitIndex]
      );

    } else {

      const charIndex =
        Math.floor(
          Math.random() * allChars.length
        );

      remaining.push(
        allChars[charIndex]
      );

    }

  }


  result += remaining.join("");

  return result;

}


/* =========================================================
   GENERATE UUID
========================================================= */

function generateUUID() {

  return (
    [1e7] +
    -1e3 +
    -4e3 +
    -8e3 +
    -1e11
  ).replace(
    /[018]/g,
    c =>
      (
        c ^
        crypto.getRandomValues(
          new Uint8Array(1)
        )[0] &
        15 >>
        c / 4
      ).toString(16)
  );

}


/* =========================================================
   REGISTER
========================================================= */

document
  .getElementById("registerBtn")
  .addEventListener("click", async () => {


    /* -----------------------------------------
       PREVENT DOUBLE CLICK
    ----------------------------------------- */

    if (registerProcessing) {

      return;

    }


    /* -----------------------------------------
       START REGISTER LOADING
    ----------------------------------------- */

    setRegisterLoading();


    const username =
      document
        .getElementById("regUsername")
        .value
        .trim();

    const password =
      document
        .getElementById("regPassword")
        .value;

    const confirm =
      document
        .getElementById("regConfirmPassword")
        .value;


    /* -----------------------------------------
       CHECK USERNAME / PASSWORD
    ----------------------------------------- */

    if (!username || !password) {

      alert(
        "Please enter your username and password"
      );

      return;

    }


    /* -----------------------------------------
       PASSWORD LENGTH
    ----------------------------------------- */

    if (!/^[A-Za-z0-9]{6,}$/.test(password)) {

      alert(
        "Password must be at least 6 characters long"
      );

      return;

    }


    /* -----------------------------------------
       CONFIRM PASSWORD
    ----------------------------------------- */

    if (password !== confirm) {

      alert(
        "The passwords entered twice do not match"
      );

      return;

    }


    /* -----------------------------------------
       CHECK USERNAME
    ----------------------------------------- */

    const {
      data: exist,
      error: checkError
    } =
      await supabaseClient
        .from("users")
        .select("id")
        .eq("username", username)
        .maybeSingle();


    /* -----------------------------------------
       CHECK USERNAME ERROR
    ----------------------------------------- */

    if (checkError) {

      alert(
        "Failed to check username: " +
        checkError.message
      );

      return;

    }


    /* -----------------------------------------
       USERNAME ALREADY EXISTS
    ----------------------------------------- */

    if (exist) {

      alert(
        "This username already exists"
      );

      return;

    }


    /* -----------------------------------------
       GET REGISTER IP
    ----------------------------------------- */

    let registerIp = null;


    try {

      const res =
        await fetch(
          "https://api.ipify.org?format=json"
        );

      const json =
        await res.json();

      registerIp = json.ip;

    } catch (e) {

      console.warn(
        "Unable to get registration IP:",
        e
      );

    }


    /* -----------------------------------------
       GENERATE ACCOUNT DATA
    ----------------------------------------- */

    const platformAccount =
      generatePlatformAccount();

    const uuid =
      generateUUID();

    const sessionToken =
      generateUUID();


    /* -----------------------------------------
       INSERT USER
    ----------------------------------------- */

    const {
      data,
      error
    } =
      await supabaseClient
        .from("users")
        .insert({

          username:
            username,

          password:
            password,

          coins:
            0,

          balance:
            0,

          platform_account:
            platformAccount,

          uuid:
            uuid,

          session_token:
            sessionToken,

          register_ip:
            registerIp

        })
        .select()
        .single();


    /* -----------------------------------------
       INSERT ERROR
    ----------------------------------------- */

    if (error) {

      alert(
        "Registration failed: " +
        error.message
      );

      return;

    }


    /* -----------------------------------------
       SAVE LOCAL STORAGE
    ----------------------------------------- */

    localStorage.setItem(
      "currentUserId",
      data.id
    );

    localStorage.setItem(
      "currentUser",
      data.username
    );

    localStorage.setItem(
      "platformAccount",
      platformAccount
    );

    localStorage.setItem(
      "currentUserUUID",
      data.uuid
    );

    localStorage.setItem(
      "sessionToken",
      sessionToken
    );


    /* -----------------------------------------
       SUCCESS
    ----------------------------------------- */

    alert(
      "Registration successful!"
    );


    window.location.href =
      "frontend/HOME.html";

  });


/* =========================================================
   LOGIN
========================================================= */

document
  .getElementById("loginBtn")
  .addEventListener("click", async () => {


    /* -----------------------------------------
       PREVENT DOUBLE CLICK
    ----------------------------------------- */

    if (loginProcessing) {

      return;

    }


    /* -----------------------------------------
       START LOGIN LOADING
    ----------------------------------------- */

    setLoginLoading();


    const username =
      document
        .getElementById("loginUsername")
        .value
        .trim();

    const password =
      document
        .getElementById("loginPassword")
        .value;


    /* -----------------------------------------
       CHECK INPUT
    ----------------------------------------- */

    if (!username || !password) {

      alert(
        "Please enter your username and password"
      );

      return;

    }


    /* -----------------------------------------
       GET USER
    ----------------------------------------- */

    const {
      data,
      error
    } =
      await supabaseClient
        .from("users")
        .select(
          "id, username, password, platform_account, uuid"
        )
        .eq("username", username)
        .maybeSingle();


    /* -----------------------------------------
       SUPABASE ERROR
    ----------------------------------------- */

    if (error) {

      alert(
        "Login failed: " +
        error.message
      );

      return;

    }


    /* -----------------------------------------
       USER NOT FOUND
    ----------------------------------------- */

    if (!data) {

      alert(
        "User does not exist"
      );

      return;

    }


    /* -----------------------------------------
       PASSWORD CHECK
    ----------------------------------------- */

    if (data.password !== password) {

      alert(
        "Wrong password"
      );

      return;

    }


    /* -----------------------------------------
       NEW SESSION TOKEN
    ----------------------------------------- */

    const sessionToken =
      generateUUID();


    /* -----------------------------------------
       UPDATE SESSION
    ----------------------------------------- */

    const {
      error: updateErr
    } =
      await supabaseClient
        .from("users")
        .update({

          session_token:
            sessionToken

        })
        .eq("id", data.id);


    /* -----------------------------------------
       UPDATE SESSION ERROR
    ----------------------------------------- */

    if (updateErr) {

      alert(
        "Update session failed: " +
        updateErr.message
      );

      return;

    }


    /* -----------------------------------------
       SAVE LOGIN DATA
    ----------------------------------------- */

    localStorage.setItem(
      "currentUserId",
      data.id
    );

    localStorage.setItem(
      "currentUser",
      data.username
    );

    localStorage.setItem(
      "platformAccount",
      data.platform_account
    );

    localStorage.setItem(
      "currentUserUUID",
      data.uuid
    );

    localStorage.setItem(
      "sessionToken",
      sessionToken
    );


    /* -----------------------------------------
       SUCCESS
    ----------------------------------------- */

    alert(
      "Login successful!"
    );


    window.location.href =
      "frontend/HOME.html";

  });


/* =========================================================
   CUSTOM ALERT
========================================================= */

window.alert = function(message) {

  const overlay =
    document.getElementById(
      "customAlert"
    );

  const text =
    document.getElementById(
      "alertText"
    );

  const ok =
    document.getElementById(
      "alertOk"
    );


  if (!overlay || !text || !ok) {

    console.log(message);

    return;

  }


  text.textContent =
    message;

  overlay.style.display =
    "flex";


  /* -----------------------------------------
     OK BUTTON
  ----------------------------------------- */

  ok.onclick = () => {

    overlay.style.display =
      "none";


    /* -----------------------------------------
       RESTORE LOGIN BUTTON
    ----------------------------------------- */

    if (loginProcessing) {

      resetLoginButton();

    }


    /* -----------------------------------------
       RESTORE REGISTER BUTTON
    ----------------------------------------- */

    if (registerProcessing) {

      resetRegisterButton();

    }

  };

};


/* =========================================================
   TELEGRAM POPUP
========================================================= */

const telegramPopup =
  document.getElementById(
    "telegramPopup"
  );

const openTelegramBtn =
  document.getElementById(
    "openTelegramPopup"
  );

const closePopupBtn =
  document.getElementById(
    "closePopupBtn"
  );

const copyTelegramBtn =
  document.getElementById(
    "copyTelegramBtn"
  );


/* -----------------------------------------
   OPEN TELEGRAM POPUP
----------------------------------------- */

if (openTelegramBtn && telegramPopup) {

  openTelegramBtn.addEventListener(
    "click",
    () => {

      telegramPopup.style.display =
        "flex";

    }
  );

}


/* -----------------------------------------
   CLOSE TELEGRAM POPUP
----------------------------------------- */

if (closePopupBtn && telegramPopup) {

  closePopupBtn.addEventListener(
    "click",
    () => {

      telegramPopup.style.display =
        "none";

    }
  );

}


/* -----------------------------------------
   COPY TELEGRAM
----------------------------------------- */

if (copyTelegramBtn) {

  copyTelegramBtn.addEventListener(
    "click",
    async () => {

      const accountElement =
        document.querySelector(
          ".telegram-account"
        );


      if (!accountElement) return;


      const username =
        accountElement.textContent.trim();


      try {

        await navigator.clipboard.writeText(
          username
        );

        alert(
          "Copied to clipboard!"
        );

      } catch (err) {

        alert(
          "Failed to copy: " +
          err.message
        );

      }

    }
  );

}


/* =========================================================
   TELEGRAM QR CODE
========================================================= */

const telegramQR =
  document.querySelector(
    ".telegram-qr"
  );

const telegramQRLoading =
  document.querySelector(
    ".qr-loading"
  );


if (telegramQR && telegramQRLoading) {


  /* -----------------------------------------
     QR IMAGE LOADED SUCCESSFULLY
  ----------------------------------------- */

  telegramQR.addEventListener(
    "load",
    () => {

      telegramQRLoading.style.display =
        "none";

      telegramQR.style.display =
        "block";

    }
  );


  /* -----------------------------------------
     QR IMAGE FAILED
     Keep showing Loading...
  ----------------------------------------- */

  telegramQR.addEventListener(
    "error",
    () => {

      telegramQR.style.display =
        "none";

      telegramQRLoading.style.display =
        "flex";

    }
  );

}
