// =====================================================
// ME LOGOUT JS
// =====================================================


document.addEventListener(
"DOMContentLoaded",
()=>{


const logoutBtn =
document.getElementById(
"logoutBtn"
);



const logoutModal =
document.getElementById(
"me-logout"
);



const cancelLogout =
document.getElementById(
"cancelLogout"
);



const confirmLogout =
document.getElementById(
"confirmLogout"
);



const logoutAgree =
document.getElementById(
"logoutAgree"
);



const logoutCountdown =
document.getElementById(
"logoutCountdown"
);



let timer = null;



let seconds = 5;





// OPEN LOGOUT

logoutBtn?.addEventListener(
"click",
()=>{


if(!logoutModal)
return;



logoutModal.style.display =
"flex";



// reset

seconds = 5;


logoutAgree.checked =
false;


logoutAgree.disabled =
true;


confirmLogout.disabled =
true;



logoutCountdown.textContent =
"Please wait 5 seconds...";




// start timer


timer =
setInterval(
()=>{


seconds--;



if(seconds > 0){


logoutCountdown.textContent =
"Please wait "
+
seconds
+
" seconds...";


}
else{


clearInterval(timer);



logoutCountdown.textContent =
"Please confirm before exit";



logoutAgree.disabled =
false;



}


},
1000
);



});





// CHECKBOX

logoutAgree?.addEventListener(
"change",
()=>{


if(
logoutAgree.checked
){


confirmLogout.disabled =
false;


}
else{


confirmLogout.disabled =
true;


}


});





// NO

cancelLogout?.addEventListener(
"click",
()=>{


logoutModal.style.display =
"none";


if(timer){

clearInterval(timer);

}


});





// YES

confirmLogout?.addEventListener(
"click",
()=>{


if(confirmLogout.disabled)
return;



localStorage.removeItem(
"currentUser"
);



localStorage.removeItem(
"currentUserId"
);



localStorage.removeItem(
"hasWithdrawPwd"
);



window.location.href =
"../index.html";


});





// click outside

window.addEventListener(
"click",
(e)=>{


if(
e.target === logoutModal
){


logoutModal.style.display =
"none";


}


});



});
