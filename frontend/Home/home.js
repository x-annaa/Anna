async function checkSession() {
  const userId = localStorage.getItem("currentUserId");
  const sessionToken = localStorage.getItem("sessionToken");

  if (!userId || !sessionToken) {
    alert("Please log in first");
    window.location.href = "../index.html";
    return;
  }

  const { data, error } = await supabaseClient
    .from("users")
    .select("session_token")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    alert("Verification failed, please log in again");
    window.location.href = "../index.html";
    return;
  }

  if (data.session_token !== sessionToken) {
    alert("Your account has been logged in elsewhere");
    localStorage.clear();
    window.location.href = "../index.html";
  }
}

checkSession();

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

const adUrls = [
  "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/Photos/U91.jpg",
  "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/Photos/U92.jpg",
  "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/Photos/U93.jpg"
];

let currentAdIndex = 0;
const adImage = document.getElementById("adImage");

function showAd(index) {
  if (adImage) {
    adImage.style.opacity = 0;
    setTimeout(() => {
      adImage.src = adUrls[index];
      adImage.style.opacity = 1;
    }, 300);
  }
}

showAd(currentAdIndex);

setInterval(() => {
  currentAdIndex = (currentAdIndex + 1) % adUrls.length;
  showAd(currentAdIndex);
}, 15000);

const marqueeText = document.querySelector(".container-h5");

function animateMarquee() {
  const wrapper = document.querySelector(".container-h5");
  const wrapperWidth = wrapper.offsetWidth;
  const textWidth = marqueeText.offsetWidth;
  let pos = wrapperWidth;
  const speed = 1;
  let paused = false;

  function step() {
    if (!paused) {
      pos -= speed;
      marqueeText.style.transform = `translateX(${pos}px)`;

      if (pos < -textWidth) {
        paused = true;
        setTimeout(() => {
          pos = wrapperWidth;
          paused = false;
        }, 3000);
      }
    }

    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

window.addEventListener("load", animateMarquee);

const categoryBtns = document.querySelectorAll(".container-h9");
const adItems = document.querySelectorAll(".ad-item");

const adsData = {
  phone: [
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/p1.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/p2.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/p3.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/p4.jpg"
  ],
  clothes: [
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/c1.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/c2.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/c5.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/c7.jpg"
  ],
  watch: [
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/w6.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/w2.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/w3.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/w4.jpg"
  ],
  shoe: [
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/s5.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/s2.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/s3.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/s4.jpg"
  ],
  backpack: [
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/b1.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/b2.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/b3.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/b4.jpg"
  ]
};

updateAds("phone");

categoryBtns.forEach(btn => {
  btn.addEventListener("click", () => {

    categoryBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");


    const category = btn.dataset.category;
    updateAds(category);
  });
});

function updateAds(category) {

  let idx = 0;
  adItems.forEach(item => {
    if (item.dataset.category === category) {
      item.classList.remove("hidden");
      item.innerHTML = `<img src="${adsData[category][idx]}" alt="${category}">`;
      idx++;
    } else {
      item.classList.add("hidden");
      item.innerHTML = "";
    }
  });
}
