// index.js
import { supabaseClient } from './supabaseClient.js';

// =======================
// 密码可见切换
// =======================
document.querySelectorAll(".toggle-password").forEach(btn => {
  btn.addEventListener("click", () => {
    const inputId = btn.dataset.target;
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
    btn.textContent = input.type === "password" ? "👁️" : "🙈";
  });
});

// =======================
// 登录/注册 Tab 切换
// =======================
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

// =======================
// 生成随机平台账号
// =======================
function generatePlatformAccount() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  let acc = "";
  for (let i = 0; i < 2; i++) acc += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 4; i++) acc += numbers[Math.floor(Math.random() * numbers.length)];
  return acc;
}

// =======================
// 注册逻辑
// =======================
document.getElementById("registerBtn").addEventListener("click", async () => {
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirmPassword").value;
  const agree = document.getElementById("agreeTerms").checked;

  if (!username || !password) return alert("请输入用户名和密码");
  if (password !== confirm) return alert("两次输入的密码不一致");
  if (!agree) return alert("请先勾选同意条款");

  const { data, error } = await supabaseClient.auth.signUp({
    email: username + "@example.com",
    password
  });
  if (error) return alert("注册失败: " + error.message);

  const userId = data.user.id;
  const platformAccount = generatePlatformAccount();

  const { error: insertError } = await supabaseClient
    .from("users")
    .insert({ auth_id: userId, username, coins: 0, balance: 0, traffic: 0, platform_account: platformAccount });

  if (insertError) return alert("保存用户信息失败: " + insertError.message);

  localStorage.setItem("currentUserId", userId);
  localStorage.setItem("currentUser", username);

  alert("注册成功！");
  window.location.href = "HOME.html";
});

// =======================
// 登录逻辑
// =======================
document.getElementById("loginBtn").addEventListener("click", async () => {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!username || !password) return alert("请输入用户名和密码");

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: username + "@example.com",
    password
  });
  if (error) return alert("登录失败: " + error.message);

  localStorage.setItem("currentUserId", data.user.id);
  localStorage.setItem("currentUser", username);

  alert("登录成功！");
  window.location.href = "HOME.html";
});

// =======================
// 上传截图逻辑（HOME 页面）
// =======================
export async function setupUpload() {
  const uploadBtn = document.getElementById("uploadBtn");
  const fileInput = document.getElementById("fileInput");
  const uploadList = document.getElementById("uploadList");

  const currentUserId = localStorage.getItem("currentUserId");
  if (!currentUserId) {
    alert("请先登录！");
    window.location.href = "index.html";
    return;
  }

  async function loadUploads() {
    const { data, error } = await supabaseClient
      .from("recharge")
      .select("image_url, created_at")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error) return console.error(error.message);

    uploadList.innerHTML = data.map(item => `
      <div style="margin-bottom:10px;">
        <a href="${item.image_url}" target="_blank">
          <img src="${item.image_url}" width="100" style="border:1px solid #ccc;"/>
        </a>
        <span>${new Date(item.created_at).toLocaleString()}</span>
      </div>
    `).join("");
  }

  uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) return alert("请选择文件");

    const safeFileName = `${currentUserId}_${Date.now()}_${file.name.replace(/\s/g, "_")}`;

    const { data: storageData, error: storageError } = await supabaseClient
      .storage
      .from("Supabasephotos")
      .upload(safeFileName, file, { upsert: false });

    if (storageError) return alert("上传失败: " + storageError.message);

    const { data: publicUrlData } = supabaseClient
      .storage
      .from("Supabasephotos")
      .getPublicUrl(safeFileName);

    const publicUrl = publicUrlData.publicUrl;

    const { error: rechargeError } = await supabaseClient
      .from("recharge")
      .insert([{ user_id: currentUserId, image_url: publicUrl }]);

    if (rechargeError) return alert("保存记录失败: " + rechargeError.message);

    alert("上传成功！");
    fileInput.value = "";
    loadUploads();
  });

  loadUploads();
}

// 页面加载时，如果是 HOME 页面就调用
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("uploadBtn")) setupUpload();
});
