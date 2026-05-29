const MAX_PLAYERS = 24;

const SUPABASE_URL = "https://unlnzhctvydpbtrpvoai.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVubG56aGN0dnlkcGJ0cnB2b2FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTc0NDIsImV4cCI6MjA5NTYzMzQ0Mn0.UlZE8uslUR4VziAeW7uc8i12DZPsO8y7hSoN8YKx5CQ";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

const form = document.getElementById("signup-form");
const statusDiv = document.getElementById("status");

const confirmedList = document.getElementById("confirmed-list");
const waitlistList = document.getElementById("waitlist-list");
const spotsLeft = document.getElementById("spots-left");

function isSignupOpen() {
    const now = new Date();

    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // JS days:
    // Sunday = 0
    // Monday = 1
    // Tuesday = 2
    // Wednesday = 3
    // Thursday = 4
    // Friday = 5
    // Saturday = 6

    const isAfterThursdayOpen =
        day > 4 ||
        (day === 4 && (hour > 8 || (hour === 8 && minute >= 0)));

    const isBeforeTuesdayClose =
        day < 2 ||
        (day === 2 && hour < 12);

    return isAfterThursdayOpen || isBeforeTuesdayClose;
}

function getMySignups() {
    return JSON.parse(localStorage.getItem("mySignups")) || [];
}

function saveMySignup(id, token) {
    const mySignups = getMySignups();

    if (!mySignups.some(signup => signup.id === id)) {
        mySignups.push({ id: id, token: token });
    }

    localStorage.setItem("mySignups", JSON.stringify(mySignups));
}

function removeMySignup(id) {
    const mySignups = getMySignups().filter(signup => signup.id !== id);
    localStorage.setItem("mySignups", JSON.stringify(mySignups));
}

async function getSignups() {
    const { data, error } = await supabaseClient
        .from("signups")
        .select("id, name, phone, status, created_at")
        .is("cancelled_at", null)
        .order("created_at", { ascending: true });

    if (error) {
        console.error(error);
        statusDiv.textContent = "Error loading signups.";
        return [];
    }

    return data;
}

async function renderLists() {
    const signups = await getSignups();

    const confirmed = signups.filter(person => person.status === "confirmed");
    const waitlist = signups.filter(person => person.status === "waitlist");

    confirmedList.innerHTML = "";
    waitlistList.innerHTML = "";

    confirmed.forEach(person => {
        const li = document.createElement("li");
        li.textContent = person.name;
        confirmedList.appendChild(li);
    });

    waitlist.forEach(person => {
        const li = document.createElement("li");
        li.textContent = person.name;
        waitlistList.appendChild(li);
    });

    const remaining = MAX_PLAYERS - confirmed.length;

    if (remaining > 0) {
        spotsLeft.textContent = `${remaining} spot${remaining === 1 ? "" : "s"} remaining`;
    } else {
        spotsLeft.textContent = "FULL — new signups go to the waitlist";
    }
}

async function updateMyStatus() {
    const signups = await getSignups();
    const mySignups = getMySignups();

    const mySignupIds = mySignups.map(signup => signup.id);
    const visibleMySignups = signups.filter(person => mySignupIds.includes(person.id));

    let html = "";

    if (!isSignupOpen()) {
        html += `
            <div style="
                background:#c53030;
                color:white;
                padding:12px;
                border-radius:8px;
                margin-bottom:15px;
                font-size:18px;
                font-weight:bold;
            ">
                Signup for this week is CLOSED.<br>
                Signup opens Thursday at 8:00 AM.
            </div>
        `;

        form.style.display = "none";
    } else {
        html += `
            <div style="
                background:#2f855a;
                color:white;
                padding:12px;
                border-radius:8px;
                margin-bottom:15px;
                font-size:18px;
                font-weight:bold;
            ">
                Signup is OPEN.<br>
                Signup closes Tuesday at 12:00 PM.
            </div>
        `;

        form.style.display = "block";
    }

    if (visibleMySignups.length > 0) {
        html += `
            <p>You signed up:</p>
            ${visibleMySignups.map(person => `
                <button class="cancel" onclick="cancelSignup('${person.id}')">
                    Cancel ${person.name}
                </button>
            `).join("")}
        `;
    }

    statusDiv.innerHTML = html;
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!isSignupOpen()) {
        statusDiv.textContent = "Signup is closed. It opens Thursday at 8:00 AM.";
        return;
    }

    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();

    if (!name) {
        statusDiv.textContent = "Please enter a name.";
        return;
    }

    const signups = await getSignups();
    const confirmedCount = signups.filter(person => person.status === "confirmed").length;

    const newStatus = confirmedCount < MAX_PLAYERS ? "confirmed" : "waitlist";

    const { data, error } = await supabaseClient
        .from("signups")
        .insert([
            {
                name: name,
                phone: phone || null,
                status: newStatus
            }
        ])
        .select("id, signup_token")
        .single();

    if (error) {
        console.error(error);
        statusDiv.textContent = "Error signing up.";
        return;
    }

    saveMySignup(data.id, data.signup_token);

    form.reset();
    await refreshPage();
});

async function cancelSignup(id) {
    const mySignups = getMySignups();
    const mySignup = mySignups.find(signup => signup.id === id);

    if (!mySignup) {
        statusDiv.textContent = "This signup was not created from this device.";
        return;
    }

    const { error } = await supabaseClient.rpc("cancel_signup_by_token", {
        p_signup_id: mySignup.id,
        p_signup_token: mySignup.token
    });

    if (error) {
        console.error(error);
        statusDiv.textContent = "Error canceling signup.";
        return;
    }

    removeMySignup(id);
    await refreshPage();
}

async function refreshPage() {
    await maybeResetForNewWeek();
    await renderLists();
    await updateMyStatus();
}
async function maybeResetForNewWeek() {

    const now = new Date();

    const day = now.getDay();
    const hour = now.getHours();

    if (!(day === 4 && hour >= 8)) {
        return;
    }

    const { data } = await supabaseClient
        .from("site_settings")
        .select("value")
        .eq("key", "last_reset")
        .single();

    const lastReset = new Date(data.value);

    const thisThursday = new Date(now);

    thisThursday.setDate(
        now.getDate() - ((day + 7 - 4) % 7)
    );

    thisThursday.setHours(8, 0, 0, 0);

    if (lastReset >= thisThursday) {
        return;
    }

    await supabaseClient.rpc("reset_for_new_week");
}
refreshPage();