// =======================
// 初始化 Supabase
// =======================
const supabaseClient = supabase.createClient(
  "https://YOUR_PROJECT_URL.supabase.co",
  "YOUR_ANON_KEY"
);

// =======================
// 密码可见切换
// =======================
window.togglePassword = function (id, el) {
  const input = document.getElementById(id);
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    el.textContent = "🙈";
  } else {
    input.type = "password";
    el.textContent = "👁️";
  }
};

// =======================
// 登录 / 注册 Tab 切换
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
// 生成随机平台账号（2位大写字母 + 4位数字）
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
// 注册逻辑 (Supabase Auth)
// =======================
document.getElementById("registerBtn").addEventListener("click", async () => {
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirmPassword").value;
  const agree = document.getElementById("agreeTerms").checked;

  if (!username || !password) {
    alert("请输入用户名和密码");
    return;
  }
  if (password !== confirm) {
    alert("两次输入的密码不一致");
    return;
  }
  if (!agree) {
    alert("请先勾选同意条款");
    return;
  }

  // 注册到 Supabase Auth (用 username 拼接成假邮箱)
  const { data, error } = await supabaseClient.auth.signUp({
    email: username + "@example.com",
    password: password
  });

  if (error) {
    alert("注册失败: " + error.message);
    return;
  }

  // 生成平台账号
  const platformAccount = generatePlatformAccount();

  // 在 users 表插入数据，关联 auth_id
  const { error: insertError } = await supabaseClient
    .from("users")
    .insert({
      auth_id: data.user.id, // 新增 auth_id 列
      username: username,
      coins: 0,
      balance: 0,
      traffic: 0,
      platform_account: platformAccount
    });

  if (insertError) {
    alert("保存用户信息失败: " + insertError.message);
    return;
  }

  // 保存 Token
  if (data.session) {
    localStorage.setItem("currentUserToken", data.session.access_token);
  }
  localStorage.setItem("currentUser", username);

  alert("注册成功！");
  window.location.href = "frontend/HOME.html";
});

// =======================
// 登录逻辑 (Supabase Auth)
// =======================
document.getElementById("loginBtn").addEventListener("click", async () => {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!username || !password) {
    alert("请输入用户名和密码");
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: username + "@example.com",
    password: password
  });

  if (error) {
    alert("登录失败: " + error.message);
    return;
  }

  // 保存 Token
  localStorage.setItem("currentUserToken", data.session.access_token);
  localStorage.setItem("currentUser", username);

  alert("登录成功！");
  window.location.href = "frontend/HOME.html";
});

// =======================
// HOME 页面：上传截图
// =======================
async function setupUpload() {
  const uploadBtn = document.getElementById("uploadBtn");
  const fileInput = document.getElementById("fileInput");
  const uploadList = document.getElementById("uploadList");

  const currentUser = localStorage.getItem("currentUser");
  if (!currentUser) {
    alert("请先登录！");
    window.location.href = "../index.html";
    return;
  }

  async function loadUploads() {
    const { data, error } = await supabaseClient
      .from("recharge")
      .select("image_url, created_at")
      .eq("username", currentUser)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("加载上传记录失败:", error.message);
      return;
    }

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

    const safeFileName = `${currentUser}_${Date.now()}_${file.name.replace(/\s/g, "_")}`;

    // 上传文件
    const { data: storageData, error: storageError } = await supabaseClient
      .storage
      .from("Supabasephotos")
      .upload(safeFileName, file, {
        upsert: false
      });

    if (storageError) {
      console.error(storageError);
      return alert("上传失败: " + storageError.message);
    }

    // 获取 Public URL
    const { data: publicUrlData } = supabaseClient
      .storage
      .from("Supabasephotos")
      .getPublicUrl(safeFileName);

    const publicUrl = publicUrlData.publicUrl;

    // 保存到 recharge 表
    const { error: rechargeError } = await supabaseClient
      .from("recharge")
      .insert([{ username: currentUser, image_url: publicUrl }]);

    if (rechargeError) {
      console.error(rechargeError);
      return alert("保存记录失败: " + rechargeError.message);
    }

    alert("上传成功！");
    fileInput.value = "";
    loadUploads();
  });

  loadUploads();
}

// 页面加载时调用
document.addEventListener("DOMContentLoaded", setupUpload);
