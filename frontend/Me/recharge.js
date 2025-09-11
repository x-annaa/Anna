import { supabase } from "./supabaseClient.js"

const depositBtn = document.getElementById("depositBtn")
const depositFile = document.getElementById("depositFile")

depositBtn.addEventListener("click", () => {
  depositFile.click()
})

depositFile.addEventListener("change", async (event) => {
  const file = event.target.files[0]
  if (!file) return

  const filePath = `recharges/${Date.now()}-${file.name}`

  // 上传文件
  const { data, error } = await supabase.storage
    .from("Recharge")
    .upload(filePath, file)

  if (error) {
    console.error("上传失败:", error.message)
    alert("上传失败，请重试！")
    return
  }

  // 获取公开 URL
  const { data: publicUrlData } = supabase
    .storage
    .from("Recharge")
    .getPublicUrl(filePath)

  console.log("上传成功:", data)
  console.log("文件公开地址:", publicUrlData.publicUrl)
  alert("充值凭证已上传！")
})
