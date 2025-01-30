console.log("minime.js loading...");

document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM Content Loaded");
    
    const miniMeButton = document.getElementById("miniMeButton");
    const messageDiv = document.getElementById("message");

    console.log("Button element:", miniMeButton);
    console.log("Message div:", messageDiv);

    if (!miniMeButton || !messageDiv) {
        console.error("Required elements not found!");
        return;
    }

    // Function to display a message
    function displayMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = "block";
    }

    // Function to clear messages
    function clearMessage() {
        messageDiv.textContent = "";
        messageDiv.className = "message";
        messageDiv.style.display = "none";
    }

    // Function to enable or disable buttons
    function toggleButtons(disabled) {
        miniMeButton.disabled = disabled;
    }

    async function miniMe() {
        try {
            clearMessage();
            toggleButtons(true); // Disable button while processing
            
            // Step 1: Create 3x3 grid
            console.log("Starting miniMe function");
            displayMessage("Creating 3x3 grid...", "loading");
            
            const grid3x3Response = await fetch("/create-zones", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gridSize: "3",
                    gridPattern: "Spiral"
                })
            });
            const grid3x3Data = await grid3x3Response.json();
            if (!grid3x3Data.success) {
                throw new Error(grid3x3Data.error || "Failed to create 3x3 grid");
            }

            // Wait a moment for zones to be created
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Step 2: Create full canvas zone
            displayMessage("Creating full canvas zone...", "loading");
            const fullCanvasResponse = await fetch("/create-zones", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gridSize: "1",
                    gridPattern: "Z"
                })
            });
            const fullCanvasData = await fullCanvasResponse.json();
            if (!fullCanvasData.success) {
                throw new Error(fullCanvasData.error || "Failed to create full canvas zone");
            }

            // Wait a moment for zone to be created
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Get all zones
            displayMessage("Getting zones...", "loading");
            const zonesResponse = await fetch("/get-zones");
            const zonesData = await zonesResponse.json();
            
            if (!zonesData.success || !zonesData.zones) {
                throw new Error("Failed to get zones");
            }

            // Find the zones we need
            const fullCanvasZone = zonesData.zones.find(z => z.anchor_name?.includes("1x1"));
            const centerZone = zonesData.zones.find(z => z.anchor_name?.includes("Zone 5"));

            if (!fullCanvasZone || !centerZone) {
                throw new Error("Could not find required zones");
            }

            // Step 3: Move everything to center
            displayMessage("Moving content to center...", "loading");
            const moveResponse = await fetch("/api/macros/move", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourceZone: fullCanvasZone.id,
                    targetZone: centerZone.id
                })
            });

            const moveData = await moveResponse.json();
            if (!moveData.success) {
                throw new Error(moveData.error || "Failed to move content");
            }

            displayMessage("Mini Me completed successfully!", "success");
        } catch (error) {
            console.error("Mini Me error:", error);
            displayMessage(error.message, "error");
        } finally {
            toggleButtons(false); // Re-enable button
        }
    }

    console.log("Adding click listener to button");
    miniMeButton.addEventListener("click", miniMe);
}); 