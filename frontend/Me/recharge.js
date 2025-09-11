const depositBtn = document.getElementById("depositBtn")
const depositFile = document.getElementById("depositFile")

depositBtn.addEventListener("click", () => {
  depositFile.click()
})

depositFile.addEventListener("change", async (event) => {
  const file = event.target.files[0]
  if (!file) return

  const filePath = `recharges/${Date.now()}-${file.name}`

  const { data, error } = await supabase.storage
    .from("Recharge")  // bucket 名称
    .upload(filePath, file)

  if (error) {
    console.error("上传失败:", error.message)
    alert("上传失败，请重试！")
    return
  }

  const { data: publicUrlData } = supabase
    .storage
    .from("Recharge")
    .getPublicUrl(filePath)

  console.log("上传成功:", data)
  console.log("文件地址:", publicUrlData.publicUrl)
  alert("充值凭证已上传！")
})
