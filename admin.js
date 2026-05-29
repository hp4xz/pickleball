const SUPABASE_URL = "https://unlnzhctvydpbtrpvoai.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVubG56aGN0dnlkcGJ0cnB2b2FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTc0NDIsImV4cCI6MjA5NTYzMzQ0Mn0.UlZE8uslUR4VziAeW7uc8i12DZPsO8y7hSoN8YKx5CQ";
const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

const loginBox = document.getElementById("login-box");
const adminPanel = document.getElementById("admin-panel");
const emailInput = document.getElementById("admin-email");
const passwordInput = document.getElementById("admin-password");
const loginButton = document.getElementById("login-button");
const logoutButton = document.getElementById("logout-button");

const refreshButton = document.getElementById("refresh-button");
const newWeekButton = document.getElementById("new-week-button");

const addNameInput = document.getElementById("add-name");
const addPhoneInput = document.getElementById("add-phone");
const addPlayerButton = document.getElementById("add-player-button");
const shuffleButton = document.getElementById("shuffle-button");

const adminList = document.getElementById("admin-list");
const adminStatus = document.getElementById("admin-status");
shuffleButton.addEventListener("click", shuffleCourts);
async function shuffleCourts() {

    const signups = await getSignups();

    const players = signups
        .filter(p => p.status === "confirmed")
        .map(p => p.name);

    if (players.length === 0) {
        adminStatus.textContent = "No confirmed players.";
        return;
    }

    for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [players[i], players[j]] =
            [players[j], players[i]];
    }

    await supabaseClient.rpc(
        "clear_court_assignments"
    );

    const rows = [];

    for (let i = 0; i < players.length; i++) {

        const courtNumber =
            Math.floor(i / 4) + 1;

        const pairNumber =
            Math.floor((i % 4) / 2) + 1;

        rows.push({
            court_number: courtNumber,
            pair_number: pairNumber,
            player_name: players[i]
        });
    }

    const { error } = await supabaseClient
        .from("court_assignments")
        .insert(rows);

    if (error) {
        console.error(error);
        adminStatus.textContent =
            "Shuffle failed.";
        return;
    }

    adminStatus.textContent =
        "Courts shuffled.";
}
async function checkSession() {
    const { data } = await supabaseClient.auth.getSession();

    if (data.session) {
        showAdminPanel();
    }
}

function showAdminPanel() {
    loginBox.style.display = "none";
    adminPanel.style.display = "block";
    loadAdminList();
}

function showLogin() {
    loginBox.style.display = "block";
    adminPanel.style.display = "none";
}

loginButton.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    const { error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        console.error(error);
        adminStatus.textContent = "Login failed.";
        return;
    }

    adminStatus.textContent = "";
    showAdminPanel();
});

logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    showLogin();
});

refreshButton.addEventListener("click", loadAdminList);

newWeekButton.addEventListener("click", async () => {
    const confirmed = confirm("Start a new week? This clears all current signups.");

    if (!confirmed) {
        return;
    }

    const { error } = await supabaseClient.rpc("admin_start_new_week");

    if (error) {
        console.error(error);
        adminStatus.textContent = "Error starting new week.";
        return;
    }

    adminStatus.textContent = "New week started.";
    await loadAdminList();
});

addPlayerButton.addEventListener("click", async () => {
    const name = addNameInput.value.trim();
    const phone = addPhoneInput.value.trim();

    if (!name) {
        adminStatus.textContent = "Enter a name.";
        return;
    }

    const { error } = await supabaseClient.rpc("admin_add_signup_smart", {
        p_name: name,
        p_phone: phone
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
});

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

            <button onclick="changeStatus('${person.id}', 'confirmed')">
                Move to Confirmed
            </button>

            <button onclick="changeStatus('${person.id}', 'waitlist')">
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

checkSession();