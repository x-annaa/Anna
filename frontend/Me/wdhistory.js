// =====================================================
// ME HISTORY
// =====================================================
document.addEventListener("DOMContentLoaded", () => {


// =================================================
// DOM
// =================================================

const historyBtn =
    document.getElementById("me-history-Btn");

const historyModal =
    document.getElementById("me-history");

const closeHistoryBtn =
    document.getElementById("closeMeHistory");

const historyList =
    document.getElementById("meHistoryList");

const historyDetail =
    document.getElementById("meHistoryDetail");

const historyHeaderTitle =
    document.getElementById("meHistoryHeaderTitle");


// =================================================
// HISTORY STATE
// =================================================

let currentHistory = [];

let historyView = "list";


// =================================================
// OPEN HISTORY
// =================================================

historyBtn?.addEventListener(
    "click",
    async () => {

        if (!historyModal) return;

        historyView = "list";

        historyModal.style.display = "block";

        showHistoryList();

        requestAnimationFrame(() => {

            requestAnimationFrame(() => {

                historyModal.classList.add("show");

            });

        });

        await loadHistory();

    }
);


// =====================================================
// HEADER BACK BUTTON
// =====================================================

closeHistoryBtn?.addEventListener(
    "click",
    () => {

        if (historyView === "detail") {

            historyView = "list";

            showHistoryList();

            return;

        }

        closeHistory();

    }
);


// =====================================================
// CLOSE HISTORY
// =====================================================

function closeHistory() {

    if (!historyModal) return;

    historyModal.classList.remove("show");

    setTimeout(() => {

        if (
            !historyModal.classList.contains("show")
        ) {

            historyModal.style.display = "none";

            historyView = "list";

            showHistoryList();

        }

    }, 450);

}


// =====================================================
// BACKGROUND CLICK
// =====================================================

historyModal?.addEventListener(
    "click",
    (e) => {

        if (historyView === "detail") {

            return;

        }

        if (
            e.target === historyModal
        ) {

            closeHistory();

        }

    }
);


// =====================================================
// ESC
// =====================================================

document.addEventListener(
    "keydown",
    (e) => {

        if (e.key !== "Escape") return;

        if (
            !historyModal?.classList.contains("show")
        ) {

            return;

        }

        if (historyView === "detail") {

            historyView = "list";

            showHistoryList();

            return;

        }

        closeHistory();

    }
);


// =====================================================
// LOAD HISTORY
// =====================================================

async function loadHistory() {

    if (!historyList) return;

    historyList.innerHTML = `

        <div class="me-history-loading">

            Loading...

        </div>

    `;

    try {

        // =================================================
        // CURRENT USER ID
        // =================================================

        const currentUserId =
            localStorage.getItem(
                "currentUserId"
            );


        if (!currentUserId) {

            throw new Error(
                "Current user ID not found"
            );

        }


        // =================================================
        // GET USER
        // =================================================

        const {
            data: user,
            error: userError
        } =
            await supabaseClient
                .from("users")
                .select(`
                    id,
                    uuid,
                    username
                `)
                .eq(
                    "id",
                    currentUserId
                )
                .single();


        if (userError) {

            throw userError;

        }


        if (!user) {

            throw new Error(
                "User information not found"
            );

        }


        // =================================================
        // WITHDRAWALS
        // =================================================

        const {
            data: withdrawals,
            error: withdrawalError
        } =
            await supabaseClient
                .from("withdrawals")
                .select(`
                    id,
                    amount,
                    status,
                    created_at,
                    withdrawals_type,
                    note
                `)
                .eq(
                    "user_id",
                    user.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (withdrawalError) {

            throw withdrawalError;

        }


        // =================================================
        // RECHARGES
        // =================================================

        const {
            data: recharges,
            error: rechargeError
        } =
            await supabaseClient
                .from("recharges")
                .select(`
                    id,
                    amount,
                    status,
                    created_at,
                    note,
                    recharge_type
                `)
                .eq(
                    "user_id",
                    user.uuid
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (rechargeError) {

            throw rechargeError;
            

        }


        // =================================================
        // COMBINE
        // =================================================

        const history = [];


        // =================================================
        // RECHARGE
        // =================================================

        (recharges || []).forEach(
            item => {

                history.push({

                    type: "recharge",

                    id: item.id,

                    amount: item.amount,

                    status: item.status,

                    created_at:
                        item.created_at,

                    note:
                        item.note,

                    recharge_type:
                        item.recharge_type,

                    withdrawals_type:
                        null,

                    username:
                        user.username

                });

            }
        );


        // =================================================
        // WITHDRAW
        // =================================================

        (withdrawals || []).forEach(
            item => {

                history.push({

                    type: "withdraw",

                    id: item.id,

                    amount: item.amount,

                    status: item.status,

                    created_at:
                        item.created_at,

                    note:
                        item.note,

                    recharge_type:
                        null,

                    withdrawals_type:
                        item.withdrawals_type,

                    username:
                        user.username

                });

            }
        );


        // =================================================
        // NEWEST FIRST
        // =================================================

        history.sort(
            (a, b) => {

                return (
                    new Date(b.created_at) -
                    new Date(a.created_at)
                );

            }
        );


        // =================================================
        // SAVE
        // =================================================

        currentHistory = history;


        // =================================================
        // DISPLAY
        // =================================================

        displayHistory(history);

    }
    catch (error) {

        console.error(
            "Failed to load transaction history:",
            error
        );

        historyList.innerHTML = `

            <div class="me-history-error">

                Failed to load history

            </div>

        `;

    }

}


// =====================================================
// DISPLAY HISTORY LIST
// =====================================================

function displayHistory(history) {

    if (!historyList) return;

    historyList.innerHTML = "";

    if (!history.length) {

        historyList.innerHTML = `

            <div class="me-history-empty">

                No transaction history

            </div>

        `;

        return;

    }


    history.forEach(
        (item, index) => {

            const card =
                document.createElement("div");


            card.className =
                `me-history-item ${
                    item.type === "recharge"
                        ? "me-history-recharge"
                        : "me-history-withdraw"
                }`;


            card.dataset.index =
                index;


            // =================================================
            // ICON
            // =================================================

            const icon =
                document.createElement("div");


            icon.className =
                "me-history-list-icon";


            if (
                item.type === "recharge"
            ) {

                icon.innerHTML =
                    getRechargeSVG();

            }
            else {

                icon.classList.add(
                    "withdraw-list-icon"
                );

                icon.innerHTML =
                    getWithdrawSVG();

            }


            card.appendChild(icon);


            // =================================================
            // CENTER
            // =================================================

            const center =
                document.createElement("div");


            center.className =
                "me-history-list-center";


            const type =
                document.createElement("div");


            type.className =
                "me-history-list-type";


            type.textContent =
                item.type === "recharge"
                    ? "Recharge"
                    : "Withdraw";


            center.appendChild(type);


            const time =
                document.createElement("div");


            time.className =
                "me-history-list-time";


            time.textContent =
                formatDate(
                    item.created_at
                );


            center.appendChild(time);

            card.appendChild(center);


            // =================================================
            // AMOUNT
            // =================================================

            const amount =
                document.createElement("div");


            amount.className =
                `me-history-list-amount ${
                    item.type === "recharge"
                        ? "recharge-list-amount"
                        : "withdraw-list-amount"
                }`;


            amount.textContent =
                item.type === "recharge"
                    ? `+ ${formatAmount(item.amount)}`
                    : `- ${formatAmount(item.amount)}`;


            card.appendChild(amount);


            // =================================================
            // CLICK
            // =================================================

            card.addEventListener(
                "click",
                () => {

                    console.log("CLICK ITEM:", item);

                    openHistoryDetail(item);

                }
            );


            historyList.appendChild(card);

        }
    );

}


// =====================================================
// OPEN HISTORY DETAIL
// =====================================================

function openHistoryDetail(item) {

    if (
        !historyList ||
        !historyDetail
    ) {

        return;

    }

    historyView = "detail";

    historyList.style.display =
        "none";

    historyDetail.style.display =
        "block";

    if (historyHeaderTitle) {

        historyHeaderTitle.textContent =
            "Details";

    }

    historyDetail.innerHTML =
        getDetailHTML(item);

    historyDetail.scrollTop = 0;

}


// =====================================================
// SHOW HISTORY LIST
// =====================================================

function showHistoryList() {

    historyView = "list";

    if (historyList) {

        historyList.style.display =
            "block";

    }

    if (historyDetail) {

        historyDetail.style.display =
            "none";

        historyDetail.innerHTML =
            "";

    }

    if (historyHeaderTitle) {

        historyHeaderTitle.textContent =
            "History";

    }

    if (historyList) {

        historyList.scrollTop = 0;

    }

}


// =====================================================
// DETAIL HTML
// =====================================================

function getDetailHTML(item) {

    const isRecharge =
        item.type === "recharge";


    // =================================================
    // STATUS
    // =================================================

    const status =
        getDetailStatus(
            item.status
        );


    // =================================================
    // AMOUNT
    // =================================================

    const amount =
        isRecharge
            ? `+ ${formatAmount(item.amount)}`
            : `- ${formatAmount(item.amount)}`;


    // =================================================
    // AMOUNT CLASS
    // =================================================

    const amountClass =
        isRecharge
            ? "detail-recharge-amount"
            : "detail-withdraw-amount";


    // =================================================
    // ICON
    // =================================================

    const icon =
        isRecharge
            ? getRechargeSVG()
            : getWithdrawSVG();


    // =================================================
    // TRANSACTION TYPE
    // =================================================

    const transactionType =
        isRecharge
            ? item.recharge_type
            : item.withdrawals_type;


    // =================================================
    // NOTE
    // =================================================

    const hasTransactionType =
        transactionType !== null &&
        transactionType !== undefined &&
        String(transactionType).trim() !== "";


    const hasNote =
        item.note !== null &&
        item.note !== undefined &&
        String(item.note).trim() !== "";


    // =================================================
    // TRANSACTION TYPE ROW
    // =================================================

    const transactionTypeRow =
        hasTransactionType
            ? `

                <div class="
                    me-history-detail-row
                ">

                    <span class="
                        me-history-detail-label
                    ">
                        Transaction type
                    </span>

                    <span class="
                        me-history-detail-value
                    ">

                        ${escapeHTML(
                            transactionType
                        )}

                    </span>

                </div>

            `
            : "";


    // =================================================
    // NOTE ROW
    // =================================================

    const noteRow =
        hasNote
            ? `

                <div class="
                    me-history-detail-row
                ">

                    <span class="
                        me-history-detail-label
                    ">
                        Note
                    </span>

                    <span class="
                        me-history-detail-value
                    ">

                        ${escapeHTML(
                            item.note
                        )}

                    </span>

                </div>

            `
            : "";


    // =================================================
    // HTML
    // =================================================

    return `

        <!-- =========================================
             DETAIL TOP
        ========================================== -->

        <div class="
            me-history-detail-top
        ">


            <!-- =====================================
                 ICON
            ====================================== -->

            <div class="
                me-history-detail-icon
                ${
                    isRecharge
                        ? ""
                        : "withdraw-detail-icon"
                }
            ">

                ${icon}

            </div>


            <!-- =====================================
                 STATUS
            ====================================== -->

            <div class="
                me-history-detail-status
                ${status.className}
            ">

                ${status.svg}

                <span>
                    ${status.text}
                </span>

            </div>


            <!-- =====================================
                 AMOUNT
            ====================================== -->

            <div class="
                me-history-detail-amount
                ${amountClass}
            ">

                ${amount}

            </div>


        </div>


        <!-- =========================================
             INFORMATION
        ========================================== -->

        <div class="
            me-history-detail-info
        ">


            <!-- =====================================
                 USERNAME
            ====================================== -->

            <div class="
                me-history-detail-row
            ">

                <span class="
                    me-history-detail-label
                ">
                    Username
                </span>

                <span class="
                    me-history-detail-value
                ">

                    ${escapeHTML(
                        item.username ||
                        "null"
                    )}

                </span>

            </div>


            <!-- =====================================
                 TRANSACTION TIME
            ====================================== -->

            <div class="
                me-history-detail-row
            ">

                <span class="
                    me-history-detail-label
                ">
                    Transaction time
                </span>

                <span class="
                    me-history-detail-value
                ">

                    ${formatDate(
                        item.created_at
                    )}

                </span>

            </div>


            <!-- =====================================
                 TRANSACTION TYPE
                 只有有值才显示
            ====================================== -->

            ${transactionTypeRow}


            <!-- =====================================
                 STATUS
            ====================================== -->

            <div class="
                me-history-detail-row
            ">

                <span class="
                    me-history-detail-label
                ">
                    Status
                </span>

                <span class="
                    me-history-detail-value
                    ${status.className}
                ">

                    ${status.text}

                </span>

            </div>


            <!-- =====================================
                 BALANCE
            ====================================== -->

            <div class="
                me-history-detail-row
            ">

                <span class="
                    me-history-detail-label
                ">
                    Balance
                </span>

                <span class="
                    me-history-detail-value
                    ${amountClass}
                ">

                    ${amount}

                </span>

            </div>


            <!-- =====================================
                 NOTE
                 只有有值才显示
            ====================================== -->

            ${noteRow}


        </div>

    `;

}


// =====================================================
// RECHARGE SVG
// =====================================================

function getRechargeSVG() {

    return `

        <svg
            id="Layer_1"
            data-name="Layer 1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 122.88 91.98"
            aria-hidden="true"
        >

            <defs>

                <linearGradient
                    id="depositGreenHistory-${Date.now()}"
                    x1="20"
                    y1="10"
                    x2="100"
                    y2="85"
                    gradientUnits="userSpaceOnUse"
                >

                    <stop
                        offset="0%"
                        stop-color="#45E58A"
                    />

                    <stop
                        offset="45%"
                        stop-color="#18B968"
                    />

                    <stop
                        offset="100%"
                        stop-color="#056B3A"
                    />

                </linearGradient>

            </defs>


            <path
                fill="url(#depositGreenHistory-${Date.now()})"
                d="M103.85,57.91a2.47,2.47,0,0,1,2.27,1.5l16.47,28.94c.45.87.25,2.62.23,3.63H.05l0-2.5a2.47,2.47,0,0,1,.37-1.27l16.7-29a2.45,2.45,0,0,1,2.17-1.31H50L43.21,46.19a12.27,12.27,0,0,1-1.07-1.54L41.08,42.8h0a1.5,1.5,0,0,1-.31.24l-1.76,1-.31.14a4.93,4.93,0,0,1-5.84-1.3,1.6,1.6,0,0,1-.47.43l-1.76,1a1.69,1.69,0,0,1-.31.13,5,5,0,0,1-6.15-1.64A1,1,0,0,1,24,43l-1.76,1-.31.14c-5.26,2-8-2.8-10.16-6.7l-.59-1L8.52,32l-.08-.14C6.42,28,6.5,24.63,6.59,20.79c0-.65,0-1.3,0-2.21,0,0,0,0,0-.06A12.51,12.51,0,0,1,7.68,13.1,8.08,8.08,0,0,1,11,9.49L26.18.7A4.61,4.61,0,0,1,30.85.57a11.76,11.76,0,0,1,3.92,3.54l17.31,8.07.07,0c.22.1.46.2.72.33L60.71,8,89.53,57.91ZM51,48.84,60,64.58a5.05,5.05,0,0,1,6.91,1.85l11.73-6.77a5.07,5.07,0,0,1,1.85-6.91L61.7,20.14a5.08,5.08,0,0,1-6.92-1.85l-9,5.21.36.61L53.44,36.8a10.44,10.44,0,0,1,2.77-2.32,10.08,10.08,0,1,1-3.68,13.77l-.07-.12-.28.16a6.16,6.16,0,0,1-1.23.55ZM42.78,18.35,49,14.74,32.93,8a1.39,1.39,0,0,1-.55-.46,10.19,10.19,0,0,0-3.07-3,1.85,1.85,0,0,0-1.9,0L12.83,13a5.21,5.21,0,0,0-2.11,2.34c-.53,1.1-.37,2.25-.37,3.92a.31.31,0,0,1,0,.09c0,.63,0,1.45,0,2.24-.08,3.43-.52,5.4,1.15,8.64l2.6,4.29a.57.57,0,0,1,.12.18c0,.06.27.47.58,1,1.63,2.89,3.63,6.47,6.52,5.39l1.29-.75c-.45-.82-.88-1.67-1.29-2.49s-.71-1.45-1.09-2.1a1.46,1.46,0,1,1,2.53-1.47c.38.66.78,1.45,1.19,2.27,1.4,2.81,3,6,5.37,5.16l1.68-1a2.71,2.71,0,0,1,.3-.13c-.58-1-1.11-2-1.61-3-.37-.74-.71-1.44-1.09-2.1A1.46,1.46,0,1,1,31.1,34c.38.65.77,1.45,1.19,2.27,1.39,2.8,3,6,5.36,5.16l1.69-1a1.25,1.25,0,0,1,.36-.15L36.85,35.4a1.46,1.46,0,0,1,2.53-1.47l5.35,9.26c1.28,2.22,3,3.11,4.5,3a3.33,3.33,0,0,0,1.51-.45,3,3,0,0,0,.64-.48h0c0-.12.11-.18.24-.25a2.33,2.33,0,0,0,.27-.35,4.79,4.79,0,0,0,0-4.71l0-.08c-.1-.21-.22-.43-.34-.65L40.35,20a1.47,1.47,0,0,1,2.43-1.64Zm10,44.49H20.72L6.54,87H116.38l-14-24.2H85.17L68.79,72.3H83.91a2.47,2.47,0,1,1,0,4.93H42.57a2.46,2.46,0,1,1,0-4.91H58.29l-5.47-9.46Z"
            />

        </svg>

    `;

}


// =====================================================
// WITHDRAW SVG
// =====================================================

function getWithdrawSVG() {

    return `

        <svg
            viewBox="0 0 122.88 107.19"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >

            <path
                class="cls-1"
                fill="currentColor"
                d="M25.11,93.69V54.91H42.56c7.43,1.31,14.79,5.31,22.19,10H78.3c6.14.37,9.35,6.59,3.39,10.67-4.75,3.49-11,3.29-17.46,2.72-4.43-.22-4.62,5.72,0,5.75,1.61.13,3.36-.25,4.88-.25,8,0,14.63-1.54,18.67-7.88l2-4.74,20.2-10c10.09-3.32,17.27,7.23,9.83,14.57A263.86,263.86,0,0,1,74.89,102.2c-11.13,6.77-22.26,6.54-33.36,0L25.11,93.69ZM50.61,0l65.12,19.66-9.79,34.18-4.58-.7,7-25,.1-.32a4.47,4.47,0,0,0-3.12-5.48l-2.2-.6,0-.07L92.78,18.93,49.13,5.15,50.61,0ZM39.84,6.9,105,26.55,95.17,60.73,30.05,41.08,39.84,6.9ZM62.53,28.66a8.09,8.09,0,1,1,.34,11.42,8.09,8.09,0,0,1-.34-11.42ZM49.34,15.24,92.43,28.6A5.26,5.26,0,0,0,96,35.09L92.18,48.61a5.25,5.25,0,0,0-6.49,3.61L42.59,38.86A5.26,5.26,0,0,0,39,32.37l3.86-13.52a5.25,5.25,0,0,0,6.5-3.61ZM0,51.22H19.86V97.59H0V51.22Z"
            />

        </svg>

    `;

}


// =====================================================
// STATUS
// =====================================================

function getDetailStatus(status) {

    const value =
        String(
            status || "pending"
        )
        .trim()
        .toLowerCase();


    // =================================================
    // DONE
    // =================================================

    if (value === "done") {

        return {

            text:
                "Payment successful",

            className:
                "detail-status-done",

            svg: `

                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                >

                    <circle
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        stroke-width="2"
                    />

                    <path
                        d="M8 12L10.8 14.8L16 9.5"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />

                </svg>

            `

        };

    }


    // =================================================
    // CANCEL
    // =================================================

    if (value === "cancel") {

        return {

            text:
                "Payment failed",

            className:
                "detail-status-cancel",

            svg: `

                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                >

                    <circle
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        stroke-width="2"
                    />

                    <path
                        d="M9 9L15 15M15 9L9 15"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                    />

                </svg>

            `

        };

    }


    // =================================================
    // PENDING
    // =================================================

    return {

        text:
            "pending",

        className:
            "detail-status-pending",

        svg: `

            <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
            >

                <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    stroke-width="2"
                />

                <path
                    d="M12 7V12L15 14"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />

            </svg>

        `

    };

}


// =====================================================
// FORMAT AMOUNT
// =====================================================

function formatAmount(amount) {

    const number =
        Number(amount);

    if (
        Number.isNaN(number)
    ) {

        return "0.00";

    }

    return number.toFixed(2);

}


// =====================================================
// FORMAT DATE
// =====================================================

function formatDate(dateString) {

    if (!dateString) {

        return "-";

    }

    const date =
        new Date(dateString);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "-";

    }

    return (
        date.getFullYear() +
        "-" +
        String(
            date.getMonth() + 1
        ).padStart(2, "0") +
        "-" +
        String(
            date.getDate()
        ).padStart(2, "0") +
        " " +
        String(
            date.getHours()
        ).padStart(2, "0") +
        ":" +
        String(
            date.getMinutes()
        ).padStart(2, "0") +
        ":" +
        String(
            date.getSeconds()
        ).padStart(2, "0")
    );

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    return String(
        value ?? ""
    )

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}

});
