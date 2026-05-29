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

function getMySignupIds() {
    return JSON.parse(localStorage.getItem("mySignupIds")) || [];
}

function saveMySignupId(id) {
    const ids = getMySignupIds();

    if (!ids.includes(id)) {
        ids.push(id);
    }

    localStorage.setItem("mySignupIds", JSON.stringify(ids));
}

function removeMySignupId(id) {
    const ids = getMySignupIds().filter(savedId => savedId !== id);
    localStorage.setItem("mySignupIds", JSON.stringify(ids));
}

async function getSignups() {
    const { data, error } = await supabaseClient
        .from("signups")
        .select("*")
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
    const mySignupIds = getMySignupIds();

    const mySignups = signups.filter(person => mySignupIds.includes(person.id));

    if (mySignups.length > 0) {
        statusDiv.innerHTML = `
            <p>You signed up:</p>
            ${mySignups.map(person => `
                <button class="cancel" onclick="cancelSignup('${person.id}')">
                    Cancel ${person.name}
                </button>
            `).join("")}
        `;
    } else {
        statusDiv.textContent = "";
    }
}

async function promoteWaitlist() {
    const signups = await getSignups();

    const confirmed = signups.filter(person => person.status === "confirmed");
    const waitlist = signups.filter(person => person.status === "waitlist");

    if (confirmed.length < MAX_PLAYERS && waitlist.length > 0) {
        const nextPerson = waitlist[0];

        const { error } = await supabaseClient
            .from("signups")
            .update({ status: "confirmed" })
            .eq("id", nextPerson.id);

        if (error) {
            console.error(error);
        }
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
        .select()
        .single();

    if (error) {
        console.error(error);
        statusDiv.textContent = "Error signing up.";
        return;
    }

    saveMySignupId(data.id);

    form.reset();

    await renderLists();
    await updateMyStatus();
});

async function cancelSignup(id) {
    const { error } = await supabaseClient
        .from("signups")
        .update({ cancelled_at: new Date().toISOString() })
        .eq("id", id);

    if (error) {
        console.error(error);
        statusDiv.textContent = "Error canceling signup.";
        return;
    }

    removeMySignupId(id);

    await promoteWaitlist();
    await renderLists();
    await updateMyStatus();
}

async function refreshPage() {
    await renderLists();
    await updateMyStatus();
}

refreshPage();