document.addEventListener("DOMContentLoaded", () => {

  const depositBtn = document.getElementById("depositBtn");
  const rechargeModal = document.getElementById("rechargeModal");
  const cancelRecharge = document.getElementById("cancelRecharge");

  const fileInput = document.getElementById("fileInput");
  const uploadBtn = document.getElementById("uploadBtn");
  const status = document.getElementById("status");
  const amountInput = document.getElementById("amountInput");

  const copyAddressBtn = document.getElementById("copyAddressBtn");


  if (typeof supabaseClient === "undefined") {
    console.error("supabaseClient undefined");
    if (status) {
      status.textContent = "System Error: Supabase client not detected";
      status.style.color = "red";
    }
    return;
  }

  if (depositBtn && rechargeModal && cancelRecharge) {
    depositBtn.addEventListener("click", () => {
      rechargeModal.style.display = "flex";
      if (status) status.textContent = "";
      if (fileInput) fileInput.value = "";
      if (amountInput) amountInput.value = "";
    });

    cancelRecharge.addEventListener("click", () => {
      rechargeModal.style.display = "none";
    });

    window.addEventListener("click", (e) => {
      if (e.target === rechargeModal) rechargeModal.style.display = "none";
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") rechargeModal.style.display = "none";
    });
  }


  copyAddressBtn?.addEventListener("click", () => {
    try {
      const walletAddress = copyAddressBtn.dataset.wallet;
      if (!walletAddress) throw new Error("Wallet address is empty");

      const tempInput = document.createElement("input");
      tempInput.value = walletAddress;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand("copy");
      document.body.removeChild(tempInput);

      copyAddressBtn.textContent = "Copied ✅";
      setTimeout(() => (copyAddressBtn.textContent = "Copy"), 1800);

      console.log("Copied successfully：", walletAddress);
    } catch (err) {
      console.error("Copy failed：", err);
      copyAddressBtn.textContent = "Copy failed";
      setTimeout(() => (copyAddressBtn.textContent = "Copy"), 1800);
    }
  });


  if (!fileInput || !uploadBtn || !status || !amountInput) {
    console.error("The Recharge page is missing necessary DOM elements");
    return;
  }

  uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files?.[0];
    const rawAmount = amountInput.value;
    const amount = parseFloat(rawAmount);


    if (!rawAmount || isNaN(amount) || amount <= 0) {
      status.textContent = "Please enter a valid recharge amount!";
      status.style.color = "red";
      return;
    }

    if (!file) {
      status.textContent = "Please upload a screenshot of the transfer!";
      status.style.color = "red";
      return;
    }

    status.textContent = "Uploading...";
    status.style.color = "#333";
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading...";

    const rand = Math.floor(Math.random() * 9000) + 1000;
    const safeFileName = `${Date.now()}_${rand}_${file.name.replace(/\s+/g, "_")}`;

    try {

      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from("Recharge")
        .upload(safeFileName, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabaseClient.storage
        .from("Recharge")
        .getPublicUrl(safeFileName);
      const publicUrl = publicUrlData?.publicUrl ?? "";


      let userId = null;
      try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const session = sessionData?.session;
        if (session?.user?.id) userId = session.user.id;
      } catch {}

      if (!userId) {
        try {
          const { data: userData } = await supabaseClient.auth.getUser();
          const user = userData?.user ?? userData;
          if (user?.id) userId = user.id;
        } catch {}
      }

      if (!userId) userId = localStorage.getItem("currentUserUUID");
      if (!userId) throw new Error("Unable to submit recharge records if the user is not logged in");

     
      let platformAccount = null;
      try {
        const { data: userInfo, error: userInfoError } = await supabaseClient
          .from("users")
          .select("platform_account")
          .eq("uuid", userId)
          .single();
        if (userInfoError) console.warn("Failed to obtain platform account:", userInfoError);
        platformAccount = userInfo?.platform_account ?? null;
      } catch (e) {
        console.warn("Abnormal acquisition of platform account:", e);
      }


      const payload = {
        user_id: userId,
        platform_account: platformAccount,
        amount: Number(amount.toFixed(2)),
        recharge_url: publicUrl,
        status: "pending",
      };

      const { data: insertData, error: insertError } = await supabaseClient
        .from("recharges")
        .insert([payload]);
      if (insertError) throw insertError;

      status.textContent = "✅ Uploaded successfully, waiting for review!";
      status.style.color = "green";

      fileInput.value = "";
      amountInput.value = "";

      console.log("Recharge record saved successfully：", { payload, storage: safeFileName });

      setTimeout(() => {
        rechargeModal.style.display = "none";
        status.textContent = "";
      }, 2000);

    } catch (err) {
      console.error("Upload or write failure：", err);
      status.textContent = "Upload failed：" + (err.message || String(err));
      status.style.color = "red";
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload";
    }
  });
});
