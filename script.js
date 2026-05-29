const MAX_PLAYERS = 24;

const form = document.getElementById("signup-form");
const cancelButton = document.getElementById("cancel-button");
const statusDiv = document.getElementById("status");

const confirmedList = document.getElementById("confirmed-list");
const waitlistList = document.getElementById("waitlist-list");
const spotsLeft = document.getElementById("spots-left");

function getSignups() {
    return JSON.parse(localStorage.getItem("signups")) || [];
}

function saveSignups(signups) {
    localStorage.setItem("signups", JSON.stringify(signups));
}

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

function renderLists() {
    const signups = getSignups();

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

function updateMyStatus() {
    const signups = getSignups();
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

    form.style.display = "block";
    cancelButton.style.display = "none";
}

function promoteWaitlist(signups) {
    const confirmed = signups.filter(person => person.status === "confirmed");
    const waitlist = signups.filter(person => person.status === "waitlist");

    if (confirmed.length < MAX_PLAYERS && waitlist.length > 0) {
        waitlist[0].status = "confirmed";
    }

    return signups;
}

form.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();

    if (!name) {
        statusDiv.textContent = "Please enter a name.";
        return;
    }

    let signups = getSignups();

    const confirmedCount = signups.filter(person => person.status === "confirmed").length;

    const newPerson = {
        id: crypto.randomUUID(),
        name: name,
        phone: phone,
        status: confirmedCount < MAX_PLAYERS ? "confirmed" : "waitlist",
        createdAt: new Date().toISOString()
    };

    signups.push(newPerson);
    saveSignups(signups);
    saveMySignupId(newPerson.id);

    form.reset();
    renderLists();
    updateMyStatus();
});

function cancelSignup(id) {
    let signups = getSignups();

    signups = signups.filter(person => person.id !== id);
    signups = promoteWaitlist(signups);

    saveSignups(signups);
    removeMySignupId(id);

    renderLists();
    updateMyStatus();
}

renderLists();
updateMyStatus();