// =======================
// 切换密码可见
// =======================
document.querySelectorAll(".toggle-password").forEach(btn => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    if (input.type === "password") { input.type = "text"; btn.textContent = "🙈"; }
    else { input.type = "password"; btn.textContent = "👁️"; }
  });
});

// =======================
// Tab 切换
// =======================
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const showLoginBtn = document.getElementById("showLogin");
const showRegisterBtn = document.getElementById("showRegister");

showLoginBtn.addEventListener("click", () => {
  loginForm.classList.remove("hidden"); registerForm.classList.add("hidden");
  showLoginBtn.classList.add("active"); showRegisterBtn.classList.remove("active");
});
showRegisterBtn.addEventListener("click", () => {
  loginForm.classList.add("hidden"); registerForm.classList.remove("hidden");
  showLoginBtn.classList.remove("active"); showRegisterBtn.classList.add("active");
});

// =======================
// 工具
// =======================
function generatePlatformAccount() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", numbers = "0123456789";
  return Array.from({length:2},()=>letters[Math.floor(Math.random()*letters.length)]).join('')
       + Array.from({length:4},()=>numbers[Math.floor(Math.random()*numbers.length)]).join('');
}
function generateUUID() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c/4).toString(16));
}

// =======================
// 注册
// =======================
document.getElementById("registerBtn").addEventListener("click", async () => {
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirmPassword").value;
  const agree = document.getElementById("agreeTerms").checked;
  const msgEl = document.getElementById("registerMsg"); msgEl.textContent = "";

  if (!username || !password) { msgEl.textContent="请输入用户名和密码"; return; }
  if (password!==confirm) { msgEl.textContent="两次密码不一致"; return; }
  if (!agree) { msgEl.textContent="请先勾选同意条款"; return; }

  const { data: exist } = await supabaseClient.from("users").select("id").eq("username", username).maybeSingle();
  if (exist) { msgEl.textContent="用户名已存在"; return; }

  // 哈希密码
  const salt = bcrypt.genSaltSync(10);
  const password_hash = bcrypt.hashSync(password, salt);

  const platformAccount = generatePlatformAccount();
  const uuid = generateUUID();

  const { data, error } = await supabaseClient.from("users")
    .insert({ username, password_hash, coins:0, balance:0, platform_account:platformAccount, id:uuid })
    .select().maybeSingle();

  if (error || !data) { msgEl.textContent="注册失败: "+(error?.message||""); return; }

  localStorage.setItem("currentUserId", data.id);
  localStorage.setItem("currentUser", data.username);
  localStorage.setItem("platformAccount", data.platform_account);
  localStorage.setItem("currentUserUUID", data.id);
  alert("注册成功！"); window.location.href="frontend/HOME.html";
});

// =======================
// 登录
// =======================
document.getElementById("loginBtn").addEventListener("click", async () => {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  const msgEl = document.getElementById("loginMsg"); msgEl.textContent = "";

  if (!username || !password) { msgEl.textContent="请输入用户名和密码"; return; }

  const { data, error } = await supabaseClient.from("users")
    .select("id, username, password_hash, platform_account").eq("username", username).maybeSingle();

  if (error) { msgEl.textContent="登录失败: "+error.message; return; }
  if (!data) { msgEl.textContent="用户不存在"; return; }

  if (!bcrypt.compareSync(password, data.password_hash)) { msgEl.textContent="密码错误"; return; }

  localStorage.setItem("currentUserId", data.id);
  localStorage.setItem("currentUser", data.username);
  localStorage.setItem("platformAccount", data.platform_account);
  localStorage.setItem("currentUserUUID", data.id);
  alert("登录成功！"); window.location.href="frontend/HOME.html";
});
