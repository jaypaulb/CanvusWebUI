const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const pm2 = require("pm2");

// Initialize Express app
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // Serve static files from 'public'

// Load environment variables at startup
var envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath });

// Cache environment variables for quick access
var CANVUS_SERVER = process.env.CANVUS_SERVER;
var CANVAS_ID = process.env.CANVAS_ID;
var CANVUS_API_KEY = process.env.CANVUS_API_KEY;

// Validate essential environment variables
function validateEnv() {
    if (!CANVUS_SERVER || !CANVAS_ID || !CANVUS_API_KEY) {
        logMessage('error', "Missing essential environment variables.");
        process.exit(1);
    }
}
validateEnv();

// Common headers
function getHeaders() {
    return {
        "Private-Token": CANVUS_API_KEY,
        "Content-Type": "application/json"
    };
}

// Logging utility
function logMessage(type, message) {
    var timestamp = new Date().toISOString();
    if (type === 'error') {
        console.error("[" + timestamp + "] " + message);
            } else {
        console.log("[" + timestamp + "] " + message);
    }
}

// Add this function somewhere in your code
function delay(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

// Generic Axios request
function apiRequest(method, url, data) {
    return axios({
        method: method,
        url: CANVUS_SERVER + url,
        headers: getHeaders(),
        data: data
    });
}

// PM2 connection management
function connectPM2() {
    return new Promise(function (resolve, reject) {
        pm2.connect(function (err) {
            if (err) {
                logMessage('error', "Error connecting to PM2");
                reject(err);
            } else {
                logMessage('info', "Connected to PM2");
                resolve();
            }
        });
    });
}

function disconnectPM2() {
                    pm2.disconnect();
    logMessage('info', "Disconnected from PM2");
}

function restartPythonScript(scriptName) {
    return new Promise(function (resolve, reject) {
        pm2.restart(scriptName, function (err, proc) {
            if (err) {
                logMessage('error', "Error restarting Python script '" + scriptName + "': " + err.message);
                reject(err);
            } else {
                logMessage('info', "Successfully restarted Python script '" + scriptName + "'");
                resolve(proc);
            }
        });
    });
}

// Handle PM2 connection on startup
connectPM2().catch(function (err) {
    logMessage('error', "Exiting due to PM2 connection failure.");
    process.exit(2);
});

// Handle PM2 disconnect on exit
process.on("exit", function () {
    disconnectPM2();
});

// Endpoint to find canvas by UID
app.post("/find-canvas", function (req, res) {
    const uid = req.body.uid;
    if (!uid) {
        logMessage('error', "UID is missing in the request.");
        return res.status(400).json({ error: "UID is required." });
    }

    apiRequest('get', "/api/v1/canvases")
        .then(response => {
            const canvases = response.data;
        if (!Array.isArray(canvases)) {
            throw new Error("Invalid response format: canvases should be an array.");
        }

            let foundCanvas = null;

            const requests = canvases.map(canvas => {
                return apiRequest('get', `/api/v1/canvases/${canvas.id}/browsers`)
                    .then(browsersResponse => {
                        const browsers = browsersResponse.data;
            if (!Array.isArray(browsers)) {
                            throw new Error(`Invalid response format: browsers for canvas ID ${canvas.id} should be an array.`);
            }

                        browsers.forEach(browser => {
                            logMessage('debug', `Checking browser with URL: ${browser.url} for UID: ${uid}`);
                            if (browser.url && browser.url.indexOf(uid) !== -1) {
                                logMessage('info', `Found matching canvas: ${canvas.name} (ID: ${canvas.id})`);
                                foundCanvas = { canvasName: canvas.name, canvasId: canvas.id };
                                res.json(foundCanvas);
                }
                        });
                    })
                    .catch(error => {
                        logMessage('error', `Error fetching browsers for canvas ID: ${canvas.id} (${canvas.name}): ${getSafeErrorMessage(error)}`);
                    });
            });

            Promise.all(requests).then(() => {
            if (!foundCanvas) {
                    logMessage('info', `No matching canvas found for UID: ${uid}`);
        res.status(404).json({ error: "No matching canvas found." });
    }
            });
        })
        .catch(error => {
            logMessage('error', `Error fetching canvases or browsers: ${getSafeErrorMessage(error)}`);
            res.status(500).json({ error: "Failed to process request." });
        });
});

// Endpoint to get the list of zones (anchors)
app.get("/get-zones", function (req, res) {
    apiRequest('get', `/api/v1/canvases/${CANVAS_ID}/anchors`)
        .then(response => {
            res.json({ success: true, zones: response.data });
        })
        .catch(error => {
            logMessage('error', `Error fetching zones: ${getSafeErrorMessage(error)}`);
            res.status(500).json({ error: "Failed to fetch zones." });
        });
});

// Endpoint to check if the .env values match the canvas
app.get("/check-env", function (req, res) {
    const canvasName = req.query.canvasName;
    const canvasId = req.query.canvasId;

    if (!canvasName || !canvasId) {
        logMessage('error', "Canvas name or ID is missing in the request.");
        return res.status(400).json({ error: "Canvas name and ID are required." });
    }

    try {
        // Read .env file dynamically
        const envData = fs.readFileSync(envPath, "utf-8");

        // Parse the .env file into key-value pairs
        const envVariables = {};
        const lines = envData.split("\n");
        lines.forEach(line => {
            if (line.includes("=")) {
                const parts = line.split("=");
                envVariables[parts[0].trim()] = parts.slice(1).join("=").trim();
            }
        });

        // Compare with the provided values
        const matches =
            envVariables.CANVAS_NAME === canvasName &&
            envVariables.CANVAS_ID === canvasId;

        logMessage('info', `Environment check for Canvas ID: ${canvasId}: ${matches ? "Matched" : "Did Not Match"}`);
        return res.json({ matches: matches });
    } catch (error) {
        logMessage('error', `Error reading .env file: ${error.message}`);
        res.status(500).json({ error: "Failed to read .env file." });
    }
});

// Endpoint to create zones with grid pattern selection and subzone functionality
app.post("/create-zones", function (req, res) {
    var gridSize = req.body.gridSize;
    var gridPattern = req.body.gridPattern;
    var subZoneId = req.body.subZoneId;
    var subZoneArray = req.body.subZoneArray;

    logMessage('info', "/create-zones called with gridSize=" + gridSize + ", gridPattern=" + gridPattern + ", subZoneId=" + subZoneId + ", subZoneArray=" + subZoneArray);

    // Fetch canvas size information before creating anchors
    apiRequest('get', "/api/v1/canvases/" + CANVAS_ID + "/widgets")
                .then(function (response) {
            var widgets = response.data;
            var sharedCanvas = widgets.find(function (widget) {
                return widget.widget_type === 'SharedCanvas';
            });

            if (!sharedCanvas || !sharedCanvas.size) {
                throw new Error("SharedCanvas widget not found or does not have size information.");
            }

            var canvasWidth = sharedCanvas.size.width;
            var canvasHeight = sharedCanvas.size.height;

            logMessage('info', "Fetched canvas size: Width=" + canvasWidth + ", Height=" + canvasHeight);

            // If subZoneId and subZoneArray are provided, handle subzone creation
            if (subZoneId && subZoneArray) {
                createSubZones(subZoneId, subZoneArray, canvasWidth, canvasHeight, res);
        } else {
                // Generate coordinates based on grid pattern
                var coordinates;
            switch (gridPattern) {
                case "Z":
                    coordinates = generateZOrder(gridSize);
                    break;
                case "Snake":
                    coordinates = generateSnakeOrder(gridSize);
                    break;
                case "Spiral":
                    coordinates = generateSpiralOrder(gridSize);
                    break;
                default:
                        res.status(400).json({ error: "Invalid grid pattern. Choose from Z, Snake, Spiral." });
                        return;
                }

                // Calculate each anchor's size based on canvas size and grid size
                coordinates = coordinates.map(function (coord) {
                    return {
                        x: coord.col * (canvasWidth / gridSize),
                        y: coord.row * (canvasHeight / gridSize),
                        width: canvasWidth / gridSize,
                        height: canvasHeight / gridSize
                    };
                });

                // Create anchors from calculated coordinates
            createAnchorsFromCoordinates(coordinates, res);
        }
        })
        .catch(function (error) {
            logMessage('error', "Error fetching canvas size: " + getSafeErrorMessage(error));
            res.status(500).json({ error: "Failed to fetch canvas size." });
        });
});

// Helper functions for grid generation
function generateZOrder(gridSize) {
    var order = [];
    for (var row = 0; row < gridSize; row++) {
        for (var col = 0; col < gridSize; col++) {
            order.push({ row: row, col: col });
        }
    }
    return order;
}

function generateSnakeOrder(gridSize) {
    var order = [];
    for (var row = 0; row < gridSize; row++) {
        var cols = (row % 2 === 0) ? Array.from(Array(gridSize).keys()) : Array.from(Array(gridSize).keys()).reverse();
        for (var colIndex in cols) {
            order.push({ row: row, col: cols[colIndex] });
        }
    }
    return order;
}

function generateSpiralOrder(gridSize) {
    var spiralOrder = [];
    var x = Math.floor(gridSize / 2);
    var y = Math.floor(gridSize / 2);
    spiralOrder.push({ row: y, col: x });

    var step = 1;
    while (spiralOrder.length < gridSize * gridSize) {
        for (var i = 0; i < step; i++) { x += 1; if (x < gridSize && y < gridSize) { spiralOrder.push({ row: y, col: x }); } }
        for (var i = 0; i < step; i++) { y += 1; if (x < gridSize && y < gridSize) { spiralOrder.push({ row: y, col: x }); } }
        step++;
        for (var i = 0; i < step; i++) { x -= 1; if (x >= 0 && y < gridSize) { spiralOrder.push({ row: y, col: x }); } }
        for (var i = 0; i < step; i++) { y -= 1; if (x >= 0 && y >= 0) { spiralOrder.push({ row: y, col: x }); } }
        step++;
    }
    return spiralOrder;
}

// Helper function to generate subgrid coordinates
function generateSubGrid(rows, cols, zoneWidth, zoneHeight, zoneX, zoneY, aspectRatio) {
    const coordinates = [];
    const subZoneWidth = zoneWidth / cols;
    const subZoneHeight = zoneHeight / rows;

    // Adjust for aspect ratio
    let adjustedSubZoneHeight = subZoneWidth / aspectRatio;
    let finalSubZoneWidth = subZoneWidth;
    let finalSubZoneHeight = adjustedSubZoneHeight;

    if (finalSubZoneHeight * rows > zoneHeight) {
        finalSubZoneHeight = zoneHeight / rows;
        finalSubZoneWidth = finalSubZoneHeight * aspectRatio;
    }

    const totalSubZonesWidth = finalSubZoneWidth * cols;
    const totalSubZonesHeight = finalSubZoneHeight * rows;
    const startX = zoneX + (zoneWidth - totalSubZonesWidth) / 2;
    const startY = zoneY + (zoneHeight - totalSubZonesHeight) / 2;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = startX + col * finalSubZoneWidth;
            const y = startY + row * finalSubZoneHeight;
            coordinates.push({
                x: x,
                y: y,
                width: finalSubZoneWidth,
                height: finalSubZoneHeight
            });
        }
    }

    return coordinates;
}

// Helper function to create anchors from coordinates
function createAnchorsFromCoordinates(coordinates, res) {
    var createdCount = 0;
    var failedCount = 0;
    var index = 0;

    function createNextAnchor() {
        if (index >= coordinates.length) {
            logMessage('info', "Zone creation completed. Success: " + createdCount + ", Failed: " + failedCount);
            res.json({
                success: true,
                message: createdCount + " zones created successfully, " + failedCount + " failed.",
                reload: true // Flag for client-side to decide if page should be refreshed
            });
            return;
        }

        var coord = coordinates[index];
        var payload = {
            anchor_name: "Anchor_" + (index + 1) + " (Script Made)",
            location: { x: coord.x, y: coord.y },
            size: {
                width: coord.width,
                height: coord.height
            },
            pinned: true,
            scale: 1,
            depth: 1
        };

        logMessage('info', "Creating anchor 'Anchor_" + (index + 1) + " (Script Made)' with payload: " + JSON.stringify(payload));
        
        apiRequest('post', "/api/v1/canvases/" + CANVAS_ID + "/anchors", payload)
            .then(function(response) {
                var createdAnchor = response.data;

                // Validate the server response to ensure anchor creation matches request
            if (
                createdAnchor.anchor_name &&
                createdAnchor.location &&
                createdAnchor.location.x === coord.x &&
                createdAnchor.location.y === coord.y &&
                createdAnchor.size &&
                createdAnchor.size.width === coord.width &&
                createdAnchor.size.height === coord.height
            ) {
                    logMessage('info', "Successfully validated anchor creation for 'Anchor_" + (index + 1) + " (Script Made)'");
                createdCount++;
            } else {
                    logMessage('error', "Anchor created but validation failed for 'Anchor_" + (index + 1) + " (Script Made)'");
                failedCount++;
            }
        })
            .catch(function(error) {
                logMessage('error', "Error creating anchor 'Anchor_" + (index + 1) + " (Script Made)': " + getSafeErrorMessage(error));
            failedCount++;
        })
        .then(function() {
            index++;
            delay(100).then(createNextAnchor); // Delay in milliseconds (adjust as needed)
        });
    }

    createNextAnchor();
}

    Promise.all(promises).then(function () {
        logMessage('info', "Zone creation completed. Success: " + createdCount + ", Failed: " + failedCount);
    res.json({
        success: true,
        message: createdCount + " zones created successfully, " + failedCount + " failed.",
        reload: true // Flag for client-side to decide if page should be refreshed
    });
    }).catch(function (error) {
        logMessage('error', "Error in anchor creation process: " + getSafeErrorMessage(error));
    res.status(500).json({ error: "Failed to create all zones. Please check logs for details." });
});


// Helper function for subzone creation
function createSubZones(subZoneId, subZoneArray, canvasWidth, canvasHeight, res) {
    logMessage('info', `Fetching details for zone ID: ${subZoneId}`);

    // Parse subZoneArray as [cols, rows]
    const subZoneArr = subZoneArray.split('x');
    const cols = parseInt(subZoneArr[0], 10);
    const rows = parseInt(subZoneArr[1], 10);

    if (isNaN(cols) || isNaN(rows) || cols <= 0 || rows <= 0) {
        logMessage('error', `Invalid subZoneArray format: ${subZoneArray}`);
        return res.status(400).json({ success: false, error: "Invalid SubZone Array format." });
    }

    // Fetch the selected zone details to determine its size and location
    apiRequest('get', `/api/v1/canvases/${CANVAS_ID}/anchors/${subZoneId}`)
        .then(response => {
            const selectedZone = response.data;

            if (!selectedZone.size || !selectedZone.location) {
                throw new Error("Selected zone is missing size or location information.");
            }

            // Extract the starting location and total size of the target zone
            const zoneX = selectedZone.location.x;
            const zoneY = selectedZone.location.y;
            const zoneWidth = selectedZone.size.width;
            const zoneHeight = selectedZone.size.height;

            // Calculate subzone dimensions based on the selected zone's size
            const subZoneWidth = zoneWidth / cols;
            const subZoneHeight = zoneHeight / rows;

            // Generate coordinates for subzones within the selected zone
            const coordinates = [];
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    coordinates.push({
                        x: zoneX + col * subZoneWidth,
                        y: zoneY + row * subZoneHeight,
                        width: subZoneWidth,
                        height: subZoneHeight
                    });
                }
            }

            // Create subzones using generated coordinates
            let createdCount = 0;
            let failedCount = 0;

            const promises = coordinates.map((coord, index) => {
                const payload = {
                    anchor_name: `SubZone_${index + 1} (Script Made)`,
                    location: { x: coord.x, y: coord.y },
                    size: {
                        width: coord.width,
                        height: coord.height
                    },
                    pinned: true,
                    scale: 1,
                    depth: 1
                };

                logMessage('info', `Creating subzone 'SubZone_${index + 1} (Script Made)' with payload: ${JSON.stringify(payload)}`);

                return apiRequest('post', `/api/v1/canvases/${CANVAS_ID}/anchors`, payload)
                    .then(() => {
                        logMessage('info', `Successfully created subzone 'SubZone_${index + 1} (Script Made)'`);
                        createdCount++;
                    })
                    .catch(error => {
                        logMessage('error', `Error creating subzone 'SubZone_${index + 1} (Script Made)': ${getSafeErrorMessage(error)}`);
                        failedCount++;
                    });
            });

            Promise.all(promises).then(() => {
                logMessage('info', `Subzone creation completed. Success: ${createdCount}, Failed: ${failedCount}`);
                res.json({
                    success: true,
                    message: `${createdCount} subzones created successfully, ${failedCount} failed.`,
                    reload: true // Flag for client-side to decide if page should be refreshed
                });
            }).catch(error => {
                logMessage('error', `Error in subzone creation process: ${getSafeErrorMessage(error)}`);
                res.status(500).json({ error: "Failed to create all subzones. Please check logs for details." });
            });
        })
        .catch(error => {
            logMessage('error', `Error fetching zone details for subzone creation: ${getSafeErrorMessage(error)}`);
            res.status(500).json({ error: "Failed to fetch zone details for subzone creation." });
        });
}


// Endpoint to delete all script-created zones
app.delete("/delete-zones", function (req, res) {
    logMessage('info', "Delete all script-created zones");

    apiRequest('get', "/api/v1/canvases/" + CANVAS_ID + "/anchors")
        .then(function (response) {
            var anchors = response.data;
            var scriptAnchors = anchors.filter(function (anchor) {
                return anchor.anchor_name && anchor.anchor_name.endsWith("(Script Made)");
            });

    if (scriptAnchors.length === 0) {
                logMessage('info', "No script-created anchors found to delete.");
        return res.json({ success: true, message: "No script-created zones to delete." });
    }

            var deletedCount = 0;
            var failedCount = 0;

            var deletePromises = scriptAnchors.map(function (anchor) {
                return apiRequest('delete', "/api/v1/canvases/" + CANVAS_ID + "/anchors/" + anchor.id)
                    .then(function () {
                        logMessage('info', "Successfully deleted anchor '" + anchor.anchor_name + "'");
            deletedCount++;
                    })
                    .catch(function (error) {
                        logMessage('error', "Error deleting anchor '" + anchor.anchor_name + "': " + getSafeErrorMessage(error));
            failedCount++;
                    });
            });

            return Promise.all(deletePromises).then(function () {
                logMessage('info', "Completed deletion of script-created anchors. Deleted: " + deletedCount + ", Failed: " + failedCount);
    res.json({
        success: true,
        message: deletedCount + " zones deleted successfully, " + failedCount + " failed.",
        reload: true // Flag for client-side to decide if page should be refreshed
    });
            });
        })
        .catch(function (error) {
            logMessage('error', "Error fetching anchors: " + getSafeErrorMessage(error));
            res.status(500).json({ error: "Failed to delete zones. Please check logs for details." });
        });
});

// Utility to get safe error messages
function getSafeErrorMessage(error) {
return (error.response && error.response.data) || error.message || "Unknown error";
}

// Start the server
var PORT = 3000;
app.listen(PORT, function () {
    logMessage('info', "Server running at http://localhost:" + PORT);
});
