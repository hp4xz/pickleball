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

const publishManualCourtsButton = document.getElementById("publish-manual-courts-button");
const clearManualCourtsButton = document.getElementById("clear-manual-courts-button");
const autoShuffleToggle = document.getElementById("auto-shuffle-toggle");

const adminCourtsViewSection = document.getElementById("admin-courts-view-section");
const manualCourtsSection = document.getElementById("manual-courts-section");

const publishedCourtsContainer = document.getElementById("published-courts-container");
const manualCourtsContainer = document.getElementById("manual-courts-container");
const manualValidationMessage = document.getElementById("manual-validation-message");

const adminList = document.getElementById("admin-list");
const adminStatus = document.getElementById("admin-status");

let currentSignups = [];
let currentPublishedAssignments = [];
let isLoadingSettings = false;

shuffleButton.addEventListener("click", shuffleCourts);
publishManualCourtsButton.addEventListener("click", publishManualCourtAssignments);
clearManualCourtsButton.addEventListener("click", clearDraftAssignments);
autoShuffleToggle.addEventListener("change", saveAutoShuffleSetting);

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
        [players[i], players[j]] = [players[j], players[i]];
    }

    const rows = [];

    for (let i = 0; i < players.length; i++) {
        rows.push({
            court_number: Math.floor(i / 4) + 1,
            pair_number: Math.floor((i % 4) / 2) + 1,
            player_name: players[i]
        });
    }

    const { error } = await supabaseClient.rpc(
        "admin_save_court_assignments",
        {
            assignments: rows
        }
    );

    if (error) {
        console.error(error);
        adminStatus.textContent = "Shuffle failed.";
        return;
    }

    adminStatus.textContent = "Courts randomly shuffled and published.";
    await loadAdminList();
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
    adminCourtsViewSection.style.display = "block";
    manualCourtsSection.style.display = "block";

    loadAdminSettings();
    loadAdminList();
}

function showLogin() {
    loginBox.style.display = "block";
    adminPanel.style.display = "none";
    adminCourtsViewSection.style.display = "none";
    manualCourtsSection.style.display = "none";
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
    const confirmed = confirm("Start a new week? This clears all current signups and court assignments.");

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

async function loadAdminSettings() {
    isLoadingSettings = true;

    const { data, error } = await supabaseClient.rpc("admin_get_auto_shuffle_enabled");

    if (error) {
        console.error(error);
        adminStatus.textContent = "Error loading auto-shuffle setting.";
        autoShuffleToggle.checked = true;
        isLoadingSettings = false;
        return;
    }

    autoShuffleToggle.checked = data === true;
    isLoadingSettings = false;
}

async function saveAutoShuffleSetting() {
    if (isLoadingSettings) {
        return;
    }

    const { error } = await supabaseClient.rpc("admin_set_auto_shuffle_enabled", {
        p_enabled: autoShuffleToggle.checked
    });

    if (error) {
        console.error(error);
        adminStatus.textContent = "Error saving auto-shuffle setting.";
        await loadAdminSettings();
        return;
    }

    adminStatus.textContent = autoShuffleToggle.checked
        ? "Automatic shuffling turned on."
        : "Automatic shuffling turned off.";
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

async function getCourtAssignments() {
    const { data, error } = await supabaseClient
        .from("court_assignments")
        .select("court_number, pair_number, player_name")
        .order("court_number", { ascending: true })
        .order("pair_number", { ascending: true })
        .order("id", { ascending: true });

    if (error) {
        console.error(error);
        adminStatus.textContent = "Error loading court assignments.";
        return [];
    }

    return data;
}

async function loadAdminList() {
    const signups = await getSignups();
    const assignments = await getCourtAssignments();

    currentSignups = signups;
    currentPublishedAssignments = assignments;

    renderAdminSignupList(signups);
    renderCourtVisual(publishedCourtsContainer, assignments);
    renderManualCourtBuilder(signups, assignments);
    updateDraftPreviewAndValidation();
}

function renderAdminSignupList(signups) {
    if (signups.length === 0) {
        adminList.innerHTML = "<p>No active signups.</p>";
        return;
    }

    adminList.innerHTML = signups.map((person, index) => `
        <div style="border:1px solid #ccc;padding:12px;margin-bottom:12px;border-radius:8px;">
            <strong>${index + 1}. ${escapeHtml(person.name)}</strong>
            <div>Status: ${escapeHtml(person.status)}</div>
            <div>Phone: ${escapeHtml(person.phone || "none")}</div>

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

function renderManualCourtBuilder(signups, assignments) {
    const confirmedPlayers = signups.filter(person => person.status === "confirmed");

    const selectedPlayersByPublishedAssignment = buildSelectedPlayersFromAssignments(
        confirmedPlayers,
        assignments
    );

    manualCourtsContainer.innerHTML = "";

    for (let court = 1; court <= 6; court++) {
        const courtCard = document.createElement("div");
        courtCard.className = "manual-court-card";

        let html = `<h3>Court ${court}</h3>`;

        for (let pair = 1; pair <= 2; pair++) {
            html += `<div class="manual-pair-title">Pair ${pair}</div>`;

            for (let slot = 1; slot <= 2; slot++) {
                const selectedId =
                    selectedPlayersByPublishedAssignment[`${court}-${pair}-${slot}`] || "";

                html += `
                    <select
                        class="manual-player-select"
                        data-court="${court}"
                        data-pair="${pair}"
                        data-slot="${slot}"
                    >
                        <option value="">Empty</option>
                        ${confirmedPlayers.map(player => `
                            <option value="${escapeAttribute(player.id)}" ${player.id === selectedId ? "selected" : ""}>
                                ${escapeHtml(player.name)}
                            </option>
                        `).join("")}
                    </select>
                `;
            }
        }

        courtCard.innerHTML = html;
        manualCourtsContainer.appendChild(courtCard);
    }

    document.querySelectorAll(".manual-player-select").forEach(select => {
        select.addEventListener("change", updateDraftPreviewAndValidation);
    });
}

function buildSelectedPlayersFromAssignments(confirmedPlayers, assignments) {
    const result = {};
    const usedPlayerIds = new Set();

    for (let court = 1; court <= 6; court++) {
        for (let pair = 1; pair <= 2; pair++) {
            const pairAssignments = assignments.filter(assignment =>
                assignment.court_number === court &&
                assignment.pair_number === pair
            );

            for (let slot = 1; slot <= 2; slot++) {
                const assignment = pairAssignments[slot - 1];

                if (!assignment) {
                    continue;
                }

                const matchingPlayer = confirmedPlayers.find(player =>
                    player.name === assignment.player_name &&
                    !usedPlayerIds.has(player.id)
                );

                if (matchingPlayer) {
                    result[`${court}-${pair}-${slot}`] = matchingPlayer.id;
                    usedPlayerIds.add(matchingPlayer.id);
                }
            }
        }
    }

    return result;
}

function getDraftAssignmentsFromForm() {
    const selects = Array.from(document.querySelectorAll(".manual-player-select"));

    return selects
        .filter(select => select.value !== "")
        .map(select => {
            const player = currentSignups.find(person => person.id === select.value);

            return {
                court_number: Number(select.dataset.court),
                pair_number: Number(select.dataset.pair),
                slot_number: Number(select.dataset.slot),
                player_id: select.value,
                player_name: player ? player.name : "Unknown player"
            };
        });
}

function updateDraftPreviewAndValidation() {
    const draftAssignments = getDraftAssignmentsFromForm();
    const validation = validateDraftAssignments(draftAssignments);

    if (validation.valid) {
        manualValidationMessage.className = "manual-validation good";
        manualValidationMessage.textContent = "Draft is valid. Click Publish Court Assignments when ready.";
        publishManualCourtsButton.disabled = false;
    } else {
        manualValidationMessage.className = "manual-validation bad";
        manualValidationMessage.innerHTML = validation.messages
            .map(message => `<div>${escapeHtml(message)}</div>`)
            .join("");
        publishManualCourtsButton.disabled = true;
    }
}

function validateDraftAssignments(assignments) {
    const messages = [];

    const playerIdCounts = {};
    const courtCounts = {};
    const pairCounts = {};

    assignments.forEach(assignment => {
        playerIdCounts[assignment.player_id] =
            (playerIdCounts[assignment.player_id] || 0) + 1;

        courtCounts[assignment.court_number] =
            (courtCounts[assignment.court_number] || 0) + 1;

        const pairKey = `${assignment.court_number}-${assignment.pair_number}`;
        pairCounts[pairKey] = (pairCounts[pairKey] || 0) + 1;
    });

    Object.keys(playerIdCounts).forEach(playerId => {
        if (playerIdCounts[playerId] > 1) {
            const player = currentSignups.find(person => person.id === playerId);
            messages.push(`${player ? player.name : "A player"} is assigned more than once.`);
        }
    });

    for (let court = 1; court <= 6; court++) {
        if ((courtCounts[court] || 0) > 4) {
            messages.push(`Court ${court} has more than 4 players assigned. Remove one before publishing.`);
        }
    }

    Object.keys(pairCounts).forEach(pairKey => {
        if (pairCounts[pairKey] > 2) {
            const [court, pair] = pairKey.split("-");
            messages.push(`Court ${court}, Pair ${pair} has more than 2 players. Remove one before publishing.`);
        }
    });

    return {
        valid: messages.length === 0,
        messages: messages
    };
}

async function publishManualCourtAssignments() {
    const draftAssignments = getDraftAssignmentsFromForm();
    const validation = validateDraftAssignments(draftAssignments);

    if (!validation.valid) {
        updateDraftPreviewAndValidation();
        adminStatus.textContent = "Fix the draft before publishing.";
        return;
    }

    const rows = draftAssignments.map(assignment => {
        return {
            court_number: assignment.court_number,
            pair_number: assignment.pair_number,
            player_name: assignment.player_name
        };
    });

    const { error } = await supabaseClient.rpc(
        "admin_save_court_assignments",
        {
            assignments: rows
        }
    );

    if (error) {
        console.error(error);
        adminStatus.textContent = "Error publishing court assignments.";
        return;
    }

    adminStatus.textContent = "Court assignments published.";
    await loadAdminList();
}

function clearDraftAssignments() {
    document.querySelectorAll(".manual-player-select").forEach(select => {
        select.value = "";
    });

    updateDraftPreviewAndValidation();
    adminStatus.textContent = "Draft assignments cleared. Public court assignments were not changed.";
}

function renderCourtVisual(container, assignments) {
    container.innerHTML = "";

    for (let court = 1; court <= 6; court++) {
        const courtPlayers = assignments.filter(
            player => player.court_number === court
        );

        const pairOne = courtPlayers.filter(
            player => player.pair_number === 1
        );

        const pairTwo = courtPlayers.filter(
            player => player.pair_number === 2
        );

        const courtCard = document.createElement("div");
        courtCard.className = "court-card";

        courtCard.innerHTML = `
            <div class="court-number">${court}</div>

            <div class="court-content">
                <div class="court-title">Court ${court}</div>

                ${courtPlayers.length === 0 ? `
                    <div class="empty-court">No players assigned</div>
                ` : `
                    <div class="pair-box">
                        <div class="pair-title">Pair 1</div>
                        ${pairOne.length > 0 ? pairOne.map(player => `
                            <div class="player-name">${escapeHtml(player.player_name)}</div>
                        `).join("") : `<div class="empty-court">Empty</div>`}
                    </div>

                    <div class="pair-box">
                        <div class="pair-title">Pair 2</div>
                        ${pairTwo.length > 0 ? pairTwo.map(player => `
                            <div class="player-name">${escapeHtml(player.player_name)}</div>
                        `).join("") : `<div class="empty-court">Empty</div>`}
                    </div>
                `}
            </div>
        `;

        container.appendChild(courtCard);
    }
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

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value);
}

checkSession();