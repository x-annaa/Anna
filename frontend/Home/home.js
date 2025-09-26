// =======================
// HOME 页面登录状态检查
// =======================
async function checkSession() {
  const userId = localStorage.getItem("currentUserId");
  const sessionToken = localStorage.getItem("sessionToken");

  if (!userId || !sessionToken) {
    alert("请先登录");
    window.location.href = "../index.html";
    return;
  }

  const { data, error } = await supabaseClient
    .from("users")
    .select("session_token")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    alert("验证失败，请重新登录");
    window.location.href = "../index.html";
    return;
  }

  if (data.session_token !== sessionToken) {
    alert("您的账号已在别处登录");
    localStorage.clear();
    window.location.href = "../index.html";
  }
}

// 页面一加载就检查
checkSession();

// =======================
// 登出按钮
// =======================
window.logout = async function () {
  const userId = localStorage.getItem("currentUserId");

  if (userId) {
    await supabaseClient
      .from("users")
      .update({ session_token: null })
      .eq("id", userId);
  }

  localStorage.clear();
  window.location.href = "../index.html";
};
