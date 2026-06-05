const SUPABASE_URL = "https://unlnzhctvydpbtrpvoai.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVubG56aGN0dnlkcGJ0cnB2b2FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTc0NDIsImV4cCI6MjA5NTYzMzQ0Mn0.UlZE8uslUR4VziAeW7uc8i12DZPsO8y7hSoN8YKx5CQ";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

const passwordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const setPasswordButton = document.getElementById("set-password-button");
const statusDiv = document.getElementById("status");

setPasswordButton.addEventListener("click", async () => {
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!password) {
        statusDiv.textContent = "Enter a password.";
        return;
    }

    if (password.length < 6) {
        statusDiv.textContent = "Password must be at least 6 characters.";
        return;
    }

    if (password !== confirmPassword) {
        statusDiv.textContent = "Passwords do not match.";
        return;
    }

    const { error } = await supabaseClient.auth.updateUser({
        password: password
    });

    if (error) {
        console.error(error);
        statusDiv.textContent = "Error setting password. The link may have expired.";
        return;
    }

    statusDiv.textContent = "Password set. Redirecting to admin login...";

    setTimeout(() => {
        window.location.href = "admin.html";
    }, 1500);
});