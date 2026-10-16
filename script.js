
// ========================================
// درسک | Darsak - اسکریپت مشترک سایت
// ========================================

// ---------- جست‌وجو، فیلتر و مرتب‌سازی منابع ----------

const filterButtons = document.querySelectorAll(".filter-btn");
const resourceContainer = document.querySelector(".resource-grid");
const resourceSearch = document.getElementById("resourceSearch");
const resourceSort = document.getElementById("resourceSort");

const originalCardOrder = resourceContainer
    ? Array.from(resourceContainer.querySelectorAll(".resource-card"))
    : [];

function updateResources() {
    if (!resourceContainer || !resourceSearch) return;

    const searchText = resourceSearch.value.trim().toLowerCase();
    const activeButton = document.querySelector(".filter-btn.active");
    const selectedFilter = activeButton
        ? activeButton.dataset.filter
        : "all";

    const cards = Array.from(
        resourceContainer.querySelectorAll(".resource-card")
    );

    cards.forEach(function (card) {
        const cardText = card.textContent.toLowerCase();
        const matchesSearch = cardText.includes(searchText);
        const cardType = card.dataset.type;

        const matchesFilter =
            selectedFilter === "all" || cardType === selectedFilter;

        card.classList.toggle(
            "hidden",
            !(matchesSearch && matchesFilter)
        );
    });
}

filterButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        filterButtons.forEach(function (item) {
            item.classList.remove("active");
        });

        button.classList.add("active");
        updateResources();
    });
});

if (resourceSearch) {
    resourceSearch.addEventListener("input", updateResources);
}

if (resourceSort && resourceContainer) {
    resourceSort.addEventListener("change", function () {
        let sortedCards;

        if (resourceSort.value === "newest") {
            sortedCards = [...originalCardOrder].sort(function (a, b) {
                const dateA = new Date(a.dataset.date || "2000-01-01");
                const dateB = new Date(b.dataset.date || "2000-01-01");

                return dateB - dateA;
            });
        } else {
            sortedCards = [...originalCardOrder];
        }

        sortedCards.forEach(function (card) {
            resourceContainer.appendChild(card);
        });

        updateResources();
    });
}

// ---------- انتخاب پایه تحصیلی ----------

document.querySelectorAll(".grade-button").forEach(function (button) {
    button.addEventListener("click", function () {
        const grade = button.dataset.grade;
        window.location.href = "books.html?grade=" + encodeURIComponent(grade);
    });
});
async function renderAccountMenu() {
    const loginButton = document.querySelector(
        ".site-header .login-button"
    );

    if (!loginButton) return;

    try {
        const { data, error } =
            await supabaseClient.auth.getUser();

        if (error || !data.user) return;

        const user = data.user;

        // جلوگیری از ساخت منوی تکراری
        if (document.querySelector(".account-wrapper")) return;

        const accountWrapper = document.createElement("div");
        accountWrapper.className = "account-wrapper";

        const accountButton = document.createElement("button");
        accountButton.type = "button";
        accountButton.className = "login-button account-toggle";
        accountButton.textContent = "حساب من ▾";
        accountButton.setAttribute("aria-expanded", "false");

        const accountMenu = document.createElement("div");
        accountMenu.className = "account-menu";
        accountMenu.hidden = true;

        const emailLabel = document.createElement("p");
        emailLabel.className = "account-email";
        emailLabel.textContent = user.email || "";

        const profileLink = document.createElement("a");
        profileLink.href = "profile.html";
        profileLink.textContent = "حساب کاربری";

        const purchasesLink = document.createElement("a");
        purchasesLink.href = "my-purchases.html";
        purchasesLink.textContent = "خریدهای من";

        const logoutButton = document.createElement("button");
        logoutButton.type = "button";
        logoutButton.className = "account-logout";
        logoutButton.textContent = "خروج از حساب";

        accountMenu.append(
            emailLabel,
            profileLink,
            purchasesLink,
            logoutButton
        );

        accountWrapper.append(accountButton, accountMenu);
        loginButton.replaceWith(accountWrapper);

        accountButton.addEventListener("click", function () {
            const isOpen = !accountMenu.hidden;
            accountMenu.hidden = isOpen;
            accountButton.setAttribute(
                "aria-expanded",
                String(!isOpen)
            );
        });

        logoutButton.addEventListener("click", async function () {
            logoutButton.disabled = true;
            logoutButton.textContent = "در حال خروج...";

            const { error } = await supabaseClient.auth.signOut();

            if (error) {
                logoutButton.disabled = false;
                logoutButton.textContent = "خروج از حساب";
                alert("خروج انجام نشد. لطفاً دوباره امتحان کن.");
                return;
            }

            window.location.href = "auth.html";
        });

        document.addEventListener("click", function (event) {
            if (!accountWrapper.contains(event.target)) {
                accountMenu.hidden = true;
                accountButton.setAttribute("aria-expanded", "false");
            }
        });
    } catch (error) {
        console.error("خطا در بررسی حساب کاربری:", error);
    }
}

renderAccountMenu();