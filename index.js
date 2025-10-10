// index.js - complete, keep original logic, no alerts, no Chinese

document.addEventListener("DOMContentLoaded", () => {
  // elements
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const showLoginBtn = document.getElementById("showLogin");
  const showRegisterBtn = document.getElementById("showRegister");
  const loginMsg = document.getElementById("loginMsg");
  const registerMsg = document.getElementById("registerMsg");

  // safe guards
  function setFormMessage(target, message = "", type = "error") {
    // target: "login" or "register"
    const el = target === "login" ? loginMsg : registerMsg;
    if (!el) return;
    el.textContent = message;
    el.style.color = type === "success" ? "#16a34a" : "#dc2626";
    el.style.visibility = message ? "visible" : "hidden";
  }

  // toggle password buttons
  document.querySelectorAll(".toggle-password").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;

      if (input.type === "password") {
        input.type = "text";
        btn.textContent = "🙈";
      } else {
        input.type = "password";
        btn.textContent = "👁️";
      }
    });
  });

  // tab switching
  showLoginBtn.addEventListener("click", () => {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    showLoginBtn.classList.add("active");
    showRegisterBtn.classList.remove("active");
    setFormMessage("login", "");
    setFormMessage("register", "");
  });

  showRegisterBtn.addEventListener("click", () => {
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
    showLoginBtn.classList.remove("active");
    showRegisterBtn.classList.add("active");
    setFormMessage("login", "");
    setFormMessage("register", "");
  });

  // generate mixed platform account (6 chars: A-Z0-9)
  function generatePlatformAccount() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      const index = Math.floor(Math.random() * chars.length);
      result += chars[index];
    }
    return result;
  }

  // UUID v4-ish generator using crypto
  function generateUUID() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  }

  // Register handler
  const registerBtn = document.getElementById("registerBtn");
  if (registerBtn) {
    registerBtn.addEventListener("click", async () => {
      setFormMessage("register", "");
      const username = (document.getElementById("regUsername") || {}).value?.trim() || "";
      const password = (document.getElementById("regPassword") || {}).value || "";
      const confirm = (document.getElementById("regConfirmPassword") || {}).value || "";
      const agree = (document.getElementById("agreeTerms") || {}).checked || false;

      if (!username || !password) {
        setFormMessage("register", "Please enter your username and password", "error");
        return;
      }
      if (password !== confirm) {
        setFormMessage("register", "The passwords entered twice do not match", "error");
        return;
      }
      if (!agree) {
        setFormMessage("register", "Please tick the box to agree to the terms", "error");
        return;
      }

      try {
        // check existing username
        const { data: exist, error: existErr } = await supabaseClient
          .from("users")
          .select("id")
          .eq("username", username)
          .maybeSingle();

        if (existErr) {
          setFormMessage("register", "Registration failed: " + existErr.message, "error");
          return;
        }
        if (exist) {
          setFormMessage("register", "This username already exists", "error");
          return;
        }

        const platformAccount = generatePlatformAccount();
        const uuid = generateUUID();
        const sessionToken = generateUUID();

        // insert user
        const { data, error } = await supabaseClient
          .from("users")
          .insert({
            username,
            password, // consider hashing on server
            coins: 0,
            balance: 0,
            platform_account: platformAccount,
            uuid,
            session_token: sessionToken
          })
          .select("id, username, platform_account, uuid")
          .single();

        if (error) {
          setFormMessage("register", "Registration failed: " + error.message, "error");
          return;
        }

        // store to localStorage
        localStorage.setItem("currentUserId", data.id);
        localStorage.setItem("currentUser", data.username);
        localStorage.setItem("platformAccount", data.platform_account || platformAccount);
        localStorage.setItem("currentUserUUID", data.uuid || uuid);
        localStorage.setItem("sessionToken", sessionToken);

        setFormMessage("register", "Registration successful! Redirecting...", "success");

        setTimeout(() => {
          window.location.href = "frontend/HOME.html";
        }, 1000);
      } catch (err) {
        setFormMessage("register", "Registration error: " + (err.message || err), "error");
      }
    });
  }

  // Login handler
  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      setFormMessage("login", "");
      const username = (document.getElementById("loginUsername") || {}).value?.trim() || "";
      const password = (document.getElementById("loginPassword") || {}).value || "";

      if (!username || !password) {
        setFormMessage("login", "Please enter your username and password", "error");
        return;
      }

      try {
        const { data, error } = await supabaseClient
          .from("users")
          .select("id, username, password, platform_account, uuid")
          .eq("username", username)
          .maybeSingle();

        if (error) {
          setFormMessage("login", "Login failed: " + error.message, "error");
          return;
        }
        if (!data) {
          setFormMessage("login", "User does not exist", "error");
          return;
        }
        if (data.password !== password) {
          setFormMessage("login", "Wrong password", "error");
          return;
        }

        const sessionToken = generateUUID();
        const { error: updateErr } = await supabaseClient
          .from("users")
          .update({ session_token: sessionToken })
          .eq("id", data.id);

        if (updateErr) {
          setFormMessage("login", "Update session failed: " + updateErr.message, "error");
          return;
        }

        localStorage.setItem("currentUserId", data.id);
        localStorage.setItem("currentUser", data.username);
        localStorage.setItem("platformAccount", data.platform_account);
        localStorage.setItem("currentUserUUID", data.uuid);
        localStorage.setItem("sessionToken", sessionToken);

        setFormMessage("login", "Login successful! Redirecting...", "success");

        setTimeout(() => {
          window.location.href = "frontend/HOME.html";
        }, 800);
      } catch (err) {
        setFormMessage("login", "Login error: " + (err.message || err), "error");
      }
    });
  }

  // initialize message visibility
  setFormMessage("login", "");
  setFormMessage("register", "");
});
