// ======================
// 充值凭证上传
// ======================

// 获取按钮和文件输入框
const depositBtn = document.getElementById("depositBtn");
const depositFile = document.getElementById("depositFile");

// 点击充值按钮，触发文件选择
depositBtn.addEventListener("click", () => depositFile.click());

// 文件选择后上传
depositFile.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // 给文件生成唯一路径，放在 bucket "Recharge" 下
  const filePath = `recharges/${Date.now()}-${file.name}`;

  // 上传文件
  const { data, error } = await supabase.storage
    .from("Recharge")  // bucket 名称
    .upload(filePath, file);

  if (error) {
    console.error("上传失败:", error.message);
    alert("上传失败，请重试！");
    return;
  }

  // 获取公开访问 URL
  const { data: publicUrlData } = supabase.storage
    .from("Recharge")
    .getPublicUrl(filePath);

  console.log("上传成功:", data);
  console.log("文件地址:", publicUrlData.publicUrl);

  alert("充值凭证已上传！");

  // 可选：把充值记录写入数据库
  try {
    const { error: dbError } = await supabase
      .from("recharges")
      .insert([{
        user_id: window.currentUserId, // 当前登录用户 ID
        file_url: publicUrlData.publicUrl,
        status: "pending",  // 后台审核状态
        created_at: new Date()
      }]);

    if (dbError) {
      console.error("保存充值记录失败:", dbError.message);
    } else {
      console.log("充值记录已保存到数据库");
    }
  } catch (e) {
    console.error("保存充值记录异常:", e);
  }
});
