const SUPABASE_URL = "https://unlnzhctvydpbtrpvoai.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVubG56aGN0dnlkcGJ0cnB2b2FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTc0NDIsImV4cCI6MjA5NTYzMzQ0Mn0.UlZE8uslUR4VziAeW7uc8i12DZPsO8y7hSoN8YKx5CQ";
const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);
// Change this to whatever password you want.
// This is okay for testing, but not strong security for production.
const ADMIN_PASSWORD = "superSecret";

const loginBox = document.getElementById("login-box");
const adminPanel = document.getElementById("admin-panel");
const passwordInput = document.getElementById("admin-password");
const loginButton = document.getElementById("login-button");

const refreshButton = document.getElementById("refresh-button");
const clearButton = document.getElementById("clear-button");

const addNameInput = document.getElementById("add-name");
const addPhoneInput = document.getElementById("add-phone");
const addConfirmedButton = document.getElementById("add-confirmed-button");
const addWaitlistButton = document.getElementById("add-waitlist-button");

const adminList = document.getElementById("admin-list");
const adminStatus = document.getElementById("admin-status");

function isLoggedIn() {
    return sessionStorage.getItem("adminLoggedIn") === "true";
}

function setLoggedIn() {
    sessionStorage.setItem("adminLoggedIn", "true");
}

function showAdminPanel() {
    loginBox.style.display = "none";
    adminPanel.style.display = "block";
    loadAdminList();
}

loginButton.addEventListener("click", () => {
    if (passwordInput.value === ADMIN_PASSWORD) {
        setLoggedIn();
        showAdminPanel();
    } else {
        adminStatus.textContent = "Wrong password.";
    }
});

refreshButton.addEventListener("click", loadAdminList);

clearButton.addEventListener("click", async () => {
    const confirmed = confirm("Clear all signups?");

    if (!confirmed) {
        return;
    }

    const { error } = await supabaseClient.rpc("admin_clear_signups");

    if (error) {
        console.error(error);
        adminStatus.textContent = "Error clearing signups.";
        return;
    }

    adminStatus.textContent = "All signups cleared.";
    await loadAdminList();
});

addConfirmedButton.addEventListener("click", () => {
    adminAddPerson("confirmed");
});

addWaitlistButton.addEventListener("click", () => {
    adminAddPerson("waitlist");
});

async function adminAddPerson(status) {
    const name = addNameInput.value.trim();
    const phone = addPhoneInput.value.trim();

    if (!name) {
        adminStatus.textContent = "Enter a name.";
        return;
    }

    const { error } = await supabaseClient.rpc("admin_add_signup", {
        p_name: name,
        p_phone: phone,
        p_status: status
    });

    if (error) {
        console.error(error);
        adminStatus.textContent = "Error adding person.";
        return;
    }

    addNameInput.value = "";
    addPhoneInput.value = "";

    adminStatus.textContent = "Person added.";
    await loadAdminList();
}

async function getSignups() {
    const { data, error } = await supabaseClient
        .from("signups")
        .select("id, name, phone, status, created_at")
        .is("cancelled_at", null)
        .order("created_at", { ascending: true });

    if (error) {
        console.error(error);
        adminStatus.textContent = "Error loading signups.";
        return [];
    }

    return data;
}

async function loadAdminList() {
    const signups = await getSignups();

    if (signups.length === 0) {
        adminList.innerHTML = "<p>No active signups.</p>";
        return;
    }

    adminList.innerHTML = signups.map((person, index) => `
        <div style="border:1px solid #ccc;padding:12px;margin-bottom:12px;border-radius:8px;">
            <strong>${index + 1}. ${person.name}</strong>
            <div>Status: ${person.status}</div>
            <div>Phone: ${person.phone || "none"}</div>

            <button onclick="changeStatus('${person.id}','confirmed')">
                Move to Confirmed
            </button>

            <button onclick="changeStatus('${person.id}','waitlist')">
                Move to Waitlist
            </button>

            <button class="cancel" onclick="cancelPerson('${person.id}')">
                Remove
            </button>
        </div>
    `).join("");
}

async function changeStatus(id, status) {
    const { error } = await supabaseClient.rpc("admin_change_status", {
        p_signup_id: id,
        p_status: status
    });

    if (error) {
        console.error(error);
        adminStatus.textContent = "Error changing status.";
        return;
    }

    adminStatus.textContent = "Status updated.";
    await loadAdminList();
}

async function cancelPerson(id) {
    const confirmed = confirm("Remove this person?");

    if (!confirmed) {
        return;
    }

    const { error } = await supabaseClient.rpc("admin_cancel_signup", {
        p_signup_id: id
    });

    if (error) {
        console.error(error);
        adminStatus.textContent = "Error removing person.";
        return;
    }

    adminStatus.textContent = "Person removed.";
    await loadAdminList();
}

if (isLoggedIn()) {
    showAdminPanel();
}