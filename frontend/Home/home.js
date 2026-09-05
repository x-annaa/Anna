/* =========================================================
   HOME.JS
   =========================================================
   Sections:
   1. Session
   2. Logout
   3. Banner
   4. Announcement Marquee
   5. Product Categories
   ========================================================= */


/* =========================================================
   homeUsername
   ========================================================= */
document.addEventListener("DOMContentLoaded",()=>{

    const username =
    localStorage.getItem("currentUser");


    const homeUsername =
    document.getElementById("homeUsername");


    if(homeUsername){

        homeUsername.textContent =
        username || "Guest";

    }

});


/* =========================================================
   1. SESSION
========================================================= */

async function checkSession() {

  const userId =
    localStorage.getItem("currentUserId");

  const sessionToken =
    localStorage.getItem("sessionToken");

  // No login information
  if (!userId || !sessionToken) {

    alert("Please log in first");

    window.location.href =
      "../index.html";

    return;
  }

  const { data, error } =
    await supabaseClient
      .from("users")
      .select("session_token")
      .eq("id", userId)
      .maybeSingle();

  // Verification failed
  if (error || !data) {

    alert(
      "Verification failed, please log in again"
    );

    window.location.href =
      "../index.html";

    return;
  }

  // Logged in elsewhere
  if (data.session_token !== sessionToken) {

    alert(
      "Your account has been logged in elsewhere"
    );

    localStorage.clear();

    window.location.href =
      "../index.html";

    return;
  }
}

checkSession();


/* =========================================================
   2. LOGOUT
========================================================= */

window.logout = async function () {

  const userId =
    localStorage.getItem("currentUserId");

  if (userId) {

    await supabaseClient
      .from("users")
      .update({
        session_token: null
      })
      .eq("id", userId);
  }

  localStorage.clear();

  window.location.href =
    "../index.html";
};


/* =========================================================
   3. HOME BANNER
========================================================= */

const adUrls = [

  "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/Photos/U91.jpg",

  "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/Photos/U92.jpg",

  "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/Photos/U93.jpg"

];


/* =========================================================
   BANNER ELEMENTS
========================================================= */

const bannerImages = [

  document.getElementById("adImage1"),

  document.getElementById("adImage2"),

  document.getElementById("adImage3")

];


const bannerItems =
  document.querySelectorAll(
    ".banner-item"
  );


const bannerLoadings = [

  document.getElementById("adLoading1"),

  document.getElementById("adLoading2"),

  document.getElementById("adLoading3")

];


/* =========================================================
   SCREEN
========================================================= */

const isLargeScreen =
  window.matchMedia(
    "(min-width: 768px)"
  );


/* =========================================================
   CURRENT MOBILE IMAGE
========================================================= */

let currentAdIndex = 0;

let mobileTimer = null;


/* =========================================================
   SHOW LOADING
========================================================= */

function showBannerLoading(index) {

  const image =
    bannerImages[index];

  const loading =
    bannerLoadings[index];


  if (image) {

    image.style.display =
      "none";

    image.style.opacity =
      "0";

  }


  if (loading) {

    loading.style.display =
      "flex";

  }

}


/* =========================================================
   SHOW IMAGE
========================================================= */

function showBannerImage(index) {

  const image =
    bannerImages[index];

  const loading =
    bannerLoadings[index];


  if (!image) {
    return;
  }


  if (loading) {

    loading.style.display =
      "none";

  }


  image.style.display =
    "block";


  requestAnimationFrame(() => {

    image.style.opacity =
      "1";

  });

}


/* =========================================================
   LOAD ONE IMAGE
========================================================= */

function loadBanner(index) {

  return new Promise((resolve) => {

    showBannerLoading(index);


    const tempImage =
      new Image();


    tempImage.onload =
      function () {

        const image =
          bannerImages[index];


        if (image) {

          image.src =
            adUrls[index];

        }


        showBannerImage(index);


        resolve(true);

      };


    tempImage.onerror =
      function () {

        /*
         * IMPORTANT:
         *
         * 不隐藏 banner
         *
         * 保持 Loading...
         *
         */

        showBannerLoading(index);


        resolve(false);

      };


    tempImage.src =
      adUrls[index];

  });

}


/* =========================================================
   LOAD ALL 3
========================================================= */

function loadAllBanners() {

  /*
   * 三张同时开始加载
   *
   * U91 成功：
   *     U91 立即显示
   *
   * U92/U93 没成功：
   *     保持 Loading...
   */

  adUrls.forEach(
    (url, index) => {

      loadBanner(index);

    }
  );

}


/* =========================================================
   MOBILE
   ONE IMAGE AT A TIME
========================================================= */

function showMobileBanner(index) {

  bannerItems.forEach(
    (item, itemIndex) => {

      if (!item) {
        return;
      }


      if (
        itemIndex === index
      ) {

        item.style.display =
          "block";

      } else {

        item.style.display =
          "none";

      }

    }
  );


  /*
   * 如果图片已经成功：
   * 显示图片
   *
   * 如果还没成功：
   * 显示 Loading
   */

  const image =
    bannerImages[index];


  const loading =
    bannerLoadings[index];


  if (
    image &&
    image.src &&
    image.src !==
      window.location.href
  ) {

    image.style.display =
      "block";

    if (loading) {

      loading.style.display =
        "none";

    }

  } else {

    if (image) {

      image.style.display =
        "none";

    }

    if (loading) {

      loading.style.display =
        "flex";

    }

  }

}


/* =========================================================
   START MOBILE ROTATION
========================================================= */

function startMobileRotation() {

  if (mobileTimer) {

    clearInterval(
      mobileTimer
    );

    mobileTimer = null;

  }


  /*
   * 立即显示 U91
   */

  currentAdIndex = 0;

  showMobileBanner(
    currentAdIndex
  );


  /*
   * 每 15 秒切换
   */

  mobileTimer =
    setInterval(() => {

      currentAdIndex =
        (
          currentAdIndex + 1
        ) %
        adUrls.length;


      showMobileBanner(
        currentAdIndex
      );

    }, 15000);

}


/* =========================================================
   DESKTOP
   SHOW ALL 3
========================================================= */

function showDesktopBanners() {

  if (mobileTimer) {

    clearInterval(
      mobileTimer
    );

    mobileTimer = null;

  }


  /*
   * 三张全部显示
   *
   * 成功 → 图片
   * 未成功 → Loading
   */

  bannerItems.forEach(
    (item, index) => {

      if (!item) {
        return;
      }


      item.style.display =
        "block";


      const image =
        bannerImages[index];


      const loading =
        bannerLoadings[index];


      if (
        image &&
        image.src &&
        image.src !==
          window.location.href
      ) {

        image.style.display =
          "block";

        if (loading) {

          loading.style.display =
            "none";

        }

      } else {

        if (image) {

          image.style.display =
            "none";

        }

        if (loading) {

          loading.style.display =
            "flex";

        }

      }

    }
  );

}


/* =========================================================
   RESPONSIVE
========================================================= */

function updateBannerLayout() {

  if (
    isLargeScreen.matches
  ) {

    showDesktopBanners();

  } else {

    startMobileRotation();

  }

}


/* =========================================================
   INITIAL LOAD
========================================================= */

loadAllBanners();

updateBannerLayout();


/* =========================================================
   SCREEN SIZE CHANGE
========================================================= */

isLargeScreen.addEventListener(
  "change",
  updateBannerLayout
);


/* =========================================================
   4. ANNOUNCEMENT MARQUEE
========================================================= */

function animateMarquee() {

  const wrapper =
    document.querySelector(
      ".container-h4"
    );

  const marqueeText =
    document.querySelector(
      ".container-h5"
    );

  if (!wrapper || !marqueeText) {
    return;
  }

  let position =
    wrapper.offsetWidth;

  const speed = 1;

  let paused = false;

  function step() {

    if (!paused) {

      position -= speed;

      marqueeText.style.transform =
        `translateX(${position}px)`;

      const textWidth =
        marqueeText.offsetWidth;

      if (
        position <
        -textWidth
      ) {

        paused = true;

        setTimeout(() => {

          position =
            wrapper.offsetWidth;

          marqueeText.style.transform =
            `translateX(${position}px)`;

          paused = false;

        }, 3000);
      }
    }

    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}


/*
   Start marquee without waiting
   for all remote images.
*/

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    animateMarquee
  );

} else {

  animateMarquee();
}


/* =========================================================
   5. PRODUCT CATEGORIES
========================================================= */

const categoryBtns =
  document.querySelectorAll(
    ".container-h9"
  );

const adItems =
  document.querySelectorAll(
    ".ad-item"
  );


/* ---------------------------------------------------------
   Product Data
--------------------------------------------------------- */

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

    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/c7.jpg",

    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/c8.jpg"

  ],

  watch: [

    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/w6.jpg",

    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/w2.jpg",

    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/w3.jpg",

    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/w4.jpg"

  ],

  shoe: [

    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/s7.jpg",

    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/s2.jpg",

    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/s6.jpg",

    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/s4.jpg"

  ],

  backpack: [

    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/b1.jpg",

    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/b2.jpg",

    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/b3.jpg",

    "https://uiwttxqdoplttyrfqcbb.supabase.co/storage/v1/object/public/Photos/b4.jpg"

  ]

};


/* ---------------------------------------------------------
   Product Loading
--------------------------------------------------------- */

function showProductLoading(item) {

  item.classList.remove("hidden");

  item.innerHTML = `
    <div class="product-loading">
      <div class="product-spinner"></div>
      <span>Loading...</span>
    </div>
  `;
}


/* ---------------------------------------------------------
   Product Error
--------------------------------------------------------- */

function showProductError(item) {

  item.innerHTML = `
    <div class="product-error">
      <span class="product-error-icon">!</span>
      <span>Network unavailable</span>
    </div>
  `;
}


/* ---------------------------------------------------------
   Load Product Image
--------------------------------------------------------- */

function loadProductImage(
  item,
  imageUrl,
  category
) {

  showProductLoading(item);

  const image =
    new Image();

  image.onload = function () {

    item.innerHTML = "";

    const img =
      document.createElement("img");

    img.src =
      imageUrl;

    img.alt =
      category;

    item.appendChild(img);
  };

  image.onerror = function () {

    showProductError(item);
  };

  image.src =
    imageUrl;
}


/* ---------------------------------------------------------
   Update Products
--------------------------------------------------------- */

function updateAds(category) {

  const urls =
    adsData[category];

  if (!urls) {
    return;
  }

  let index = 0;

  adItems.forEach(item => {

    if (
      item.dataset.category ===
      category
    ) {

      item.classList.remove(
        "hidden"
      );

      loadProductImage(
        item,
        urls[index],
        category
      );

      index++;

    } else {

      item.classList.add(
        "hidden"
      );

      item.innerHTML = "";
    }

  });
}


/* ---------------------------------------------------------
   Category Buttons
--------------------------------------------------------- */

categoryBtns.forEach(btn => {

  btn.addEventListener(
    "click",
    () => {

      categoryBtns.forEach(
        button => {

          button.classList.remove(
            "active"
          );

        }
      );

      btn.classList.add(
        "active"
      );

      const category =
        btn.dataset.category;

      updateAds(category);

    }
  );

});


/* ---------------------------------------------------------
   Initial Category
--------------------------------------------------------- */

updateAds("phone");
