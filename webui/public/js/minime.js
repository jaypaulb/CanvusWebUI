document.addEventListener("DOMContentLoaded", () => {
    const create3x3Button = document.getElementById("create3x3");
    const create1x1Button = document.getElementById("create1x1");
    const miniMeButton = document.getElementById("miniMe");
    const messageDiv = document.getElementById("message");

    function displayMessage(message, isError = false) {
        messageDiv.textContent = message;
        messageDiv.className = `message ${isError ? 'error' : 'success'}`;
    }

    create3x3Button.addEventListener("click", async () => {
        try {
            const response = await fetch("/create-zones", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gridSize: "3",
                    gridPattern: "Spiral"
                })
            });
            const data = await response.json();
            displayMessage(data.message);
        } catch (error) {
            displayMessage("Error creating 3x3 grid: " + error.message, true);
        }
    });

    create1x1Button.addEventListener("click", async () => {
        try {
            const response = await fetch("/create-zones", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gridSize: "1",
                    gridPattern: "Z"
                })
            });
            const data = await response.json();
            displayMessage(data.message);
        } catch (error) {
            displayMessage("Error creating 1x1 grid: " + error.message, true);
        }
    });

    miniMeButton.addEventListener("click", async () => {
        try {
            const response = await fetch("/api/macros/move", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourceZoneId: "9",
                    targetZoneId: "0"
                })
            });
            const data = await response.json();
            displayMessage(data.message);
        } catch (error) {
            displayMessage("Error performing Mini Me: " + error.message, true);
        }
    });
}); 