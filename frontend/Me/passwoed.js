// =====================================================
// ME PASSWORD
// =====================================================

document.addEventListener("DOMContentLoaded",()=>{


const passwordBtn =
document.getElementById("changeLoginPwdBtn");


const passwordModal =
document.getElementById("me-password");


const closePassword =
document.getElementById("closeMePassword");


const savePassword =
document.getElementById("saveChangeLoginPwd");



let saving = false;



if(
!passwordBtn ||
!passwordModal
){

    console.log(
        "Password elements missing"
    );

    return;

}




// =====================================================
// OPEN
// =====================================================

passwordBtn.addEventListener(
"click",
()=>{


    if(
    passwordModal.classList.contains("show")
    ){

        return;

    }



    passwordModal.style.display =
    "block";



    requestAnimationFrame(()=>{

        requestAnimationFrame(()=>{

            passwordModal.classList.add(
                "show"
            );

        });

    });



    document.getElementById(
        "currentLoginPwd"
    ).value="";


    document.getElementById(
        "newLoginPwd"
    ).value="";


    document.getElementById(
        "confirmLoginPwd"
    ).value="";



});







// =====================================================
// CLOSE
// =====================================================

function closePasswordModal(){


    passwordModal.classList.remove(
        "show"
    );


    setTimeout(()=>{


        if(
        !passwordModal.classList.contains(
            "show"
        )
        ){

            passwordModal.style.display =
            "none";

        }


    },450);



}





closePassword?.addEventListener(
"click",
closePasswordModal
);








// =====================================================
// ESC CLOSE
// =====================================================

document.addEventListener(
"keydown",
(e)=>{


    if(
    e.key==="Escape" &&
    passwordModal.classList.contains(
        "show"
    )
    ){

        closePasswordModal();

    }


});








// =====================================================
// PASSWORD EYE TOGGLE
// =====================================================

document
.querySelectorAll(".toggle-password")
.forEach(
button=>{


button.addEventListener(
"click",
()=>{


const target =
document.getElementById(
    button.dataset.target
);



if(!target)return;



const eye =
button.querySelector(
    "svg"
);



if(
target.type === "password"
){


    target.type =
    "text";


    button.setAttribute(
        "aria-label",
        "Hide password"
    );



    eye.innerHTML = `

        <path 
        d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z">
        </path>

        <circle
        cx="12"
        cy="12"
        r="3">
        </circle>

        <path
        d="M4 4l16 16">
        </path>

    `;



}
else{


    target.type =
    "password";


    button.setAttribute(
        "aria-label",
        "Show password"
    );



    eye.innerHTML = `

        <path 
        d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z">
        </path>

        <circle
        cx="12"
        cy="12"
        r="3">
        </circle>

    `;



}


});


});









// =====================================================
// SAVE PASSWORD
// =====================================================

savePassword?.addEventListener(
"click",
async()=>{


if(saving){

    return;

}



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

alert(
"Please enter complete information"
);

return;

}




if(
newPwd.length < 6
){

alert(
"New password length must be ≥ 6"
);

return;

}




if(
newPwd !== confirmPwd
){

alert(
"The two passwords did not match"
);

return;

}






saving = true;


savePassword.disabled = true;


savePassword.textContent =
"Saving...";







try{



const {
data:user,
error
}
=
await supabaseClient
.from("users")
.select(
"id,password"
)
.eq(
"id",
currentUser.id
)
.single();





if(
error ||
!user
){

throw new Error(
"User information error"
);

}




if(
user.password !== currentPwd
){

throw new Error(
"Current password incorrect"
);

}





const {
error:updateError
}
=
await supabaseClient
.from("users")
.update({

password:newPwd

})
.eq(
"id",
currentUser.id
);





if(updateError){

throw updateError;

}




currentUser.password =
newPwd;




alert(
"Password changed successfully"
);



closePasswordModal();




}
catch(error){


alert(
error.message
);



}
finally{


saving=false;


savePassword.disabled=false;


savePassword.textContent =
"Save";


}



});



});
