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

function getMySignups() {
    return JSON.parse(localStorage.getItem("mySignups")) || [];
}

function saveMySignup(id, token) {
    const mySignups = getMySignups();

    const alreadySaved = mySignups.some(signup => signup.id === id);

    if (!alreadySaved) {
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

    spotsLeft.textContent = `${confirmed.length}/${MAX_PLAYERS} spots filled`;
}

async function updateMyStatus() {
    const signups = await getSignups();
    const mySignups = getMySignups();

    const mySignupIds = mySignups.map(signup => signup.id);
    const visibleMySignups = signups.filter(person => mySignupIds.includes(person.id));

    if (visibleMySignups.length > 0) {
        statusDiv.innerHTML = `
            <p>You signed up:</p>
            ${visibleMySignups.map(person => `
                <button class="cancel" onclick="cancelSignup('${person.id}')">
                    Cancel ${person.name}
                </button>
            `).join("")}
        `;
    } else {
        statusDiv.textContent = "";
    }
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();

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
}

);

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
    await renderLists();
    await updateMyStatus();
}

refreshPage();