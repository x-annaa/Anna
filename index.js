const supabaseClient = window.supabaseClient;

// Tab 切换
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
document.getElementById("showLogin").addEventListener("click", () => {
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
});
document.getElementById("showRegister").addEventListener("click", () => {
  loginForm.classList.add("hidden");
  registerForm.classList.remove("hidden");
});

// 注册逻辑
document.getElementById("registerBtn").addEventListener("click", async () => {
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirmPassword").value;
  const agree = document.getElementById("agreeTerms").checked;

  if (!username || !password) return alert("请输入用户名和密码");
  if (password !== confirm) return alert("密码不一致");
  if (!agree) return alert("请勾选同意条款");

  const { data, error } = await supabaseClient.auth.signUp({
    email: username + "@example.com",
    password
  });

  if (error) return alert("注册失败: " + error.message);

  localStorage.setItem("currentUser", username);
  alert("注册成功！");
  window.location.href = "HOME.html";
});

// 登录逻辑
document.getElementById("loginBtn").addEventListener("click", async () => {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!username || !password) return alert("请输入用户名和密码");

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: username + "@example.com",
    password
  });

  if (error) return alert("登录失败: " + error.message);

  localStorage.setItem("currentUser", username);
  alert("登录成功！");
  window.location.href = "HOME.html";
});
