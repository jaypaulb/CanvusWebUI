// /public/js/upload.js

document.addEventListener("DOMContentLoaded", () => {
    // URL Params
    const urlParams = new URLSearchParams(window.location.search);
    const teamParam = urlParams.get('team');
    const nameParam = urlParams.get('name');
    // User Identification Elements
    const teamTabs = document.querySelectorAll(".team-tab");
    const identifyButton = document.getElementById("identifyButton");
    const userNameInput = document.getElementById("userName");
    const identificationMessage = document.getElementById("identification-message");
    const userIdentification = document.getElementById("user-identification");
    const userDashboard = document.getElementById("user-dashboard");
    const welcomeMessage = document.getElementById("welcomeMessage");
    const noteSquare = document.getElementById("noteSquare");
    const uploadItemButton = document.getElementById("uploadItemButton");
    const postNoteButton = document.getElementById("postNoteButton");
    const uploadMessage = document.getElementById("upload-message");
    const noteMessage = document.getElementById("note-message");

    // Admin Tabs & Panels
    const adminMessage = document.getElementById("admin-message");
    const tabCreateTargets = document.getElementById("tab-create-targets");
    const tabDeleteTargets = document.getElementById("tab-delete-targets");
    const tabClearUsers = document.getElementById("tab-clear-users");

    const panelCreateTargets = document.getElementById("panel-create-targets");
    const panelDeleteTargets = document.getElementById("panel-delete-targets");
    const panelClearUsers = document.getElementById("panel-clear-users");

    const createTargetsConfirm = document.getElementById("create-targets-confirm");
    const createTargetsCancel = document.getElementById("create-targets-cancel");

    const deleteTargetsConfirm = document.getElementById("delete-targets-confirm");
    const deleteTargetsCancel = document.getElementById("delete-targets-cancel");
    const targetNotesList = document.getElementById("target-notes-list");

    const deleteSelectedUsersBtn = document.getElementById("delete-selected-users-btn");
    const deleteAllUsersBtn = document.getElementById("delete-all-users-btn");
    const clearUsersCancel = document.getElementById("clear-users-cancel");
    const usersList = document.getElementById("users-list");

    // Confirmation Modal
    const confirmModal = document.getElementById("confirm-modal");
    const confirmModalTitle = document.getElementById("confirm-modal-title");
    const confirmModalMessage = document.getElementById("confirm-modal-message");
    const confirmModalConfirm = document.getElementById("confirm-modal-confirm");
    const confirmModalCancel = document.getElementById("confirm-modal-cancel");

    let selectedTeam = null;
    let userName = null;
    let userColor = null;
    let confirmationAction = null; // for confirm modal
  
    if (teamParam && nameParam) {
        const teamNumber = parseInt(teamParam, 10);
        if (teamNumber >= 1 && teamNumber <= 7) {
            selectedTeam = teamNumber;
            userName = nameParam.trim();
            // Attempt to skip identification since we have team and name:
            initializeUserSession(selectedTeam, userName);
        } else {
            console.warn("Invalid team parameter, must be between 1 and 7.");
        }
    }

    // Define a helper function to initialize the user session when team & name are known
    async function initializeUserSession(team, name) {
        try {
            // Optionally fetch CANVAS_NAME or run /check-env if needed
            const envResponse = await fetch('/check-env');
            const envVars = await envResponse.json();
            const canvasName = envVars.CANVAS_NAME || "Unknown Canvas";

            // Set a default color or possibly fetch a color from an endpoint
            // If you need the color from the server (like in identify), you could simulate that call:
            const identifyResponse = await fetch('/identify-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team, name })
            });
            const identifyData = await identifyResponse.json();
            if (identifyResponse.ok && identifyData.success) {
                userColor = identifyData.color;
                // Hide identification and admin container, show dashboard
                const userIdentification = document.getElementById("user-identification");
                const userDashboard = document.getElementById("user-dashboard");
                const welcomeMessage = document.getElementById("welcomeMessage");
                const noteSquare = document.getElementById("noteSquare");
                const adminContainer = document.querySelector('.admin-container');

                if (userIdentification) userIdentification.style.display = "none";
                if (adminContainer) adminContainer.style.display = "none";
                if (userDashboard) userDashboard.style.display = "block";

                welcomeMessage.textContent = `Welcome, ${name}, you are currently posting to ${canvasName}.`;
                noteSquare.style.backgroundColor = userColor;
                setTextColorBasedOnBackground();
            } else {
                console.error("Failed to auto-identify user from URL params:", identifyData.error || identifyData);
            }
        } catch (err) {
            console.error("Error initializing user from URL params:", err);
        }
    }

    function isColorDark(hexColor) {
        hexColor = hexColor.replace('#', '');
        const r = parseInt(hexColor.substring(0,2), 16);
        const g = parseInt(hexColor.substring(2,4), 16);
        const b = parseInt(hexColor.substring(4,6), 16);
        const luminance = (0.299*r + 0.587*g + 0.114*b)/255;
        return luminance < 0.5;
    }

    function setTextColorBasedOnBackground() {
        if (isColorDark(userColor)) {
            noteSquare.style.color = '#FFFFFF';
        } else {
            noteSquare.style.color = '#000000';
        }
    }

    // Function to display identification message
    function displayIdentificationMessage(text, type) {
        identificationMessage.textContent = text;
        identificationMessage.className = `message ${type}`;
        identificationMessage.style.display = "block";
    }

    // Function to display upload message
    function displayUploadMessage(text, type) {
        uploadMessage.textContent = text;
        uploadMessage.className = `message ${type}`;
        uploadMessage.style.display = "block";
    }

    // Function to display note message
    function displayNoteMessage(text, type) {
        noteMessage.textContent = text;
        noteMessage.className = `message ${type}`;
        noteMessage.style.display = "block";
    }

    // Function to display admin message
    function displayAdminMessage(text, type) {
        adminMessage.textContent = text;
        adminMessage.className = `message ${type}`;
        adminMessage.style.display = "block";
    }

    function openModal(modal) {
        modal.style.display = 'block';
    }

    function closeModal(modal) {
        modal.style.display = 'none';
    }

    // Confirmation Modal Functions
    function openConfirmModal(title, message, action) {
        confirmModalTitle.textContent = title;
        confirmModalMessage.textContent = message;
        confirmationAction = action;
        openModal(confirmModal);
    }

    function closeConfirmModal() {
        confirmationAction = null;
        closeModal(confirmModal);
    }

    // Bind confirm/cancel buttons for confirm modal
    confirmModalCancel.addEventListener('click', () => {
        closeConfirmModal();
    });

    confirmModalConfirm.addEventListener('click', () => {
        if (confirmationAction && typeof confirmationAction === 'function') {
            confirmationAction();
    }
        closeConfirmModal();
    });

    // Show/Hide Panels
    function showPanel(panel) {
        panelCreateTargets.classList.remove("active");
        panelDeleteTargets.classList.remove("active");
        panelClearUsers.classList.remove("active");

        if (panel) {
            panel.classList.add("active");
        }
    }

    function setActiveTab(tab) {
        [tabCreateTargets, tabDeleteTargets, tabClearUsers].forEach(t => t.classList.remove("active"));
        if (tab) tab.classList.add("active");
    }

    // Tab Click Handlers
    tabCreateTargets.addEventListener("click", (e) => {
        e.preventDefault();
        displayAdminMessage("", "info");
        setActiveTab(tabCreateTargets);
        showPanel(panelCreateTargets);
    });

    tabDeleteTargets.addEventListener("click", async (e) => {
        e.preventDefault();
        displayAdminMessage("Loading target notes...", "info");
        setActiveTab(tabDeleteTargets);
        showPanel(panelDeleteTargets);
        targetNotesList.innerHTML = "";

        // Fetch target notes
        try {
            const res = await fetch('/list-target-notes');
            const data = await res.json();
            console.log("List Target Notes Response:", data);
            if (data.success) {
                if (data.notes.length === 0) {
                    displayAdminMessage("No target notes found.", "info");
                    showPanel(null);
                    setActiveTab(null);
                    return;
                }
                displayAdminMessage("", "info");
                showPanel(panelDeleteTargets);
                data.notes.forEach(note => {
                    const div = document.createElement('div');
                    div.innerHTML = `
                        <label>
                            <input type="checkbox" name="noteId" value="${note.id}" checked>
                            ${note.title} (ID: ${note.id})
                        </label>
                    `;
                    targetNotesList.appendChild(div);
                });
            } else {
                displayAdminMessage(data.error || "Failed to load notes.", "error");
                showPanel(null);
                setActiveTab(null);
            }
        } catch (err) {
            console.error(err);
            displayAdminMessage("An error occurred while fetching notes.", "error");
            showPanel(null);
            setActiveTab(null);
        }
    });

    tabClearUsers.addEventListener("click", async (e) => {
        e.preventDefault();
        displayAdminMessage("Loading users...", "info");
        setActiveTab(tabClearUsers);
        usersList.innerHTML = "";
        try {
            const res = await fetch('/list-users');
            const data = await res.json();
            console.log("List Users Response:", data);
            if (data.success) {
                if (data.users.length === 0) {
                    usersList.innerHTML = '<p>No users stored.</p>';
                    displayAdminMessage("", "info");
                } else {
                    data.users.forEach(user => {
                        const div = document.createElement('div');
                        div.innerHTML = `
                            <label>
                                <input type="checkbox" name="user" data-team="${user.team}" data-name="${user.name}" checked>
                                Team ${user.team} - ${user.name} (Color: ${user.color})
                            </label>
                        `;
                        usersList.appendChild(div);
                    });
                    displayAdminMessage("", "info");
                }
                showPanel(panelClearUsers);
            } else {
                displayAdminMessage(data.error || "Failed to load users.", "error");
                showPanel(null);
                setActiveTab(null);
            }
        } catch (err) {
            console.error(err);
            displayAdminMessage("An error occurred while loading users.", "error");
            showPanel(null);
            setActiveTab(null);
        }
    });

    // Team Tab selection
    teamTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            teamTabs.forEach(t => t.classList.remove("active-team"));
            tab.classList.add("active-team");
            selectedTeam = parseInt(tab.dataset.team);
        });
    });

    // Handle Identify Button Click
    identifyButton.addEventListener("click", async () => {
        const name = userNameInput.value.trim();
        if (!selectedTeam) {
            displayIdentificationMessage("Please select a team.", "error");
            return;
        }
        if (!name) {
            displayIdentificationMessage("Please enter your name.", "error");
            return;
        }

        userName = name;

        try {
            // Send team and name to the server to get color
            const response = await fetch('/identify-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ team: selectedTeam, name: userName })
            });

            const data = await response.json();
            console.log("Identify User Response:", data);
            if (response.ok && data.success) {
                userColor = data.color;
                // Optionally, save to localStorage if you want to remember for this browser
                // localStorage.setItem("uploadUserData", JSON.stringify({ team: selectedTeam, name: userName, color: userColor }));

            // Fetch CANVAS_NAME from the server
            const envResponse = await fetch('/check-env');
            const envVars = await envResponse.json();
                const canvasName = envVars.CANVAS_NAME || "Unknown Canvas";

        // Display confirmation message
                displayIdentificationMessage("Identification successful. Your notes will appear in your designated color.", "success");

                // Hide the admin container once identified
                const adminContainer = document.querySelector('.admin-container');
                if (adminContainer) {
                    adminContainer.style.display = 'none';
                }

        // Display user dashboard
        userIdentification.style.display = "none";
        userDashboard.style.display = "block";

        // Set welcome message and color
            welcomeMessage.textContent = `Welcome, ${userName}, you are currently posting to ${canvasName}.`;
        noteSquare.style.backgroundColor = userColor;

                // Set text color based on background
                setTextColorBasedOnBackground();
            } else {
                displayIdentificationMessage(data.error || "Identification failed.", "error");
            }
        } catch (error) {
            console.error("Error identifying user:", error);
            displayIdentificationMessage("An error occurred during identification.", "error");
        }
    });

    // Handle Upload Item Button Click
    uploadItemButton.addEventListener("click", () => {
        // Create a hidden file input
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".jpg,.jpeg,.png,.gif,.bmp,.tiff,.mp4,.avi,.mov,.wmv,.pdf,.mkv"; // Supported extensions

        fileInput.onchange = async () => {
            const file = fileInput.files[0];
            if (file) {
                const formData = new FormData();
                // Append team and name first
                formData.append('team', selectedTeam);
                formData.append('name', userName);
                // Now append the file
                formData.append('file', file);

                try {
                    const uploadResponse = await fetch('/upload-item', {
                        method: 'POST',
                        body: formData
                    });

                    const uploadData = await uploadResponse.json();
                    console.log("Upload Item Response:", uploadData);
                    if (uploadResponse.ok && uploadData.success) {
                        displayUploadMessage(uploadData.message, "success");
                        console.log(`Uploaded file: ${file.name}`);
                } else {
                        displayUploadMessage(uploadData.error || "Upload failed.", "error");
                    }
                } catch (error) {
                    console.error("Error uploading file:", error);
                    displayUploadMessage("An error occurred during upload.", "error");
                }
            }
        };

        // Trigger the file dialog
        fileInput.click();
    });

    // Handle Post Note Button Click
    postNoteButton.addEventListener("click", async () => {
        const noteText = noteSquare.textContent.trim();
        if (!noteText) {
            displayNoteMessage("Please enter text in the note.", "error");
            return;
        }

            // Prepare the payload for /create-note
            const payload = {
                team: selectedTeam,
                name: userName,
                text: noteText,
                color: userColor
            };

        try {
            const response = await fetch('/create-note', {
                method: 'POST',
                    headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            console.log("Create Note Response:", data);
            if (response.ok && data.success) {
                displayNoteMessage("Note posted successfully!", "success");
                // Clear the note square
                noteSquare.textContent = "";
            } else {
                displayNoteMessage(data.error || "Failed to post the note.", "error");
            }
        } catch (error) {
            console.error("Error posting the note:", error);
            displayNoteMessage("An error occurred while posting the note.", "error");
        }
    });

    // Create Targets Confirm/Cancel
    createTargetsConfirm.addEventListener("click", async () => {
            displayAdminMessage("Creating targets...", "info");
            try {
                const res = await fetch('/create-team-targets', { method: 'POST' });
                const data = await res.json();
            console.log("Create Targets Response:", data);
                if (data.success) {
                    displayAdminMessage(data.message, "success");
                } else {
                    displayAdminMessage(data.error || data.message || "Failed to create targets.", "error");
                }
            } catch (err) {
            console.error("Error creating targets:", err);
                displayAdminMessage("An error occurred during the action.", "error");
            }
        // Close panel
        showPanel(null);
        setActiveTab(null);
    });

    createTargetsCancel.addEventListener("click", () => {
        showPanel(null);
        setActiveTab(null);
                displayAdminMessage("", "info");
    });

    // Delete Targets Confirm/Cancel
    deleteTargetsConfirm.addEventListener('click', async () => {
        const checkboxes = [...targetNotesList.querySelectorAll('input[name="noteId"]:checked')];
        if (checkboxes.length === 0) {
            displayAdminMessage("No notes selected for deletion.", "error");
            showPanel(null);
            setActiveTab(null);
            return;
        }

        const noteIds = checkboxes.map(cb => cb.value);

        displayAdminMessage("Deleting target notes...", "info");
        try {
            const res = await fetch('/delete-target-notes', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({noteIds})
                });
            const data = await res.json();
            console.log("Delete Targets Response:", data);
            if (data.success) {
                displayAdminMessage(data.message, "success");
            } else {
                displayAdminMessage(data.error || "Failed to delete notes.", "error");
            }
        } catch (err) {
            console.error(err);
            displayAdminMessage("An error occurred while deleting notes.", "error");
        }

        showPanel(null);
        setActiveTab(null);
    });

    deleteTargetsCancel.addEventListener('click', () => {
        showPanel(null);
        setActiveTab(null);
        displayAdminMessage("", "info");
    });

    // Clear Users: Delete Selected
    deleteSelectedUsersBtn.addEventListener('click', () => {
        const checkboxes = [...usersList.querySelectorAll('input[name="user"]:checked')];
        if (checkboxes.length === 0) {
            displayAdminMessage("No users selected for deletion.", "error");
            showPanel(null);
            setActiveTab(null);
            return;
        }

        const usersToDelete = checkboxes.map(cb => ({team: parseInt(cb.dataset.team), name: cb.dataset.name}));

        openConfirmModal("Delete Selected Users", "Are you sure you want to delete the selected users?", async () => {
            displayAdminMessage("Deleting selected users...", "info");
            try {
                const res = await fetch('/delete-users', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({all: false, users: usersToDelete})
                });
                const data = await res.json();
                console.log("Delete Selected Users Response:", data);
                if (data.success) {
                    displayAdminMessage(data.message, "success");
                } else {
                    displayAdminMessage(data.error || "Failed to delete users.", "error");
            }
            } catch (err) {
                console.error(err);
                displayAdminMessage("An error occurred while deleting users.", "error");
            }
            showPanel(null);
            setActiveTab(null);
        });
    });

    // Clear Users: Delete All
    deleteAllUsersBtn.addEventListener('click', () => {
        openConfirmModal("Delete All Users", "Are you sure you want to delete ALL stored users?", async () => {
            displayAdminMessage("Deleting all users...", "info");
            try {
                const res = await fetch('/delete-users', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({all:true})
                });
                const data = await res.json();
                console.log("Delete All Users Response:", data);
                if (data.success) {
                    displayAdminMessage(data.message, "success");
                } else {
                    displayAdminMessage(data.error || "Failed to delete all users.", "error");
                }
            } catch (err) {
                console.error(err);
                displayAdminMessage("An error occurred while deleting all users.", "error");
            }
            showPanel(null);
            setActiveTab(null);
        });
    });

    clearUsersCancel.addEventListener('click', () => {
        showPanel(null);
        setActiveTab(null);
        displayAdminMessage("", "info");
    });

    // Click outside modal to close (optional)
    window.addEventListener("click", (event) => {
        if (event.target === confirmModal) {
            closeConfirmModal();
        }
    });
});
