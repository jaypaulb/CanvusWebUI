// Color utility function
function isColorDark(hexColor) {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) / 255 < 0.5;
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize common components
    MessageSystem.initialize();

    // User Identification Elements
    const teamButtons = document.querySelectorAll('.team-button');
    const userNameInput = document.getElementById('username');
    const userIdentification = document.getElementById('user-identification');
    const identificationMessage = document.getElementById('message');
    const userDashboard = document.getElementById('user-dashboard');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const noteSquare = document.getElementById('noteSquare');
    const uploadItemButton = document.getElementById('uploadItemButton');
    const postNoteButton = document.getElementById('postNoteButton');

    // QR Code Elements
    const qrCodeDiv = document.getElementById('qrcode');

    // Variables to store user info
    let selectedTeam = null;
    let userName = null;
    let userColor = null;

    // Team colors (ROYGBIV)
    const teamColors = {
        1: "#FF0000FF", // Red
        2: "#FF7F00FF", // Orange
        3: "#FFFF00FF", // Yellow
        4: "#00FF00FF", // Green
        5: "#0000FFFF", // Blue
        6: "#4B0082FF", // Indigo
        7: "#8B00FFFF"  // Violet
    };

    // Initialize team button colors
    teamButtons.forEach(button => {
        const teamNumber = button.dataset.team;
        button.style.backgroundColor = teamColors[teamNumber];
        button.style.color = isColorDark(teamColors[teamNumber]) ? '#FFFFFF' : '#000000';
    });

    // Generate QR code based on current URL
    const qrcode = new QRCode(qrCodeDiv, {
        text: window.location.href,
        width: 256,
        height: 256,
        colorDark: '#000',
        colorLight: '#fff',
        correctLevel: QRCode.CorrectLevel.H
    });

    // Update QR code when URL changes
    const updateQRCode = () => {
        qrcode.clear();
        qrcode.makeCode(window.location.href);
    };

    // Call updateQRCode when the page loads and when URL changes
    updateQRCode();
    window.addEventListener('popstate', updateQRCode);

    // Function to update identification message
    function updateIdentificationMessage(text, type) {
        if (identificationMessage) {
            identificationMessage.textContent = text;
            identificationMessage.className = `message ${type}`;
            identificationMessage.style.display = 'block';
        }
    }

    // Team selection and immediate identification
    teamButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const name = userNameInput.value.trim();
            if (!name) {
                updateIdentificationMessage("Please enter your name first.", "error");
                return;
            }

            teamButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            selectedTeam = parseInt(button.dataset.team);
            userName = name;

            try {
                // Get user color from server
                const response = await fetch('/identify-user', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ team: selectedTeam, name: userName })
                });

                const data = await response.json();
                if (response.ok && data.success) {
                    userColor = data.color;

                    // Get canvas name
                    const envResponse = await fetch('/get-canvas-info');
                    const envData = await envResponse.json();
                    const canvasName = envData.canvasName || "Unknown Canvas";

                    // Update visibility of sections
                    if (userIdentification) userIdentification.style.display = "none";
                    if (userDashboard) {
                        userDashboard.style.display = "block";
                        // Update welcome message and note square
                        welcomeMessage.textContent = `Welcome, ${userName}, you are currently posting to Team ${selectedTeam} on ${canvasName}.`;
                        noteSquare.style.backgroundColor = userColor;
                        noteSquare.style.color = isColorDark(userColor) ? '#FFFFFF' : '#000000';
                    }
                    
                    updateIdentificationMessage("Identification successful!", "success");
                    MessageSystem.display("Identification successful!", "success");
                } else {
                    updateIdentificationMessage(data.error || "Identification failed.", "error");
                    MessageSystem.display(data.error || "Identification failed.", "error");
                }
            } catch (error) {
                console.error("Error identifying user:", error);
                updateIdentificationMessage("An error occurred during identification.", "error");
                MessageSystem.display("An error occurred during identification.", "error");
            }
        });
    });

    // Handle post note button
    postNoteButton.addEventListener('click', async () => {
        const noteText = noteSquare.textContent.trim();
        if (!noteText) {
            MessageSystem.display("Please enter text in the note.", "error");
            return;
        }

        try {
            const response = await fetch('/create-note', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    team: selectedTeam,
                    name: userName,
                    text: noteText,
                    color: userColor
                })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                MessageSystem.display("Note posted successfully!", "success");
                noteSquare.textContent = ""; // Clear the note
            } else {
                MessageSystem.display(data.error || "Failed to post note.", "error");
            }
        } catch (error) {
            console.error("Error posting note:", error);
            MessageSystem.display("An error occurred while posting the note.", "error");
        }
    });

    // Handle file upload button
    uploadItemButton.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.jpg,.jpeg,.png,.gif,.bmp,.tiff,.mp4,.avi,.mov,.wmv,.pdf,.mkv';

        fileInput.onchange = async () => {
            const file = fileInput.files[0];
            if (file) {
                const formData = new FormData();
                formData.append('team', selectedTeam);
                formData.append('name', userName);
                formData.append('file', file);

                try {
                    MessageSystem.display("Uploading file...", "loading");
                    const response = await fetch('/upload-item', {
                        method: 'POST',
                        body: formData
                    });

                    const data = await response.json();
                    if (response.ok && data.success) {
                        MessageSystem.display(data.message, "success");
                    } else {
                        MessageSystem.display(data.error || "Upload failed.", "error");
                    }
                } catch (error) {
                    console.error("Error uploading file:", error);
                    MessageSystem.display("An error occurred during upload.", "error");
                }
            }
        };

        fileInput.click();
    });
}); 