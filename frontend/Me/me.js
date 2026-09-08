// =====================================================
// ME JS
// =====================================================


let currentUser = null;



// =====================================================
// DOM READY
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {


        // =================================================
        // CHECK LOGIN
        // =================================================

        const username =
            localStorage.getItem(
                "currentUser"
            );


        if (!username) {

            window.location.href =
                "../index.html";

            return;

        }

        // =================================================
        // LOAD USER
        // =================================================

        await loadUserInfo(username);


        // =================================================
        // WITHDRAW
        // =================================================


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



        withdrawBtn?.addEventListener(
            "click",
            () => {


                if (!withdrawModal)
                    return;



                if (withdrawBalance) {

                    withdrawBalance.textContent =
                        document.getElementById(
                            "balance"
                        )?.textContent || "0.00";

                }



                withdrawModal.style.display =
                    "flex";


            }
        );




        const cancelWithdraw =
            document.getElementById(
                "cancelWithdraw"
            );



        cancelWithdraw?.addEventListener(
            "click",
            () => {


                if (!withdrawModal)
                    return;


                withdrawModal.style.display =
                    "none";


            }
        );





        // =================================================
        // CONFIRM WITHDRAW
        // =================================================


        const confirmWithdraw =
            document.getElementById(
                "confirmWithdraw"
            );



        confirmWithdraw?.addEventListener(
            "click",
            () => {


                const amount =
                    document.getElementById(
                        "withdrawAmount"
                    )?.value;



                const address =
                    document.getElementById(
                        "walletAddress"
                    )?.value;



                if (
                    !amount ||
                    !address
                ) {


                    alert(
                        "Please enter the amount and wallet address"
                    );


                    return;

                }



                const hasPwd =
                    localStorage.getItem(
                        "hasWithdrawPwd"
                    );



                if (
                    hasPwd === "true"
                ) {


                    const confirmPwdModal =
                        document.getElementById(
                            "confirmPwdModal"
                        );


                    if (confirmPwdModal) {

                        confirmPwdModal.style.display =
                            "flex";

                    }


                }
                else {


                    submitWithdraw();


                }



            }
        );





        // =================================================
        // FINAL WITHDRAW PASSWORD BUTTON
        // =================================================


        const submitWithdrawFinal =
            document.getElementById(
                "submitWithdrawFinal"
            );


        submitWithdrawFinal?.addEventListener(
            "click",
            submitWithdraw
        );





        // =================================================
        // GLOBAL CLOSE
        // =================================================


        window.addEventListener(
            "click",
            (e)=>{


                if (
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


                if (
                    e.key === "Escape"
                ){

                    document
                    .querySelectorAll(
                        ".modal"
                    )
                    .forEach(
                        modal=>{

                            modal.style.display =
                                "none";

                        }
                    );

                }


            }
        );



    }
);






// =====================================================
// SUBMIT WITHDRAW
// =====================================================


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




    if (
        localStorage.getItem(
            "hasWithdrawPwd"
        )
        ===
        "true"
    ){

        if (
            inputPwd !==
            currentUser.withdraw_password
        ){

            alert(
                "Incorrect withdrawal password!"
            );

            return;

        }

    }





    const amount =
        parseFloat(
            document.getElementById(
                "withdrawAmount"
            )?.value
        );



    const address =
        document.getElementById(
            "walletAddress"
        )?.value;



    if (
        !amount ||
        amount < 10
    ){

        alert(
            "The withdrawal amount must be ≥ 10"
        );

        return;

    }



    if (!address){

        alert(
            "Please enter wallet address"
        );

        return;

    }



    if (
        amount >
        Number(
            currentUser.balance
        )
    ){

        alert(
            "Insufficient balance"
        );

        return;

    }





    const {
        error
    } =
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

        alert(
            "Withdrawal request failed: "
            +
            error.message
        );

        return;

    }




    alert(
        "Withdrawal request submitted"
    );



    currentUser.balance -=
        amount;



    const balance =
        document.getElementById(
            "balance"
        );


    if(balance){

        balance.textContent =
            currentUser.balance.toFixed(2);

    }




    const withdrawModal =
        document.getElementById(
            "withdrawModal"
        );


    if(withdrawModal){

        withdrawModal.style.display =
            "none";

    }



}

// =====================================================
// LOAD USER INFO
// =====================================================


async function loadUserInfo(username){


    if(!username)
        return;



    try{


        const {
            data,
            error
        }
        =
        await supabaseClient
        .from("users")
        .select(
            `
            id,
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



        if(error || !data){

            throw new Error(
                error?.message ||
                "User does not exist"
            );

        }



        currentUser =
            data;




        // =================================================
        // DISPLAY USER
        // =================================================


        const usernameBox =
            document.getElementById(
                "username"
            );


        if(usernameBox){

            usernameBox.textContent =
                data.username ||
                "Unknown";

        }




        const accountBox =
            document.getElementById(
                "platformAccount"
            );


        if(accountBox){

            accountBox.textContent =
                data.platform_account ||
                "Unknown";

        }





        const balanceBox =
            document.getElementById(
                "balance"
            );


        if(balanceBox){

            balanceBox.textContent =
                (
                    Number(
                        data.balance
                    )
                    ||
                    0
                )
                .toFixed(2);

        }





        localStorage.setItem(
            "currentUserId",
            data.id
        );





        // =================================================
        // WITHDRAW PASSWORD STATUS
        // =================================================


        const setPasswordBtn =
            document.getElementById(
                "setPasswordBtn"
            );



        if(
            data.withdraw_password
        ){


            localStorage.setItem(
                "hasWithdrawPwd",
                "true"
            );



            if(setPasswordBtn){

                setPasswordBtn.textContent =
                    "Update password";

            }


        }
        else{


            localStorage.setItem(
                "hasWithdrawPwd",
                "false"
            );



            if(setPasswordBtn){

                setPasswordBtn.textContent =
                    "Add withdrawal password";

            }


        }





        // =================================================
        // INIT WITHDRAW PASSWORD
        // =================================================

        initWithdrawPassword();



    }
    catch(error){


        console.error(
            "Load user error:",
            error
        );


        const accountBox =
            document.getElementById(
                "platformAccount"
            );


        if(accountBox){

            accountBox.textContent =
                "Mistake";

        }



    }


}









// =====================================================
// WITHDRAW PASSWORD
// =====================================================


function initWithdrawPassword(){



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





    // =================================================
    // OPEN
    // =================================================


    setPasswordBtn?.addEventListener(
        "click",
        ()=>{


            const hasPwd =
                localStorage.getItem(
                    "hasWithdrawPwd"
                );



            if(
                hasPwd === "true"
            ){


                if(updatePasswordModal){

                    updatePasswordModal.style.display =
                        "flex";

                }


            }
            else{


                if(setPasswordModal){

                    setPasswordModal.style.display =
                        "flex";

                }


            }


        }
    );







    // =================================================
    // SAVE NEW PASSWORD
    // =================================================


    const saveWithdrawPwd =
        document.getElementById(
            "saveWithdrawPwd"
        );



    saveWithdrawPwd?.addEventListener(
        "click",
        async()=>{


            const pwd =
                document.getElementById(
                    "withdrawPwd"
                )?.value;



            const confirmPwd =
                document.getElementById(
                    "confirmWithdrawPwd"
                )?.value;




            if(
                !/^\d{6}$/.test(
                    pwd
                )
            ){

                alert(
                    "Please enter a 6-digit password."
                );

                return;

            }




            if(
                pwd !== confirmPwd
            ){

                alert(
                    "The two passwords did not match."
                );

                return;

            }





            const {
                error
            }
            =
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


                alert(
                    "Failed to save password: "
                    +
                    error.message
                );


                return;

            }




            currentUser.withdraw_password =
                pwd;



            localStorage.setItem(
                "hasWithdrawPwd",
                "true"
            );




            if(setPasswordBtn){

                setPasswordBtn.textContent =
                    "Update password";

            }





            alert(
                "Withdrawal password successfully set!"
            );




            if(setPasswordModal){

                setPasswordModal.style.display =
                    "none";

            }



        }
    );








    // =================================================
    // UPDATE PASSWORD
    // =================================================


    const saveUpdatePwd =
        document.getElementById(
            "saveUpdatePwd"
        );



    saveUpdatePwd?.addEventListener(
        "click",
        async()=>{


            const oldPwd =
                document.getElementById(
                    "oldWithdrawPwd"
                )?.value;



            const newPwd =
                document.getElementById(
                    "newWithdrawPwd"
                )?.value;



            const confirmNewPwd =
                document.getElementById(
                    "confirmNewWithdrawPwd"
                )?.value;






            if(
                oldPwd !==
                currentUser.withdraw_password
            ){

                alert(
                    "Old password incorrect!"
                );

                return;

            }





            if(
                !/^\d{6}$/.test(
                    newPwd
                )
            ){

                alert(
                    "The new password must be a 6-digit number."
                );

                return;

            }




            if(
                newPwd !==
                confirmNewPwd
            ){

                alert(
                    "The two new passwords do not match"
                );

                return;

            }






            const {
                error
            }
            =
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


                alert(
                    "Failed to update password: "
                    +
                    error.message
                );


                return;

            }




            currentUser.withdraw_password =
                newPwd;



            alert(
                "Withdrawal password updated successfully!"
            );




            if(updatePasswordModal){

                updatePasswordModal.style.display =
                    "none";

            }



        }
    );







    // =================================================
    // CANCEL BUTTONS
    // =================================================


    document
    .getElementById(
        "cancelSetPwd"
    )
    ?.addEventListener(
        "click",
        ()=>{


            if(setPasswordModal){

                setPasswordModal.style.display =
                    "none";

            }


        }
    );



    document
    .getElementById(
        "cancelUpdatePwd"
    )
    ?.addEventListener(
        "click",
        ()=>{


            if(updatePasswordModal){

                updatePasswordModal.style.display =
                    "none";

            }


        }
    );



}
