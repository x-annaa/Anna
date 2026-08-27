let currentUser = null;


document.addEventListener("DOMContentLoaded", async () => {


  const username =
    localStorage.getItem("currentUser");


  if (!username) {

    window.location.href = "../index.html";

    return;

  }


  await loadUserInfo(username);



  /* ===============================
      Logout
  =============================== */


  const logoutBtn =
    document.getElementById("logoutBtn");


  const logoutModal =
    document.getElementById("logoutModal");


  const cancelLogout =
    document.getElementById("cancelLogout");


  const confirmLogout =
    document.getElementById("confirmLogout");



  logoutBtn.addEventListener(
    "click",
    () => {

      logoutModal.style.display = "flex";

    }
  );



  cancelLogout.addEventListener(
    "click",
    () => {

      logoutModal.style.display = "none";

    }
  );



  confirmLogout.addEventListener(
    "click",
    () => {


      localStorage.removeItem(
        "currentUser"
      );


      localStorage.removeItem(
        "currentUserId"
      );


      localStorage.removeItem(
        "hasWithdrawPwd"
      );


      localStorage.removeItem(
        "sessionToken"
      );


      window.location.href =
        "../index.html";


    }
  );





  /* ===============================
      Transaction History
      (新增)
  =============================== */


  const transactionHistoryBtn =
    document.getElementById(
      "transactionHistoryBtn"
    );


  const transactionModal =
    document.getElementById(
      "transactionModal"
    );


  const closeTransaction =
    document.getElementById(
      "closeTransaction"
    );



  if(transactionHistoryBtn){


    transactionHistoryBtn.addEventListener(
      "click",
      async()=>{


        transactionModal.style.display =
          "flex";


        await loadTransactions();


      }
    );


  }



  if(closeTransaction){


    closeTransaction.addEventListener(
      "click",
      ()=>{


        transactionModal.style.display =
          "none";


      }
    );


  }






  /* ===============================
      Withdraw
  =============================== */


  const withdrawBtn =
    document.getElementById(
      "withdrawBtn"
    );


  const withdrawModal =
    document.getElementById(
      "withdrawModal"
    );


  const withdrawBalance =
    document.getElementById(
      "withdrawBalance"
    );



  withdrawBtn.addEventListener(
    "click",
    ()=>{


      withdrawBalance.textContent =
        document.getElementById(
          "balance"
        ).textContent;


      withdrawModal.style.display =
        "flex";


    }
  );



  document
  .getElementById(
    "cancelWithdraw"
  )
  .addEventListener(
    "click",
    ()=>{


      withdrawModal.style.display =
        "none";


    }
  );





  document
  .getElementById(
    "confirmWithdraw"
  )
  .addEventListener(
    "click",
    ()=>{


      const amount =
        document.getElementById(
          "withdrawAmount"
        ).value;


      const address =
        document.getElementById(
          "walletAddress"
        ).value;



      if(!amount || !address){

        return alert(
          "Please enter the amount and wallet address"
        );

      }



      if(
        localStorage.getItem(
          "hasWithdrawPwd"
        ) === "true"
      ){


        document
        .getElementById(
          "confirmPwdModal"
        )
        .style.display =
          "flex";


      }
      else{


        submitWithdraw();


      }


    }
  );






  async function submitWithdraw(){


    const inputPwdField =
      document.getElementById(
        "inputWithdrawPwd"
      );


    const inputPwd =
      inputPwdField
      ?
      inputPwdField.value
      :
      null;




    if(
      localStorage.getItem(
        "hasWithdrawPwd"
      ) === "true"
    ){


      if(
        inputPwd !==
        currentUser.withdraw_password
      ){

        return alert(
          "Incorrect withdrawal password!"
        );

      }


    }





    const amount =
      parseFloat(
        document.getElementById(
          "withdrawAmount"
        ).value
      );



    const address =
      document.getElementById(
        "walletAddress"
      ).value;





    if(
      !amount ||
      amount < 1
    ){

      return alert(
        "The withdrawal amount must be ≥ 1"
      );

    }



    if(!address){

      return alert(
        "Please enter wallet address"
      );

    }



    if(
      amount >
      Number(currentUser.balance)
    ){

      return alert(
        "Insufficient balance"
      );

    }






    const {error} =
      await supabaseClient.rpc(
        "request_withdraw",
        {

          p_user_id:
            currentUser.id,


          p_amount:
            amount,


          p_wallet:
            address

        }
      );




    if(error){

      return alert(
        "Withdrawal request failed: "
        +
        error.message
      );

    }




    alert(
      "Withdrawal request submitted"
    );



    currentUser.balance -= amount;



    document
    .getElementById(
      "balance"
    )
    .textContent =
      currentUser.balance.toFixed(2);




    withdrawModal.style.display =
      "none";



    if(inputPwdField){

      document
      .getElementById(
        "confirmPwdModal"
      )
      .style.display =
        "none";

    }


  }




  document
  .getElementById(
    "submitWithdrawFinal"
  )
  .addEventListener(
    "click",
    submitWithdraw
  );





  /* ===============================
      Withdraw Password
  =============================== */


  const setPasswordBtn =
    document.getElementById(
      "setPasswordBtn"
    );


  const setPasswordModal =
    document.getElementById(
      "setPasswordModal"
    );


  const updatePasswordModal =
    document.getElementById(
      "updatePasswordModal"
    );



  setPasswordBtn.addEventListener(
    "click",
    ()=>{


      if(
        localStorage.getItem(
          "hasWithdrawPwd"
        ) === "true"
      ){


        updatePasswordModal.style.display =
          "flex";


      }
      else{


        setPasswordModal.style.display =
          "flex";


      }


    }
  );




  document
  .getElementById(
    "saveWithdrawPwd"
  )
  .addEventListener(
    "click",
    async()=>{


      const pwd =
        document.getElementById(
          "withdrawPwd"
        ).value;


      const confirmPwd =
        document.getElementById(
          "confirmWithdrawPwd"
        ).value;




      if(
        !/^\d{6}$/.test(pwd)
      ){

        return alert(
          "Please enter a 6-digit password."
        );

      }




      if(
        pwd !== confirmPwd
      ){

        return alert(
          "The two passwords did not match."
        );

      }





      const {error} =
        await supabaseClient
        .from("users")
        .update({

          withdraw_password:
            pwd

        })
        .eq(
          "id",
          currentUser.id
        );




      if(error){

        return alert(
          error.message
        );

      }



      localStorage.setItem(
        "hasWithdrawPwd",
        "true"
      );


      currentUser.withdraw_password =
        pwd;


      setPasswordBtn.textContent =
        "Update password";



      alert(
        "Withdrawal password successfully set!"
      );



      setPasswordModal.style.display =
        "none";



    }
  );


  document
  .getElementById(
    "cancelSetPwd"
  )
  .addEventListener(
    "click",
    ()=>{

      setPasswordModal.style.display =
        "none";

    }
  );





  /* ===============================
      Update Withdraw Password
  =============================== */


  document
  .getElementById(
    "saveUpdatePwd"
  )
  .addEventListener(
    "click",
    async()=>{


      const oldPwd =
        document.getElementById(
          "oldWithdrawPwd"
        ).value;


      const newPwd =
        document.getElementById(
          "newWithdrawPwd"
        ).value;


      const confirmNewPwd =
        document.getElementById(
          "confirmNewWithdrawPwd"
        ).value;




      if(
        oldPwd !==
        currentUser.withdraw_password
      ){

        return alert(
          "Old password incorrect!"
        );

      }



      if(
        !/^\d{6}$/.test(newPwd)
      ){

        return alert(
          "The new password must be a 6-digit number."
        );

      }



      if(
        newPwd !== confirmNewPwd
      ){

        return alert(
          "The two new passwords do not match"
        );

      }





      const {error} =
        await supabaseClient
        .from("users")
        .update({

          withdraw_password:
            newPwd

        })
        .eq(
          "id",
          currentUser.id
        );




      if(error){

        return alert(
          error.message
        );

      }




      currentUser.withdraw_password =
        newPwd;



      alert(
        "Withdrawal password updated successfully!"
      );



      updatePasswordModal.style.display =
        "none";


    }
  );




  document
  .getElementById(
    "cancelUpdatePwd"
  )
  .addEventListener(
    "click",
    ()=>{

      updatePasswordModal.style.display =
        "none";

    }
  );







  /* ===============================
      Change Login Password
  =============================== */


  const changeLoginPwdBtn =
    document.getElementById(
      "changeLoginPwdBtn"
    );


  const changeLoginPwdModal =
    document.getElementById(
      "changeLoginPwdModal"
    );



  changeLoginPwdBtn.addEventListener(
    "click",
    ()=>{


      changeLoginPwdModal.style.display =
        "flex";


      document.getElementById(
        "currentLoginPwd"
      ).value="";


      document.getElementById(
        "newLoginPwd"
      ).value="";


      document.getElementById(
        "confirmLoginPwd"
      ).value="";


    }
  );




  document
  .getElementById(
    "cancelChangeLoginPwd"
  )
  .addEventListener(
    "click",
    ()=>{

      changeLoginPwdModal.style.display =
        "none";

    }
  );





  document
  .getElementById(
    "saveChangeLoginPwd"
  )
  .addEventListener(
    "click",
    async()=>{


      const currentPwd =
        document.getElementById(
          "currentLoginPwd"
        ).value;


      const newPwd =
        document.getElementById(
          "newLoginPwd"
        ).value;


      const confirmPwd =
        document.getElementById(
          "confirmLoginPwd"
        ).value;



      if(
        !currentPwd ||
        !newPwd ||
        !confirmPwd
      ){

        return alert(
          "Please enter complete information"
        );

      }





      const {
        data:user,
        error
      } =
      await supabaseClient
      .from("users")
      .select(
        "id,password"
      )
      .eq(
        "id",
        currentUser.id
      )
      .maybeSingle();





      if(error || !user){

        return alert(
          "Failed to retrieve user information"
        );

      }




      if(
        user.password !== currentPwd
      ){

        return alert(
          "The current login password is incorrect"
        );

      }




      if(
        newPwd.length < 6
      ){

        return alert(
          "New password length must be ≥ 6"
        );

      }




      if(
        newPwd !== confirmPwd
      ){

        return alert(
          "The two new passwords did not match"
        );

      }





      const {
        error:updateErr
      } =
      await supabaseClient
      .from("users")
      .update({

        password:
          newPwd

      })
      .eq(
        "id",
        currentUser.id
      );




      if(updateErr){

        return alert(
          updateErr.message
        );

      }




      currentUser.password =
        newPwd;



      alert(
        "Login password changed successfully!"
      );



      changeLoginPwdModal.style.display =
        "none";


    }
  );






  /* ===============================
      Close Modal
  =============================== */


  window.addEventListener(
    "click",
    (e)=>{


      if(
        e.target.classList.contains(
          "modal"
        )
      ){

        e.target.style.display =
          "none";

      }


    }
  );



  window.addEventListener(
    "keydown",
    (e)=>{


      if(
        e.key==="Escape"
      ){

        document
        .querySelectorAll(
          ".modal"
        )
        .forEach(
          m=>{

            m.style.display =
              "none";

          }
        );

      }


    }
  );


});









/* =====================================================
    Transaction History
===================================================== */


async function loadTransactions(){


  const transactionList =
    document.getElementById(
      "transactionList"
    );



  if(!currentUser){

    return;

  }




  transactionList.innerHTML =
    "Loading...";





  const {

    data: rechargeData,
    error: rechargeError

  } =
  await supabaseClient
  .from("recharges")
  .select("*")
  .eq(
    "user_id",
    currentUser.uuid
  );





  const {

    data: withdrawData,
    error: withdrawError

  } =
  await supabaseClient
  .from("withdrawals")
  .select("*")
  .eq(
    "user_id",
    currentUser.id
  );





  if(
    rechargeError ||
    withdrawError
  ){

    console.error(
      rechargeError ||
      withdrawError
    );


    transactionList.innerHTML =
    `
      Failed to load history
    `;


    return;

  }






  let list=[];





  rechargeData?.forEach(
    r=>{


      list.push({

        type:"Recharge",

        amount:r.amount,

        status:r.status,

        date:r.created_at

      });


    }
  );






  withdrawData?.forEach(
    w=>{


      list.push({

        type:"Withdraw",

        amount:w.amount,

        status:w.status,

        date:w.created_at,

        wallet:w.wallet_address

      });


    }
  );






  list.sort(
    (a,b)=>
      new Date(b.date)
      -
      new Date(a.date)
  );






  if(list.length===0){


    transactionList.innerHTML =
    `
      <p>
        No transaction history
      </p>
    `;


    return;


  }






  transactionList.innerHTML="";






  list.forEach(
    t=>{


      const div =
      document.createElement(
        "div"
      );



      div.className =
      "transaction-item "
      +
      (
        t.type==="Recharge"
        ?
        "transaction-recharge"
        :
        "transaction-withdraw"
      );





      div.innerHTML = `

        <div class="transaction-title">

          ${
            t.type==="Recharge"
            ?
            "💰 Recharge"
            :
            "💸 Withdraw"
          }

        </div>


        <p>
          Amount:
          ${t.amount}
        </p>


        <p>
          Status:
          ${t.status}
        </p>


        ${
          t.wallet
          ?
          `
          <p>
            Wallet:
            ${t.wallet}
          </p>
          `
          :
          ""
        }


        <div class="transaction-date">

          ${
            new Date(
              t.date
            ).toLocaleString()
          }

        </div>


      `;



      transactionList.appendChild(
        div
      );


    }
  );


}









/* =====================================================
    Load User Info
===================================================== */


async function loadUserInfo(username){


  if(!username){

    return;

  }



  try{


    const {
      data,
      error
    } =
    await supabaseClient
    .from("users")
    .select(
      `
      id,
      uuid,
      username,
      platform_account,
      balance,
      withdraw_password,
      password
      `
    )
    .eq(
      "username",
      username
    )
    .single();





    if(
      error ||
      !data
    ){

      throw new Error(
        error?.message ||
        "User does not exist"
      );

    }






    currentUser =
      data;





    document
    .getElementById(
      "username"
    )
    .textContent =
      data.username ||
      "Unknown";





    document
    .getElementById(
      "platformAccount"
    )
    .textContent =
      data.platform_account ||
      "Unknown";





    document
    .getElementById(
      "balance"
    )
    .textContent =
      (
        Number(
          data.balance
        )
        ||
        0
      )
      .toFixed(2);





    localStorage.setItem(
      "currentUserId",
      data.id
    );






    const setPasswordBtn =
      document.getElementById(
        "setPasswordBtn"
      );





    if(data.withdraw_password){


      localStorage.setItem(
        "hasWithdrawPwd",
        "true"
      );


      setPasswordBtn.textContent =
        "Update password";


    }
    else{


      localStorage.setItem(
        "hasWithdrawPwd",
        "false"
      );


      setPasswordBtn.textContent =
        "Add withdrawal password";


    }





  }
  catch(e){


    console.error(
      "Error loading user information:",
      e
    );



    document
    .getElementById(
      "platformAccount"
    )
    .textContent =
      "Mistake";



    document
    .getElementById(
      "balance"
    )
    .textContent =
      "Mistake";


  }



}
