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
  "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/Phones/U9shopping.jpg",
  "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/Phones/U9shopping.jpg",
  "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/Phones/U9shopping.jpg"
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

const marqueeText = document.querySelector(".marquee-text");

function animateMarquee() {
  const wrapper = document.querySelector(".marquee-wrapper");
  const wrapperWidth = wrapper.offsetWidth;
  const textWidth = marqueeText.offsetWidth;
  let pos = -textWidth;
  const speed = 1;

  function step() {
    pos += speed;
    if (pos > wrapperWidth) {
      pos = -textWidth;
    }
    marqueeText.style.transform = `translateX(${pos}px)`;
    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

window.addEventListener("load", animateMarquee);

const categoryBtns = document.querySelectorAll(".category-btn");
const adItems = document.querySelectorAll(".ad-item");

const adsData = {
  phone: [
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/Phones/iPhone17ProMax.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/Phones/iPhone15ProMax.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/Phones/GooglePixel9.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/Phones/GalaxyS25Ultra.jpg"
  ],
  clothes: [
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/Phones/ZARA.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/Phones/GUCCI.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/Phones/Adidas.jpg",
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/Phones/ZARAHighWaist.jpg"
  ],
  car: [
    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/Phones/Swissgoldenwristwatch.jpg",
    "https://via.placeholder.com/200x200?text=汽车2",
    "https://via.placeholder.com/200x200?text=汽车3",
    "https://via.placeholder.com/200x200?text=汽车4"
  ],
  cosmetics: [
    "https://via.placeholder.com/200x200?text=化妆品1",
    "https://via.placeholder.com/200x200?text=化妆品2",
    "https://via.placeholder.com/200x200?text=化妆品3",
    "https://via.placeholder.com/200x200?text=化妆品4"
  ],
  diamond: [
    "https://via.placeholder.com/200x200?text=钻石1",
    "https://via.placeholder.com/200x200?text=钻石2",
    "https://via.placeholder.com/200x200?text=钻石3",
    "https://via.placeholder.com/200x200?text=钻石4"
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
