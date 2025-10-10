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

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const showLoginBtn = document.getElementById("showLogin");
const showRegisterBtn = document.getElementById("showRegister");

showLoginBtn.addEventListener("click", () => {
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
  showLoginBtn.classList.add("active");
  showRegisterBtn.classList.remove("active");
});

showRegisterBtn.addEventListener("click", () => {
  loginForm.classList.add("hidden");
  registerForm.classList.remove("hidden");
  showLoginBtn.classList.remove("active");
  showRegisterBtn.classList.add("active");
});

function generatePlatformAccount() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    const index = Math.floor(Math.random() * chars.length);
    result += chars[index];
  }
  return result;
}

function generateUUID() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

document.getElementById("registerBtn").addEventListener("click", async () => {
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirmPassword").value;
  const agree = document.getElementById("agreeTerms").checked;

  if (!username || !password) {
    alert("Please enter your username and password");
    return;
  }
  if (password !== confirm) {
    alert("The passwords entered twice do not match");
    return;
  }
  if (!agree) {
    alert("Please tick the box to agree to the terms");
    return;
  }

  const { data: exist } = await supabaseClient
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (exist) {
    alert("This username already exists");
    return;
  }

  const platformAccount = generatePlatformAccount();
  const uuid = generateUUID();
  const sessionToken = generateUUID();

  const { data, error } = await supabaseClient
    .from("users")
    .insert({
      username,
      password,
      coins: 0,
      balance: 0,
      platform_account: platformAccount,
      uuid,
      session_token: sessionToken
    })
    .select()
    .single();

  if (error) {
    alert("Registration failed: " + error.message);
    return;
  }

  localStorage.setItem("currentUserId", data.id);
  localStorage.setItem("currentUser", data.username);
  localStorage.setItem("platformAccount", platformAccount);
  localStorage.setItem("currentUserUUID", data.uuid);
  localStorage.setItem("sessionToken", sessionToken);

  alert("Registration successful!");
  window.location.href = "frontend/HOME.html";
});

document.getElementById("loginBtn").addEventListener("click", async () => {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!username || !password) {
    alert("Please enter your username and password");
    return;
  }

  const { data, error } = await supabaseClient
    .from("users")
    .select("id, username, password, platform_account, uuid")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    alert("Login failed: " + error.message);
    return;
  }
  if (!data) {
    alert("User does not exist");
    return;
  }
  if (data.password !== password) {
    alert("Wrong password");
    return;
  }

  const sessionToken = generateUUID();
  const { error: updateErr } = await supabaseClient
    .from("users")
    .update({ session_token: sessionToken })
    .eq("id", data.id);

  if (updateErr) {
    alert("Update session failed: " + updateErr.message);
    return;
  }

  localStorage.setItem("currentUserId", data.id);
  localStorage.setItem("currentUser", data.username);
  localStorage.setItem("platformAccount", data.platform_account);
  localStorage.setItem("currentUserUUID", data.uuid);
  localStorage.setItem("sessionToken", sessionToken);

  alert("Login successful!");
  window.location.href = "frontend/HOME.html";
});
