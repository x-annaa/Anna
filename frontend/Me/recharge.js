import { createClient } from '@supabase/supabase-js'

// ⚠️ 替换成你自己项目的配置
const supabaseUrl = "https://你的-supabase-url.supabase.co"
const supabaseKey = "你的-public-anon-key"   // 建议只用 anon key
const supabase = createClient(supabaseUrl, supabaseKey)

// DOM 元素
const depositBtn = document.getElementById("depositBtn")
const depositFile = document.getElementById("depositFile")

// 点击按钮时触发文件选择
depositBtn.addEventListener("click", () => {
  depositFile.click()
})

// 选择文件后上传
depositFile.addEventListener("change", async (event) => {
  const file = event.target.files[0]
  if (!file) return

  // 文件路径：存到 bucket 的 Recharge/recharges/ 文件夹下
  const filePath = `recharges/${Date.now()}-${file.name}`

  // 上传文件到 Supabase Storage
  const { data, error } = await supabase.storage
    .from("Recharge")  // 你的 bucket 名称
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false
    })

  if (error) {
    console.error("上传失败：", error.message)
    alert("上传失败，请重试！")
    return
  }

  // 获取公开 URL（方便以后在用户中心展示凭证）
  const { data: publicUrlData } = supabase
    .storage
    .from("Recharge")
    .getPublicUrl(filePath)

  console.log("上传成功，文件路径：", data.path)
  console.log("文件公开地址：", publicUrlData.publicUrl)
  alert("充值凭证已上传！")
})

// 上传成功后插入记录到 recharges 表
const { data: rechargeData, error: rechargeError } = await supabase
  .from("recharges")
  .insert([
    {
      user_id: currentUserId,      // 你需要在前端拿到登录用户的 ID
      file_path: data.path,        // 上传成功返回的文件路径
      file_url: publicUrlData.publicUrl, // 公共 URL
      status: "pending"
    }
  ])

if (rechargeError) {
  console.error("插入记录失败：", rechargeError.message)
} else {
  console.log("充值记录已保存：", rechargeData)
}
