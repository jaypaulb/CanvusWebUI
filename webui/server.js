// server.js

// -----------------------------------------------------------------------------
// This script sets up an Express-based web server that:
// - Serves static files
// - Handles user identification and assigns colors 
// - Updates .env variables (admin password required)
// - Interacts with an external CANVUS server API for managing canvases, anchors, and widgets
// - Supports file uploads for images, videos, and PDFs
// - Provides endpoints to create team targets 
// - Provides endpoints to list and delete target notes 
// - Provides endpoints to list and delete users from users.json 
// 
// Prerequisites:
// npm install express axios fs path dotenv body-parser multer express-validator
// 
// After installing dependencies, run:
// node server.js
// 
// Ensure that you have a .env file in the parent directory (../.env) with
// necessary environment variables like CANVUS_SERVER, CANVAS_ID, CANVUS_API_KEY,
// and WEBUI_KEY.
// -----------------------------------------------------------------------------
// server.js - All-in-one version with Macro Endpoints

const express = require('express');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables first
const realDirname = fs.realpathSync(__dirname);
console.log(`[Server Startup] Current directory (__dirname): ${__dirname}`);
console.log(`[Server Startup] Real path of directory: ${realDirname}`);

let envPath;

try {
    // First try to get the target of the symlink
    console.log(`[Server Startup] Checking if directory is a symlink...`);
    const symlinkTarget = fs.readlinkSync(__dirname);
    if (symlinkTarget) {
        // If we're a symlink, resolve the target path
        const resolvedTarget = path.resolve(path.dirname(realDirname), symlinkTarget);
        // Look for .env in the parent directory of where the symlink points to
        envPath = path.resolve(path.dirname(resolvedTarget), '.env');
        console.log(`[Server Startup] Directory is a symlink pointing to ${resolvedTarget}`);
        console.log(`[Server Startup] Looking for .env at: ${envPath}`);
    }
} catch (err) {
    // If readlinkSync fails, we're not a symlink
    // In this case, try to find .env in the parent of the real directory
    envPath = path.resolve(path.dirname(realDirname), '.env');
    console.log(`[Server Startup] Directory is not a symlink.`);
    console.log(`[Server Startup] Looking for .env at: ${envPath}`);
}

const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('[Server Startup] Error loading environment variables:', result.error);
    process.exit(1);
}

// Validate essential environment variables
const essentialVars = ['CANVUS_SERVER', 'CANVAS_ID', 'CANVUS_API_KEY'];
const missingVars = essentialVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
    console.error('[Server Startup] Missing essential environment variables:', missingVars.join(', '));
    process.exit(1);
}

// Create a safe version of environment variables for logging (obscuring sensitive data)
const safeEnvVars = Object.entries(process.env)
    .filter(([key]) => key.startsWith('CANVUS_') || key === 'CANVAS_NAME' || key === 'CANVAS_ID' || key === 'PORT' || key === 'ALLOW_SELF_SIGNED_CERTS')
    .reduce((acc, [key, value]) => {
        // Obscure API keys and sensitive data
        if (key.toLowerCase().includes('key') || key.toLowerCase().includes('pwd') || key.toLowerCase().includes('password')) {
            acc[key] = '********';
        } else {
            acc[key] = value;
        }
        return acc;
    }, {});

console.log('\n[Server Startup] Environment loaded from:', envPath);
console.log('[Server Startup] Loaded variables:');
console.table(safeEnvVars);

console.log('[Server Startup] Environment variables loaded successfully.');
console.log(`[Server Startup] CANVUS_SERVER=${process.env.CANVUS_SERVER}, CANVAS_ID=${process.env.CANVAS_ID}`);
console.log('[Server Startup] ALLOW_SELF_SIGNED_CERTS:', process.env.ALLOW_SELF_SIGNED_CERTS);

// Now require other dependencies after environment is set up
const bodyParser = require('body-parser');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const FormData = require('form-data');
const themeRoutes = require('./routes/theme');
const apiClient = require('./utils/apiClient');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static('public'));

// Default route - serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ------------------- Admin Endpoints -------------------

// Middleware for admin authentication
function validateAdminAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    console.log(`[${getTimestamp()}] Admin authentication attempt...`);
    
    if (!authHeader) {
        console.error(`[${getTimestamp()}] Authentication failed: No authorization header provided`);
        return res.status(401).json({ success: false, message: 'No authorization header provided' });
    }
    
    if (!authHeader.startsWith('Bearer ')) {
        console.error(`[${getTimestamp()}] Authentication failed: Invalid authorization format. Expected 'Bearer token'`);
        return res.status(401).json({ success: false, message: 'Invalid authorization format' });
    }

    const token = authHeader.split(' ')[1];
    const expectedToken = process.env.WEBUI_PWD;
    
    if (!expectedToken) {
        console.error(`[${getTimestamp()}] Server configuration error: WEBUI_PWD not set in environment variables`);
        return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    if (token !== expectedToken) {
        console.error(`[${getTimestamp()}] Authentication failed: Invalid token provided`);
        return res.status(401).json({ success: false, message: 'Invalid authorization token' });
    }

    console.log(`[${getTimestamp()}] Admin authentication successful`);
    next();
}

// Validate admin authentication endpoint
app.post('/validateAdmin', validateAdminAuth, (req, res) => {
    res.json({ success: true, message: 'Authentication successful' });
});

// Define the admin environment variables endpoint
app.get('/admin/env-variables', validateAdminAuth, (req, res) => {
    const envPath = path.resolve(__dirname, '..', '.env');

    try {
        const envFile = fs.readFileSync(envPath, 'utf8');
        const envConfig = dotenv.parse(envFile);

        // Filter out sensitive variables (only API keys and security settings)
        const filteredEnv = {};
        const excludedPatterns = [
            'api_key',
            'apikey',
            'allow_self_signed_certs'
        ];
        
        for (const [key, value] of Object.entries(envConfig)) {
            const lowerKey = key.toLowerCase();
            if (!excludedPatterns.some(pattern => lowerKey.includes(pattern))) {
                filteredEnv[key] = value;
            }
        }

        res.json(filteredEnv);
        console.log(`[${getTimestamp()}] Environment variables retrieved successfully`);
    } catch (error) {
        console.error(`[${getTimestamp()}] Error reading .env file:`, error);
        res.status(500).json({ success: false, error: 'Failed to read environment variables.' });
    }
});

// Helper function to verify canvas existence and get details
async function verifyCanvas(canvasId) {
    console.log(`[${getTimestamp()}] Verifying canvas ID: ${canvasId}`);
    
    try {
        const response = await apiClient.get(`/api/v1/canvases/${canvasId}`);
        
        if (response.data) {
            console.log(`[${getTimestamp()}] Canvas verified. Name: ${response.data.name}`);
            return { 
                exists: true, 
                name: response.data.name,
                id: response.data.id
            };
        } else {
            console.log(`[${getTimestamp()}] Canvas not found`);
            return { exists: false };
        }
    } catch (error) {
        console.error(`[${getTimestamp()}] Error verifying canvas:`, error.response?.data || error.message);
        throw new Error(error.response?.data?.error || 'Failed to verify canvas');
    }
}

// Update Environment Variables (admin authentication required)
app.post('/admin/update-env', validateAdminAuth, async (req, res) => {
    const updatedVars = req.body;
    const envPath = path.join(__dirname, '..', '.env');

    console.log(`[${getTimestamp()}] Updating .env file at: ${envPath}`);
    console.log(`[${getTimestamp()}] Variables to update:`, updatedVars);

    try {
        // Check for restricted variables
        const excludedPatterns = [
            'api_key',
            'apikey',
            'allow_self_signed_certs'
        ];
        const restrictedVars = Object.keys(updatedVars).filter(key => 
            excludedPatterns.some(pattern => key.toLowerCase().includes(pattern))
        );

        if (restrictedVars.length > 0) {
            return res.status(403).json({
                success: false,
                error: `Cannot modify restricted variables: ${restrictedVars.join(', ')}`
            });
        }

        // Verify canvas ID if it's being updated
        if (updatedVars.CANVAS_ID) {
            try {
                const verifyResult = await verifyCanvas(updatedVars.CANVAS_ID);
                
                if (!verifyResult.exists) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Canvas ID does not exist on server.' 
                    });
                }

                // If canvas name is different, update it
                if (verifyResult.name && updatedVars.CANVAS_NAME !== verifyResult.name) {
                    console.log(`[${getTimestamp()}] Updating canvas name from "${updatedVars.CANVAS_NAME}" to "${verifyResult.name}"`);
                    updatedVars.CANVAS_NAME = verifyResult.name;
                }
            } catch (error) {
                return res.status(400).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        }

        // Read existing .env file
        let envContent = fs.readFileSync(envPath, 'utf8');
        console.log(`[${getTimestamp()}] Successfully read .env file.`);

        // Convert .env content into an object
        const envObject = {};
        envContent.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const [key, ...vals] = trimmedLine.split('=');
                envObject[key.trim()] = vals.join('=').trim();
            }
        });

        // Update variables
        let updated = false;
        Object.entries(updatedVars).forEach(([key, value]) => {
            // Transform camelCase to uppercase with underscores
            let envKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
            if (envKey.startsWith('_')) {
                envKey = envKey.substring(1); // Remove leading underscore if present
            }
            
            if (envObject.hasOwnProperty(envKey)) {
                console.log(`[${getTimestamp()}] Updating ${envKey}: "${envObject[envKey]}" => "${value}"`);
                envObject[envKey] = value;
                process.env[envKey] = value; // Update in process.env
                updated = true;
            } else {
                console.log(`[${getTimestamp()}] Variable ${envKey} not found in .env. Skipping.`);
            }
        });

        if (!updated) {
            return res.status(400).json({ 
                success: false, 
                error: 'No valid environment variables provided for update.' 
            });
        }

        // Convert back to .env file format and write it
        const updatedEnvContent = Object.entries(envObject)
            .map(([key, val]) => `${key}=${val}`)
            .join('\n');

        fs.writeFileSync(envPath, updatedEnvContent, 'utf8');
        console.log(`[${getTimestamp()}] Successfully updated .env file.`);

        res.json({ 
            success: true, 
            message: 'Environment variables updated and reloaded successfully.',
            updatedVars: updatedVars // Include any auto-updated values
        });
    } catch (error) {
        console.error(`[${getTimestamp()}] Error updating environment:`, error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to update environment variables.' 
        });
    }
});

// Verify Canvas endpoint (now using the shared verification function)
app.get('/verifycanvas/:canvasId', async (req, res) => {
    const { canvasId } = req.params;
    
    try {
        const result = await verifyCanvas(canvasId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            exists: false, 
            error: error.message 
        });
    }
});

// ------------------- Other Endpoints -------------------

// Prepare for file uploads
const uploadDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadDir));

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`[${getTimestamp()}] Created upload directory at ${uploadDir}`);
}

// Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const sanitizedFilename = file.originalname.replace(/\s+/g, '_');
        cb(null, uniqueSuffix + '-' + sanitizedFilename);
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Supported file extensions and widget mapping
const supportedFileExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "tiff", "mp4", "avi", "mov", "wmv", "pdf", "mkv"];
const widgetTypeMapping = {
    'jpg': { type: 'Image', endpoint: '/images' },
    'jpeg': { type: 'Image', endpoint: '/images' },
    'png': { type: 'Image', endpoint: '/images' },
    'gif': { type: 'Image', endpoint: '/images' },
    'bmp': { type: 'Image', endpoint: '/images' },
    'tiff': { type: 'Image', endpoint: '/images' },
    'mp4': { type: 'Video', endpoint: '/videos' },
    'avi': { type: 'Video', endpoint: '/videos' },
    'mov': { type: 'Video', endpoint: '/videos' },
    'wmv': { type: 'Video', endpoint: '/videos' },
    'mkv': { type: 'Video', endpoint: '/videos' },
    'pdf': { type: 'PDF', endpoint: '/pdfs' },
};

// Path to users.json
const usersFilePath = path.join(__dirname, 'users.json');

// Read users from users.json
function readUsers() {
    try {
        if (!fs.existsSync(usersFilePath)) {
            fs.writeFileSync(usersFilePath, JSON.stringify({}), 'utf8');
        }
        const data = fs.readFileSync(usersFilePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`[${getTimestamp()}] Error reading users.json:`, err);
        return {};
    }
}

// Write users to users.json
function writeUsers(users) {
    try {
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 4), 'utf8');
        console.log(`[${getTimestamp()}] users.json updated successfully.`);
    } catch (err) {
        console.error(`[${getTimestamp()}] Error writing to users.json:`, err);
    }
}

// Color utilities
function hexToHsl(hex) {
    hex = hex.replace(/^#/, '');
    let r = parseInt(hex.substring(0,2), 16) / 255;
    let g = parseInt(hex.substring(2,4), 16) / 255;
    let b = parseInt(hex.substring(4,6), 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s;
    let l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
            case g: h = ((b - r) / d + 2); break;
            case b: h = ((r - g) / d + 4); break;
        }
        h /= 6;
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

// Convert an HSL color back to HEX
function hslToHex(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l*s;
        const p = 2*l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    const toHex = x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    // Append 'FF' for full opacity
    return `#${toHex(r)}${toHex(g)}${toHex(b)}FF`;
}

// ------------------------------- Team Color Functions --------------------------

// Get base color for a specific team
function getTeamBaseColor(team) {
    const teamColors = {
        1: "#FF0000FF", // Red
        2: "#FF7F00FF", // Orange
        3: "#FFFF00FF", // Yellow
        4: "#00FF00FF", // Green
        5: "#0000FFFF", // Blue
        6: "#4B0082FF", // Indigo
        7: "#8B00FFFF"  // Violet
    };
    return teamColors[team];
}

// Generate a color variation for a user based on team color
function generateColorVariation(baseColor) {
    const hsl = hexToHsl(baseColor);
    // Adjust the lightness by ±10%
    let newL = hsl.l + (Math.random() * 20 - 10);
    newL = Math.min(100, Math.max(0, newL));
    return hslToHex(hsl.h, hsl.s, newL);
}

// Utility
function getTimestamp() {
    return new Date().toISOString();
}

// Middleware for admin password (only used on admin-specific actions)
function validateAdminPassword(req, res, next) {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ success: false, error: 'Admin password is required.' });
    }
    if (password !== process.env.WEBUI_PWD) {
        return res.status(401).json({ success: false, error: 'Invalid admin password.' });
    }
    next();
}

// ------------------- Endpoints -------------------
// Define the /env-variables endpoint
/*app.get('/env-variables', (req, res) => {
    // Define the path to the .env file (adjust if your structure is different)
    const envPath = path.resolve(__dirname, '..', '.env');

    try {
        // Read the .env file synchronously
        const envFile = fs.readFileSync(envPath, 'utf8');

        // Parse the .env file content
        const envConfig = dotenv.parse(envFile);

        // Filter out variables that contain 'key' in their names (case-insensitive)
        const filteredEnv = {};
        for (const [key, value] of Object.entries(envConfig)) {
            if (!key.toLowerCase().includes('key')) {
                filteredEnv[key] = value;
            }
        }

        // Return the filtered environment variables as JSON
        res.json(filteredEnv);
        console.log(`current filtered env variables are ${filteredEnv} .`);
    } catch (error) {
        console.error('Error reading .env file:', error);
        res.status(500).json({ success: false, error: 'Failed to read environment variables.' });
    }
});*/

app.get("/api/macros/deleted-records", (req, res) => {
    console.log("[/api/macros/deleted-records] route invoked.");
    try {
      const records = readDeletedRecords(); // your helper that reads macros-deleted-records.json
      // Return minimal data: recordId + timestamp
      const minimal = records.map(r => ({
        recordId: r.recordId,
        timestamp: r.timestamp
      }));
      console.log(`[deleted-records] returning ${minimal.length} record(s).`);
      return res.json({ success: true, records: minimal });
    } catch (err) {
      console.error("[deleted-records] error:", err.message);
      return res.status(500).json({ success: false, error: "Error loading records." });
    }
  });

// Identify User (no password)
app.post('/identify-user', [
    body('team').isInt({ min: 1, max: 7 }).withMessage('Team must be an integer between 1 and 7.'),
    body('name').isString().trim().escape().notEmpty().withMessage('Name is required.')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { team, name } = req.body;
    const users = readUsers();

    // Ensure team object exists
    if (!users[team]) {
        users[team] = {};
    }

    // Check if user exists, otherwise create a new color variation
    if (users[team][name]) {
        return res.json({ success: true, color: users[team][name] });
    } else {
        const teamBaseColor = getTeamBaseColor(team);
        if (!teamBaseColor) {
            return res.status(400).json({ success: false, error: 'Invalid team selected.' });
        }
        const newColor = generateColorVariation(teamBaseColor);
        users[team][name] = newColor;
        writeUsers(users);
        return res.json({ success: true, color: newColor });
    }
});

// Define the /validateAdminPassword routed
app.post('/validateAdminPassword', validateAdminPassword, (req, res) => {
    // If the middleware passes, authentication is successful
    res.json({ success: true });
});

// Update Environment Variables (admin password required)
app.post('/update-env', [
  body('password').isString().trim().notEmpty().withMessage('Password is required.')
], validateAdminPassword, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { password, ...updatedVars } = req.body;
  const envPath = path.join(__dirname, '..', '.env');

  console.log(`[update-env] Updating .env file at: ${envPath}`);
  console.log(`[update-env] Variables to update:`, updatedVars);

  // Read existing .env file
  let envContent;
  try {
      envContent = fs.readFileSync(envPath, 'utf8');
      console.log(`[update-env] Successfully read .env file.`);
  } catch (err) {
      console.error(`[update-env] Failed to read .env file:`, err.message);
      return res.status(500).json({ success: false, error: 'Failed to read .env file.' });
  }

  // Convert .env content into an object
  const envObject = {};
  envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...vals] = trimmedLine.split('=');
          envObject[key.trim()] = vals.join('=').trim();
      }
  });

  // Update variables
  let updated = false;
  Object.entries(updatedVars).forEach(([key, value]) => {
      // Transform camelCase to uppercase with underscores
      let envKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
      if (envKey.startsWith('_')) {
          envKey = envKey.substring(1); // Remove leading underscore if present
      }
      
      if (envObject.hasOwnProperty(envKey)) {
          console.log(`[${getTimestamp()}] Updating ${envKey}: "${envObject[envKey]}" => "${value}"`);
          envObject[envKey] = value;
          process.env[envKey] = value; // Update in process.env
          updated = true;
      } else {
          console.log(`[${getTimestamp()}] Variable ${envKey} not found in .env. Skipping.`);
      }
  });

  if (!updated) {
      console.warn(`[update-env] No variables updated.`);
      return res.status(400).json({ success: false, error: 'No valid environment variables provided for update.' });
  }

  // Convert back to .env file format and write it
  const updatedEnvContent = Object.entries(envObject)
      .map(([key, val]) => `${key}=${val}`)
      .join('\n');

  try {
      fs.writeFileSync(envPath, updatedEnvContent, 'utf8');
      console.log(`[update-env] Successfully updated .env file.`);
  } catch (err) {
      console.error(`[update-env] Failed to write to .env file:`, err.message);
      return res.status(500).json({ success: false, error: 'Failed to update .env file.' });
  }

  // Reload environment variables
  try {
      const reloadResult = loadEnv(); // Assumes the loadEnv function is defined
      console.log(`[update-env] Environment variables reloaded:`, reloadResult);
  } catch (err) {
      console.error(`[update-env] Error reloading environment variables:`, err.message);
      return res.status(500).json({ success: false, error: 'Failed to reload environment variables.' });
  }

  res.json({ success: true, message: 'Environment variables updated and reloaded successfully.' });
});

// Find Canvas Progress Endpoint
app.get("/find-canvas-progress", (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Store the response object in app.locals for use in other routes
    app.locals.sseRes = res;
    
    // Send an initial message
    res.write('data: Initializing search...\n\n');
});

// Helper function to send SSE messages
function sendSSEMessage(message) {
    console.log(message); // Keep console logging
    if (app.locals.sseRes) {
        app.locals.sseRes.write(`data: ${message}\n\n`);
    }
}

// Find Canvas
app.post("/find-canvas", async (req, res) => {
    const { uid } = req.body;
    if (!uid) {
        sendSSEMessage("Error: UID is required.");
        return res.status(400).json({ error: "UID is required." });
    }

    try {
        sendSSEMessage(`Searching for UID: "${uid}"`);
        const response = await apiClient.get(`/api/v1/canvases`);

        const canvases = response.data;
        if (!Array.isArray(canvases)) {
            throw new Error("Invalid response format: canvases should be an array.");
        }

        sendSSEMessage(`Retrieved ${canvases.length} canvases.`);
        let foundMatch = false;

        for (const canvas of canvases) {
            const { id: canvasId, name: canvasName } = canvas;
            sendSSEMessage(`Processing Canvas ID: ${canvasId}`);

            try {
                const browsersResponse = await apiClient.get(
                    `/api/v1/canvases/${canvasId}/browsers`
                );

                const browsers = browsersResponse.data;
                if (!Array.isArray(browsers)) {
                    throw new Error(`Invalid browsers format for canvas ${canvasId}.`);
                }

                sendSSEMessage(`Retrieved ${browsers.length} browsers for Canvas ID: ${canvasId}`);

                for (let i = 1; i <= browsers.length; i++) {
                    const browser = browsers[i-1];
                    sendSSEMessage(`Checking Browser ${i}`);

                    if (browser.url && browser.url.includes(uid)) {
                        foundMatch = true;
                        sendSSEMessage(`Match found in Canvas: "${canvasName}" (ID: ${canvasId})`);
                        if (app.locals.sseRes) {
                            app.locals.sseRes.end();
                            app.locals.sseRes = null;
                        }
                        return res.json({ canvasName, canvasId });
                    }
                }

                sendSSEMessage(`No matching browser found in Canvas ID: ${canvasId}`);
            } catch (error) {
                const errorMsg = error.response?.data?.msg || error.message;
                if (errorMsg.toLowerCase().includes('archived')) {
                    sendSSEMessage(`Skipping archived Canvas ID: ${canvasId} (${canvasName})`);
                    continue;
                }
                throw error;
            }
        }

        if (!foundMatch) {
            sendSSEMessage(`No matching canvas found for UID: "${uid}"`);
            if (app.locals.sseRes) {
                app.locals.sseRes.end();
                app.locals.sseRes = null;
            }
            res.status(404).json({ error: "No matching canvas found." });
        }
    } catch (error) {
        sendSSEMessage(`Error occurred during search: ${error.message}`);
        if (app.locals.sseRes) {
            app.locals.sseRes.end();
            app.locals.sseRes = null;
        }
        res.status(500).json({ error: "Failed to process request." });
    }
});


// GET /api/macros/deleted-details?recordId=<someId>
app.get("/api/macros/deleted-details", (req, res) => {
    console.log("[/api/macros/deleted-details] route invoked.");
  
    const { recordId } = req.query;
    if (!recordId) {
      return res.status(400).json({ success: false, error: "recordId is required." });
    }
  
    try {
      // 1) Read macros-deleted-records.json
      const records = readDeletedRecords(); // your existing helper
      // 2) Find the matching record
      const record = records.find(r => r.recordId === recordId);
      if (!record) {
        return res.status(404).json({ success: false, error: "No such recordId found." });
      }
  
      // record.widgets is the array of deleted widgets
      const itemCount = record.widgets ? record.widgets.length : 0;
  
      // Build a type breakdown, e.g. { Note: 5, PDF: 2, Connector: 1, ... }
      const typeCounts = {};
      if (record.widgets) {
        for (const w of record.widgets) {
          const t = (w.widget_type || "Unknown").toLowerCase();
          if (!typeCounts[t]) {
            typeCounts[t] = 0;
          }
          typeCounts[t]++;
        }
      }
  
      console.log(`[deleted-details] Found ${itemCount} widget(s) in recordId=${recordId}`);
  
      // 3) Return the count + breakdown
      return res.json({
        success: true,
        count: itemCount,
        types: typeCounts
      });
    } catch (err) {
      console.error("[deleted-details] Error:", err.message);
      return res.status(500).json({ success: false, error: "Failed to load record details." });
    }
  });

// Check if the provided canvasName/ID match the .env config
app.get("/check-env", (req, res) => {
    const { canvasName, canvasId } = req.query;

    if (!canvasName || !canvasId) {
        console.error(`[${getTimestamp()}] Canvas name or ID is missing in the request.`);
        return res.status(400).json({ error: "Canvas name and ID are required." });
    }

    try {
        const envPath = path.resolve(__dirname, "../.env");
        const envData = fs.readFileSync(envPath, "utf-8");

        const envVariables = Object.fromEntries(
            envData
                .split("\n")
                .filter(line => line.includes("="))
                .map(line => {
                    const [key, ...rest] = line.split("=");
                    return [key.trim(), rest.join("=").trim()];
                })
        );

        const matches = envVariables.CANVAS_NAME === canvasName && envVariables.CANVAS_ID === canvasId;

        console.log(`[${getTimestamp()}] Environment check for Canvas ID: ${canvasId}: ${matches ? "Matched" : "Did Not Match"}`);
        return res.json({ matches });
    } catch (error) {
        console.error(`[${getTimestamp()}] Error reading .env file:`, error.message);
        res.status(500).json({ error: "Failed to read .env file." });
    }
});



// ------------------------------- Get Zones Endpoint -----------------------------

// Fetch all anchors (zones) from the canvas
app.get('/get-zones', async (req, res) => {
    console.log('[/get-zones] route invoked.');
    try {
        const response = await apiClient.get(`/api/v1/canvases/${process.env.CANVAS_ID}/anchors`);
        res.json({ success: true, zones: response.data });
    } catch (error) {
        console.error('[/get-zones] Detailed error:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            headers: error.response?.headers
        });
        res.status(error.response?.status || 500).json({
            error: error.message,
            details: error.response?.data
        });
    }
});



  /******************************************************************************
 * MACROS DELETED RECORDS FILE
 * Store and retrieve deletion logs with bounding boxes for Undelete scaling.
 ******************************************************************************/
const DELETED_RECORDS_FILE = path.join(__dirname, 'macros-deleted-records.json');

/** readDeletedRecords(), writeDeletedRecords()... */
function readDeletedRecords() {
  if (!fs.existsSync(DELETED_RECORDS_FILE)) {
    fs.writeFileSync(DELETED_RECORDS_FILE, JSON.stringify([]), 'utf8');
  }
  return JSON.parse(fs.readFileSync(DELETED_RECORDS_FILE, 'utf8'));
}
function writeDeletedRecords(records) {
  fs.writeFileSync(DELETED_RECORDS_FILE, JSON.stringify(records, null, 2), 'utf8');
}
  
/******************************************************************************
 * CORE HELPERS
 ******************************************************************************/
async function getAllWidgets() {
    const url = `/api/v1/canvases/${process.env.CANVAS_ID}/widgets`;
    const { data } = await apiClient.get(url);
    return data;
  }
  
  async function getZoneBoundingBox(zoneId) {
    const url = `/api/v1/canvases/${process.env.CANVAS_ID}/anchors/${zoneId}`;
    const { data } = await apiClient.get(url);
    if (!data || !data.location || !data.size) {
      throw new Error(`Invalid or missing anchor data for zone ID: ${zoneId}`);
    }
    return {
      x: data.location.x,
      y: data.location.y,
      width: data.size.width,
      height: data.size.height,
      scale: data.scale || 1,
    };
  }
  
  function widgetIsInZone(widget, zoneBB) {
    if (!widget.location) return false;
    const wx = widget.location.x;
    const wy = widget.location.y;
    const withinX = wx >= zoneBB.x + 2 && wx <= zoneBB.x + zoneBB.width - 2;
    const withinY = wy >= zoneBB.y + 2 && wy <= zoneBB.y + zoneBB.height - 2;
    return withinX && withinY;
  }
  
  function transformWidgetLocationAndScale(widget, sourceBB, targetBB) {
    const scaleFactor = targetBB.width / sourceBB.width;
    const deltaX = widget.location.x - sourceBB.x;
    const deltaY = widget.location.y - sourceBB.y;
    widget.location.x = targetBB.x + deltaX * scaleFactor;
    widget.location.y = targetBB.y + deltaY * scaleFactor;
    const oldScale = widget.scale || 1;
    widget.scale = oldScale * scaleFactor;
  }
  
  function getWidgetPatchURL(widget) {
    const t = (widget.widget_type || "").toLowerCase();
    switch (t) {
      case "note":      return "/notes";      
      case "browser":   return "/browsers";
      case "image":     return "/images";
      case "pdf":       return "/pdfs";
      case "video":     return "/videos";
      case "connector": return "/connectors";
      case "anchor":    return "/anchors";  // or skip them entirely
      default:
        console.log(`[getWidgetPatchURL] Unrecognized widget_type="${widget.widget_type}", defaulting to /notes`);
        return "/notes";
    }
  }
  
  async function patchWidgetAtURL(routePrefix, widgetId, body) {
    const patchEndpoint = `/api/v1/canvases/${process.env.CANVAS_ID}${routePrefix}/${widgetId}`;
    let tries = 0;
    let success = false;
    let lastError = null;
    while (tries < 3 && !success) {
      try {
        await apiClient.patch(patchEndpoint, body);
        success = true;
      } catch (err) {
        tries++;
        lastError = err;
        if (tries < 3) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    if (!success && lastError) {
      throw lastError;
    }
  }
  
////////////////////////////////////////////////////////////////////////////////
// Move
////////////////////////////////////////////////////////////////////////////////
app.post("/api/macros/move", async (req, res) => {
    console.log("[/api/macros/move] route invoked.");
    const { sourceZoneId, targetZoneId } = req.body;
    if (!sourceZoneId || !targetZoneId) {
      return res.status(400).send("sourceZoneId and targetZoneId are required.");
    }
    try {
    console.log(`[move] Getting bounding box for sourceZoneId=${sourceZoneId}`);
      const sourceBB = await getZoneBoundingBox(sourceZoneId);
    console.log("[move] sourceBB=", sourceBB);

    console.log(`[move] Getting bounding box for targetZoneId=${targetZoneId}`);
      const targetBB = await getZoneBoundingBox(targetZoneId);
    console.log("[move] targetBB=", targetBB);

    console.log("[move] Fetching all widgets from canvas...");
      const allWidgets = await getAllWidgets();
    console.log(`[move] total widgets: ${allWidgets.length}`);

    console.log("[move] Filtering widgets in source zone (excluding anchors, connectors)...");
    const toMove = [];
    for (const w of allWidgets) {
      const wt = (w.widget_type || "").toLowerCase();
      if (!w.location) {
        // Possibly a connector or arrow with no location
        console.log(`[move] Skipping widget ID=${w.id}, no w.location => likely connector or special widget.`);
        continue;
      }
      if (wt === "connector" || wt === "anchor") {
        console.log(`[move] Skipping widget ID=${w.id}, type=${w.widget_type}.`);
        continue;
      }
      if (widgetIsInZone(w, sourceBB)) {
        console.log(`[move] => including widget ID=${w.id}, type=${w.widget_type}, location=`, w.location);
        toMove.push(w);
      }
    }
    console.log(`[move] Found ${toMove.length} widgets to move.`);
  
      let movedCount = 0;
    for (const w of toMove) {
        const cloned = JSON.parse(JSON.stringify(w));
        transformWidgetLocationAndScale(cloned, sourceBB, targetBB);
        const route = getWidgetPatchURL(w);

      console.log(`[move] PATCHing widget ID=${w.id} route=${route} newLoc=`, cloned.location, " newScale=", cloned.scale);
        await patchWidgetAtURL(route, w.id, {
          location: cloned.location,
          scale: cloned.scale
        });
        movedCount++;
      }

    console.log(`[move] Done. Moved ${movedCount} widgets.`);
      return res.json({ success: true, message: `${movedCount} widgets moved.` });
    } catch (err) {
      console.error("Error in /api/macros/move:", err.message);
      return res.status(500).send(err.message);
    }
  });
  
////////////////////////////////////////////////////////////////////////////////
// Copy
////////////////////////////////////////////////////////////////////////////////
app.post("/api/macros/copy", async (req, res) => {
    console.log("[/api/macros/copy] route invoked.");
    const { sourceZoneId, targetZoneId } = req.body;
    if (!sourceZoneId || !targetZoneId) {
      return res.status(400).send("sourceZoneId and targetZoneId are required.");
    }
  
    try {
      const sourceBB = await getZoneBoundingBox(sourceZoneId);
      const targetBB = await getZoneBoundingBox(targetZoneId);
      console.log("[copy] sourceBB =>", sourceBB, "targetBB =>", targetBB);
  
      const allWidgets = await getAllWidgets();
      console.log(`[copy] total widgets: ${allWidgets.length}`);
  
      // 1) Identify normal widgets in the zone
      const inZoneSet = new Set(); // to store widget IDs in the zone
      for (const w of allWidgets) {
        const wt = (w.widget_type || "").toLowerCase();
        if (wt === "anchor") continue;
        if (wt !== "connector" && w.location && widgetIsInZone(w, sourceBB)) {
          inZoneSet.add(w.id);
        }
      }
  
      // 2) Build a final "inSource" array that includes:
      //    - Normal widgets that are physically in the zone.
      //    - Connectors only if BOTH src/dst are in inZoneSet
      const inSource = [];
      for (const w of allWidgets) {
        const wt = (w.widget_type || "").toLowerCase();
        if (wt === "anchor") {
          // skip anchors
          continue;
        } else if (wt === "connector") {
          // only include connector if both endpoints in zone
          const sId = w.src?.id;
          const dId = w.dst?.id;
          if (sId && dId && inZoneSet.has(sId) && inZoneSet.has(dId)) {
            console.log(`[copy] Including connector ID=${w.id} (both endpoints in zone).`);
            inSource.push(w);
          }
        } else {
          if (inZoneSet.has(w.id)) {
            inSource.push(w);
          }
        }
      }
      console.log(`[copy] Found ${inSource.length} items in final inSource (incl. connectors).`);
  
      // 3) BFS logic
      const allMap = new Map();
      inSource.forEach(w => allMap.set(w.id, w));
      const copiedMap = new Map();
  
      function canCopy(w) {
        const wt = (w.widget_type || "").toLowerCase();
        if (wt === "connector") {
          const sId = w.src?.id;
          const dId = w.dst?.id;
          if (!sId || !dId) return false;
          // only copy if both endpoints in zone & both are already copied
          return (copiedMap.has(sId) && copiedMap.has(dId));
        } else {
          if (!w.parent_id) return true;
          if (!allMap.has(w.parent_id)) return true;
          return copiedMap.has(w.parent_id);
        }
      }
  
      let attempts = inSource.length;
      let safetyCounter = 0;
  
      while (attempts > 0 && safetyCounter < 1000) {
        for (const w of inSource) {
          if (!copiedMap.has(w.id) && canCopy(w)) {
            const cloned = JSON.parse(JSON.stringify(w));
            delete cloned.id;
  
            const wt = (w.widget_type || "").toLowerCase();
            if (wt !== "connector") {
              if (cloned.location) {
                transformWidgetLocationAndScale(cloned, sourceBB, targetBB);
              }
              if (allMap.has(w.parent_id)) {
                const newParent = copiedMap.get(w.parent_id);
                if (newParent) cloned.parent_id = newParent;
                else delete cloned.parent_id;
              }
              if (cloned.auto_text_color === true) {
                delete cloned.text_color;
              }
            } else {
              // Fix src/dst to new IDs
              const oldSrc = w.src?.id;
              const oldDst = w.dst?.id;
              if (oldSrc && oldDst && copiedMap.has(oldSrc) && copiedMap.has(oldDst)) {
                cloned.src.id = copiedMap.get(oldSrc);
                cloned.dst.id = copiedMap.get(oldDst);
              }
            }
  
            const route = getWidgetPatchURL(w).replace("/", "");
            const postURL = `/api/v1/canvases/${process.env.CANVAS_ID}/${route}`;
            console.log(`[copy] POST new widget oldID=${w.id}`, JSON.stringify(cloned));
  
            try {
              const resp = await apiClient.post(postURL, cloned);
              copiedMap.set(w.id, resp.data.id);
            } catch (postErr) {
              console.error(`[copy] POST error ID=${w.id}:`, postErr.message);
            }
          }
        }
        const copiedCount = copiedMap.size;
        attempts = inSource.length - copiedCount;
        safetyCounter++;
      }
  
      console.log(`[copy] Done. Copied ${copiedMap.size} item(s).`);
      return res.json({
        success: true,
        message: `${copiedMap.size} widgets copied (connectors only if both endpoints in zone).`
      });
    } catch (err) {
      console.error("Error in /api/macros/copy:", err.message);
      return res.status(500).send(err.message);
    }
  });
  
  
  ////////////////////////////////////////////////////////////////////////////////
  // Delete
  ////////////////////////////////////////////////////////////////////////////////
  app.post("/api/macros/delete", async (req, res) => {
    console.log("[/api/macros/delete] route invoked.");
    const { zoneId } = req.body;
    if (!zoneId) {
      return res.status(400).send("zoneId is required.");
    }
    try {
      const zoneBB = await getZoneBoundingBox(zoneId);
      const allWidgets = await getAllWidgets();
  
      // 1) Collect normal widgets in zone
      const inZoneSet = new Set();
      for (const w of allWidgets) {
        const wt = (w.widget_type || "").toLowerCase();
        if (wt === "anchor") continue;
        if (wt !== "connector" && w.location && widgetIsInZone(w, zoneBB)) {
          inZoneSet.add(w.id);
        }
      }
  
      // 2) Build final "toDelete" array
      //    - normal widgets that are physically in zone
      //    - connectors only if both endpoints are in inZoneSet
      const toDelete = [];
      for (const w of allWidgets) {
        const wt = (w.widget_type || "").toLowerCase();
  
        if (wt === "anchor") {
          continue;
        } else if (wt === "connector") {
          const sId = w.src?.id;
          const dId = w.dst?.id;
          if (sId && dId && inZoneSet.has(sId) && inZoneSet.has(dId)) {
            console.log(`[delete] Deleting connector ID=${w.id} (both endpoints in zone).`);
            toDelete.push(w);
          }
        } else if (w.location) {
          if (inZoneSet.has(w.id)) {
            toDelete.push(w);
          }
        }
      }
      console.log(`[delete] found ${toDelete.length} items to remove.`);
  
      // 3) Save them to record for undelete
      const recordId = `rec-${Date.now()}`;
      const record = {
        recordId,
        timestamp: new Date().toISOString(),
        zoneBB,
        widgets: toDelete
      };
      const existing = readDeletedRecords();
      existing.push(record);
      writeDeletedRecords(existing);
  
      // 4) actually delete
      let deletedCount = 0;
      for (const w of toDelete) {
        const route = getWidgetPatchURL(w);
        const url = `/api/v1/canvases/${process.env.CANVAS_ID}${route}/${w.id}`;
        console.log(`[delete] Deleting ID=${w.id}, route=${route}`);
        try {
          await apiClient.delete(url);
          deletedCount++;
        } catch (delErr) {
          console.error(`[delete] Error removing ID=${w.id}:`, delErr.message);
        }
      }
  
      return res.json({
        success: true,
        message: `${deletedCount} widgets removed (connectors only if both endpoints in zone). RecordID=${recordId}`
      });
    } catch (err) {
      console.error("Error in /api/macros/delete:", err.message);
      return res.status(500).send(err.message);
    }
  });
  
  /******************************************************************************
   * UNDELETE
   ******************************************************************************/
  app.post("/api/macros/undelete", async (req, res) => {
    console.log("[/api/macros/undelete] route invoked.");
    const { recordId, targetZoneId } = req.body;
    if (!recordId || !targetZoneId) {
      return res.status(400).send("recordId and targetZoneId are required.");
    }
  
    try {
      // 1) Locate the record in macros-deleted-records.json
      const records = readDeletedRecords();
      const idx = records.findIndex(r => r.recordId === recordId);
      if (idx < 0) {
        console.log("[undelete] No matching recordId found:", recordId);
        return res.status(404).send("No such deleted record found.");
      }
  
      const record = records[idx];
      const sourceBB = record.zoneBB; // original bounding box
      const targetBB = await getZoneBoundingBox(targetZoneId);
      const itemsToRestore = record.widgets || [];
  
      console.log(`[undelete] Restoring ${itemsToRestore.length} widget(s) from recordId=${recordId}`);
  
      // 2) BFS approach: oldId -> newId
      const toRestoreMap = new Map(); 
      itemsToRestore.forEach(w => toRestoreMap.set(w.id, w));
  
      const restoredMap = new Map(); // oldId -> newId
  
      function canRestore(w) {
        const wt = (w.widget_type || "").toLowerCase();
        if (wt === "connector") {
          // only restore connectors if both endpoints have new IDs
          const sId = w.src?.id;
          const dId = w.dst?.id;
          if (!sId || !dId) return false;
          const sInSet = toRestoreMap.has(sId);
          const dInSet = toRestoreMap.has(dId);
          const sRestored = restoredMap.has(sId);
          const dRestored = restoredMap.has(dId);
          if (sInSet && dInSet) {
            return (sRestored && dRestored);
          }
          return false;
        } else {
          // normal BFS logic if there's a parent
          if (!w.parent_id) return true;
          if (!toRestoreMap.has(w.parent_id)) return true;
          return restoredMap.has(w.parent_id);
        }
      }
  
      let attempts = itemsToRestore.length;
      let safety = 0;
      let restoredCount = 0;
  
      // 3) BFS loop
      while (attempts > 0 && safety < 1000) {
        for (const w of itemsToRestore) {
          if (!restoredMap.has(w.id) && canRestore(w)) {
            // Clone & remove old ID
            const cloned = JSON.parse(JSON.stringify(w));
            delete cloned.id;
  
            const wt = (w.widget_type || "").toLowerCase();
  
            if (wt !== "connector") {
              // transform location if it exists
              if (cloned.location) {
                transformWidgetLocationAndScale(cloned, sourceBB, targetBB);
              }
              // fix parent
              if (toRestoreMap.has(w.parent_id)) {
                const newParent = restoredMap.get(w.parent_id);
                if (newParent) cloned.parent_id = newParent; 
                else delete cloned.parent_id;
              }
  
              // remove text_color if auto_text_color is true
              if (cloned.auto_text_color === true) {
                delete cloned.text_color;
              }
            } else {
              // connectors: fix src/dst
              const sId = w.src?.id;
              const dId = w.dst?.id;
              if (sId && dId && restoredMap.has(sId) && restoredMap.has(dId)) {
                cloned.src.id = restoredMap.get(sId);
                cloned.dst.id = restoredMap.get(dId);
              }
            }
  
            // POST the cloned data
            const route = getWidgetPatchURL(w).replace("/", "");
            const postURL = `/api/v1/canvases/${process.env.CANVAS_ID}/${route}`;
            console.log(`[undelete] POST new widget from old ID=${w.id}, route=${route}`, JSON.stringify(cloned, null, 2));
  
            try {
              const resp = await apiClient.post(postURL, cloned);
              restoredMap.set(w.id, resp.data.id);
              restoredCount++;
            } catch (postErr) {
              console.error(`[undelete] POST error widget ID=${w.id}:`, postErr.message);
            }
          }
        }
        const restoredSoFar = restoredMap.size;
        attempts = itemsToRestore.length - restoredSoFar;
        safety++;
      }
  
      console.log(`[undelete] Done. Restored ${restoredCount} widget(s).`);
      return res.json({
        success: true,
        message: `${restoredCount} widgets restored from recordId=${recordId}.`
      });
    } catch (err) {
      console.error("[undelete] Error in /api/macros/undelete:", err.message);
      return res.status(500).send(err.message);
    }
  });
  
  ////////////////////////////////////////////////////////////////////////////////
// CLIENT-SIDE: "In-Page Confirmation Dialog" example for Undelete
// The idea is: when you click an item in #deletedRecordsList, we show a
// confirmation before calling the POST /api/macros/undelete.
////////////////////////////////////////////////////////////////////////////////

function handleDeletionRecordClick(e) {
    const div = e.currentTarget;
    const recordId = div.dataset.recordId;
    const targetZoneId = document.getElementById("undeleteTargetZone").value;
  
    if (!recordId) {
      displayMessage("Invalid recordId for undelete.");
      return;
    }
    if (!targetZoneId) {
      displayMessage("Please select a target zone for undelete.");
      return;
    }
  
    // Show a basic in-page confirmation
    // For example, create a modal or just confirm() for a quick approach:
    const confirmed = window.confirm(`Are you sure you want to restore record [${recordId}]?`);
    if (!confirmed) {
      displayMessage(`Undelete of record [${recordId}] canceled by user.`);
      return;
    }
  
    // If user confirmed, do the POST
    undeleteRecord(recordId, targetZoneId);
  }
  
  async function undeleteRecord(recordId, targetZoneId) {
    try {
      const payload = { recordId, targetZoneId };
      const resp = await postJson("/api/macros/undelete", payload);
      displayMessage(resp.message);
      // Optionally refresh the list again
      refreshDeletedRecords();
    } catch (err) {
      displayMessage(err.message);
    }
  }
  
  /******************************************************************************
 * AUTO-GRID (New Logic)
 * 
 * Instead of using user-defined rows/cols, we:
 * 1) Count how many items we have in the zone.
 * 2) Compute a "gridSize" such that gridSize x gridSize >= numberOfItems.
 *    Example: if we have 10 items, the nearest uniform grid might be 4x4=16.
 * 3) Compute item scale so each item's height fits the cell. Then we apply that
 *    scale to its location. We maintain at least 50 units between items.
 *
 * Example Steps:
 *   - # items => N
 *   - gridSize = ceil( sqrt(N) )
 *   - cellWidth = (zoneBB.width / gridSize)
 *   - cellHeight = (zoneBB.height / gridSize)
 *   - Use the smaller dimension (height or width) to set scale factor. 
 *     The item's new height <= cellHeight - 50?? Or we fix 50 units between them?
 *   - Place items left-to-right, top-to-bottom in that grid.
 ******************************************************************************/
/******************************************************************************
 * AUTO-GRID (Enhanced)
 ******************************************************************************/
app.post("/api/macros/auto-grid", async (req, res) => {
    console.log("[/api/macros/auto-grid] route invoked.");
    const { zoneId } = req.body; // Removed 'rows' and 'cols'
    if (!zoneId) {
      return res.status(400).send("zoneId is required for auto-grid.");
    }
  
    try {
      const zoneBB = await getZoneBoundingBox(zoneId);
      const allWidgets = await getAllWidgets();
  
      // Filter widgets within the zone, excluding connectors and anchors
      const inZone = allWidgets.filter(w => {
        if (w.id === zoneId) return false;
        if (!w.location) return false;
        const type = (w.widget_type || "").toLowerCase();
        if (type === "connector" || type === "anchor") return false;
        return widgetIsInZone(w, zoneBB);
      });
  
      const n = inZone.length;
      if (n === 0) {
        return res.json({ success: true, message: "No widgets found to auto-grid." });
      }
  
      // Determine the best grid size (rows and cols) based on number of widgets and zone dimensions
      function determineGrid(n, zoneWidth, zoneHeight, buffer) {
        const aspectRatio = zoneWidth / zoneHeight;
        let bestRows = 1;
        let bestCols = n;
        let minEmptySpace = Infinity;
  
        for (let rows = 1; rows <= n; rows++) {
          const cols = Math.ceil(n / rows);
          const cellWidth = (zoneWidth - buffer * (cols + 1)) / cols;
          const cellHeight = (zoneHeight - buffer * (rows + 1)) / rows;
          const gridAspectRatio = cols / rows;
          const emptySpace = Math.abs(aspectRatio - gridAspectRatio);
  
          if (emptySpace < minEmptySpace) {
            minEmptySpace = emptySpace;
            bestRows = rows;
            bestCols = cols;
          }
        }
  
        return { rows: bestRows, cols: bestCols };
      }
  
      const buffer = 100; // 100-unit buffer around the zone
      const { rows, cols } = determineGrid(n, zoneBB.width, zoneBB.height, buffer);
  
      const cellWidth = (zoneBB.width - buffer * (cols + 1)) / cols;
      const cellHeight = (zoneBB.height - buffer * (rows + 1)) / rows;
      const finalCell = Math.min(cellWidth, cellHeight);
  
      let index = 0;
      let updatedCount = 0;
  
      for (const w of inZone) {
        const row = Math.floor(index / cols);
        const col = index % cols;
        index++;
  
        // Calculate positions with buffer
        const xPos = zoneBB.x + buffer + col * (finalCell + buffer);
        const yPos = zoneBB.y + buffer + row * (finalCell + buffer);
  
        // Calculate scale factor based on cell size
        let scaleFactor = 1;
        if (w.size && w.size.height && w.size.height > 0) {
          scaleFactor = finalCell / w.size.height;
        } else {
          // Fallback if no size information
          scaleFactor = finalCell / 300;
        }
  
        // Ensure a minimum scale factor to prevent widgets from becoming too small
        const minScale = 1;
        if (scaleFactor < minScale) {
          scaleFactor = minScale;
        }
  
        // Patch the widget's location and scale
        const patchRoute = getWidgetPatchURL(w);
        await patchWidgetAtURL(patchRoute, w.id, {
          location: { x: xPos, y: yPos },
          scale: scaleFactor
        });
        updatedCount++;
      }
  
      return res.json({
        success: true,
        message: `${updatedCount} widgets auto-gridded into a ${rows}x${cols} grid within the zone.`
      });
    } catch (err) {
      console.error("Error in /api/macros/auto-grid:", err.message);
      return res.status(500).send(err.message);
    }
  });
  
/******************************************************************************
 * GROUP BY COLOR (Enhanced with Uniform Scaling and Detailed Logging)
 ******************************************************************************/
app.post("/api/macros/group-color", async (req, res) => {
    console.log("[/api/macros/group-color] route invoked.");
    const { zoneId, tolerance } = req.body;
    if (!zoneId || !tolerance) {
      return res.status(400).send("zoneId and tolerance are required for group-color.");
    }
    try {
      const zoneBB = await getZoneBoundingBox(zoneId);
      const allW = await getAllWidgets();
      const inZone = allW.filter(w => {
        if (w.id === zoneId) return false;
        if (!w.location) return false;
        const t = (w.widget_type || "").toLowerCase();
        if (t === "connector" || t === "anchor") return false;
        return widgetIsInZone(w, zoneBB);
      });
  
      if (inZone.length === 0) {
        return res.json({ success: true, message: "No widgets found to group by color." });
      }
  
      function colorDistance(c1, c2) {
        const r1 = parseInt(c1.slice(1, 3), 16) || 0;
        const g1 = parseInt(c1.slice(3, 5), 16) || 0;
        const b1 = parseInt(c1.slice(5, 7), 16) || 0;
        const r2 = parseInt(c2.slice(1, 3), 16) || 0;
        const g2 = parseInt(c2.slice(3, 5), 16) || 0;
        const b2 = parseInt(c2.slice(5, 7), 16) || 0;
        return Math.sqrt((r1 - r2)**2 + (g1 - g2)**2 + (b1 - b2)**2);
      }
  
      const threshold = 255 * (parseInt(tolerance, 10) / 100.0);
      const clusters = [];
      for (const w of inZone) {
        const color = w.background_color || "#FFFFFF00";
        let placed = false;
        for (const cl of clusters) {
          const dist = colorDistance(color, cl.representativeColor);
          if (dist <= threshold) {
            cl.widgets.push(w);
            placed = true;
            break;
          }
        }
        if (!placed) {
          clusters.push({
            representativeColor: color,
            widgets: [w]
          });
        }
      }
  
      // Calculate available space
      const spacingX = 50; // Horizontal spacing between columns
      const spacingY = 25; // Vertical spacing between widgets
      const buffer = 100; // Buffer from zone edges
      
      const availableWidth = zoneBB.width - buffer * 2;
      const availableHeight = zoneBB.height - buffer * 2;
      
      // Calculate column width based on number of clusters
      const maxWidthPerColumn = (availableWidth - (spacingX * (clusters.length - 1))) / clusters.length;
      
      let clusterX = zoneBB.x + buffer;
      let updatedCount = 0;
  
      for (const cluster of clusters) {
        // Calculate maximum dimensions for this cluster
        let maxOriginalWidth = Math.max(...cluster.widgets.map(w => w.size?.width || 300));
        let totalOriginalHeight = cluster.widgets.reduce((acc, w) => 
          acc + (w.size?.height || 300), 0);
        
        // Add spacing between widgets in height calculation
        totalOriginalHeight += spacingY * (cluster.widgets.length - 1);
        
        // Calculate scale factors
        const scaleFactorWidth = maxWidthPerColumn / maxOriginalWidth;
        const scaleFactorHeight = availableHeight / totalOriginalHeight;
        
        // Use the smaller scale factor to ensure widgets fit both dimensions
        let scaleFactor = Math.min(scaleFactorWidth, scaleFactorHeight);
        
        // Clamp scale factor to reasonable limits
        const minScale = 0.1;
        const maxScale = 2.0;
        scaleFactor = Math.max(minScale, Math.min(maxScale, scaleFactor));
        
        let clusterY = zoneBB.y + buffer;
        
        for (const w of cluster.widgets) {
          const widgetHeight = (w.size?.height || 300) * scaleFactor;
          
          const patchData = {
            location: { x: clusterX, y: clusterY },
            scale: scaleFactor
          };
          
          try {
            await patchWidgetAtURL(getWidgetPatchURL(w), w.id, patchData);
            updatedCount++;
          } catch (err) {
            console.error(`Error updating widget ${w.id}:`, err.message);
          }
          
          clusterY += widgetHeight + spacingY;
        }
        
        clusterX += maxWidthPerColumn + spacingX;
      }
  
      return res.json({
        success: true,
        message: `${updatedCount} widgets grouped by color into ${clusters.length} cluster(s).`
      });
    } catch (err) {
      console.error("Error in /api/macros/group-color:", err.message);
      return res.status(500).send(err.message);
    }
  });
  
  
   /******************************************************************************
 * GROUP BY TITLE (Enhanced with Intelligent Scaling and Detailed Logging)
 ******************************************************************************/
app.post("/api/macros/group-title", async (req, res) => {
    console.log("[/api/macros/group-title] route invoked.");
    const { zoneId } = req.body;
    
    console.log(`Received payload: zoneId=${zoneId}`);
    
    if (!zoneId) {
      console.error("Missing zoneId in request body.");
      return res.status(400).send("zoneId is required for group-title.");
    }
  
    try {
      const zoneBB = await getZoneBoundingBox(zoneId);
      console.log(`Zone Bounding Box: ${JSON.stringify(zoneBB)}`);
      
      const allWidgets = await getAllWidgets();
      console.log(`Total widgets fetched: ${allWidgets.length}`);
      
      // Filter widgets within the zone, excluding connectors and anchors
      const inZone = allWidgets.filter(w => {
        if (w.id === zoneId) return false;
        if (!w.location) return false;
        const type = (w.widget_type || "").toLowerCase();
        if (type === "connector" || type === "anchor") return false;
        return widgetIsInZone(w, zoneBB);
      });
      
      console.log(`Widgets within zone after filtering: ${inZone.length}`);
      
      if (inZone.length === 0) {
        console.log("No widgets found to group by title.");
        return res.json({
          success: true,
          message: "No widgets found in this zone to group by title."
        });
      }
      
      // Sort widgets alphabetically by title
      inZone.sort((a, b) => {
        const tA = (a.title || "").toLowerCase();
        const tB = (b.title || "").toLowerCase();
        if (tA < tB) return -1;
        if (tA > tB) return 1;
        return 0;
      });
      
      console.log("Widgets sorted alphabetically by title.");
  
      // Group widgets by title
      const titleGroups = [];
      let currentGroup = [];
  
      inZone.forEach(w => {
        if (currentGroup.length === 0 || w.title === currentGroup[0].title) {
          currentGroup.push(w);
        } else {
          titleGroups.push(currentGroup);
          currentGroup = [w];
        }
      });
      if (currentGroup.length > 0) {
        titleGroups.push(currentGroup);
      }
  
      console.log(`Total title groups formed: ${titleGroups.length}`);
      
      const numColumns = titleGroups.length;
      const spacingX = 50; // Horizontal spacing between columns
      const spacingY = 25; // Vertical spacing between widgets
      const buffer = 100; // 100-unit buffer around the zone
      
      const availableWidth = zoneBB.width - buffer * 2 - spacingX * (numColumns - 1);
      const maxWidthPerColumn = availableWidth / numColumns;
      
      console.log(`Available width for grouping: ${availableWidth}`);
      console.log(`Max width per column: ${maxWidthPerColumn}`);
      
      const availableHeight = zoneBB.height - buffer * 2;
      console.log(`Available height for grouping: ${availableHeight}`);
      
      let columnX = zoneBB.x + buffer;
      let updatedCount = 0;
      
      for (const [clIdx, group] of titleGroups.entries()) {
        console.log(`\nProcessing Title Group ${clIdx + 1}: Title="${group[0].title}", Widgets=${group.length}`);
        
        // Determine the maximum original width and total original height in the group
        let maxOriginalWidth = Math.max(...group.map(w => w.size && w.size.width ? w.size.width : 300));
        let totalOriginalHeight = group.reduce((acc, w) => acc + (w.size && w.size.height ? w.size.height : 300), 0);
        
        console.log(`  Maximum Original Width in Group: ${maxOriginalWidth}`);
        console.log(`  Total Original Height in Group: ${totalOriginalHeight}`);
        
        // Calculate scale factors based on width and height
        const targetWidth = maxWidthPerColumn - spacingX / 2; // Allowing some spacing
        const scaleFactorWidth = targetWidth / maxOriginalWidth;
        
        const scaleFactorHeight = availableHeight / (totalOriginalHeight + spacingY * (group.length - 1));
        
        // Choose the smaller scale factor to ensure both width and height constraints are met
        let scaleFactor = Math.min(scaleFactorWidth, scaleFactorHeight);
        
        // Define minimum and maximum scale factors
        const minScale = 0.5;
        const maxScale = 1.2;
        
        // Clamp the scale factor within the defined range
        if (scaleFactor < minScale) {
          console.log(`  Scale factor (${scaleFactor.toFixed(2)}) below minScale (${minScale}). Setting to minScale.`);
          scaleFactor = minScale;
        } else if (scaleFactor > maxScale) {
          console.log(`  Scale factor (${scaleFactor.toFixed(2)}) above maxScale (${maxScale}). Setting to maxScale.`);
          scaleFactor = maxScale;
        }
        
        console.log(`  Final scaleFactor for Group ${clIdx + 1}: ${scaleFactor.toFixed(2)}`);
        
        // Calculate total scaled height to check if it fits
        const totalScaledHeight = group.reduce((acc, w) => acc + (w.size && w.size.height ? w.size.height * scaleFactor : 300 * scaleFactor), 0) + spacingY * (group.length - 1);
        console.log(`  Total Scaled Height for Group ${clIdx + 1}: ${totalScaledHeight.toFixed(2)}`);
        
        if (totalScaledHeight > availableHeight) {
          console.warn(`  Warning: Total scaled height (${totalScaledHeight.toFixed(2)}) exceeds available height (${availableHeight}). Consider reducing the number of widgets or increasing the zone size.`);
        }
        
        group.forEach((w, wIdx) => {
          console.log(`  Widget ${wIdx + 1}/${group.length}: ID=${w.id}, Original Size=${JSON.stringify(w.size)}`);
          
          // Calculate scaled dimensions
          const scaledWidth = w.size && w.size.width ? w.size.width * scaleFactor : 300 * scaleFactor;
          const scaledHeight = w.size && w.size.height ? w.size.height * scaleFactor : 300 * scaleFactor;
          
          console.log(`    Scaled Size: width=${scaledWidth.toFixed(2)}, height=${scaledHeight.toFixed(2)}`);
          
          // Calculate y position based on scaled height and spacing
          const yPos = zoneBB.y + buffer + (scaledHeight + spacingY) * wIdx;
          
          // Ensure widgets do not exceed the zone's vertical boundaries
          if (yPos + scaledHeight > zoneBB.y + zoneBB.height - buffer) {
            console.warn(`    Warning: Widget ${w.id} at y=${yPos} exceeds zone height. Adjusting yPos.`);
            // Adjust yPos to fit within the zone
            const adjustedYPos = zoneBB.y + zoneBB.height - buffer - scaledHeight;
            console.log(`    Adjusted yPos for Widget ${w.id}: ${adjustedYPos}`);
            patchData = {
              location: { x: columnX, y: adjustedYPos },
              scale: scaleFactor
            };
          } else {
            patchData = {
              location: { x: columnX, y: yPos },
              scale: scaleFactor
            };
          }
          
          console.log(`    Patching widget ${w.id} at (${patchData.location.x}, ${patchData.location.y}) with scaleFactor=${scaleFactor.toFixed(2)}`);
          
          // Patch the widget's location and scale
          // Using for...of with await to handle asynchronous operations sequentially
          (async () => {
            await patchWidgetAtURL(getWidgetPatchURL(w), w.id, patchData);
          })().catch(err => {
            console.error(`    Error patching widget ${w.id}: ${err.message}`);
          });
          
          updatedCount++;
        });
        
        // Move to the next column
        columnX += maxWidthPerColumn + spacingX;
        console.log(`  Moved to next column. New columnX: ${columnX}`);
      }
      
      console.log(`\nTotal widgets patched: ${updatedCount}`);
      
      return res.json({
        success: true,
        message: `${updatedCount} widgets grouped by title across ${titleGroups.length} column(s).`
      });
    } catch (err) {
      console.error("Error in /api/macros/group-title:", err.message);
      return res.status(500).send(err.message);
    }
  });
  

// ------------------------------- Note Creation Helpers --------------------------

// Create a note on the canvas at a given location
async function createNoteAtLocation(title, text, color, location) {
    const payload = {
        auto_text_color: true,
        background_color: color,
        depth: 100,
        location: location,
        pinned: false,
        scale: 1,
        size: { height: 300, width: 300 },
        state: "normal",
        text: text,
        title: title,
        widget_type: "Note"
    };

    try {
        const response = await apiClient.post(`/api/v1/canvases/${process.env.CANVAS_ID}/notes`, payload);

        if (response.status === 201 || response.status === 200) {
            console.log(`[${getTimestamp()}] Note "${title}" created successfully.`);
        } else {
            throw new Error(`Failed to create note "${title}". Status: ${response.status}`);
        }
    } catch (error) {
        console.error(`[${getTimestamp()}] Error creating note "${title}":`, error.response?.data || error.message);
        throw error;
    }
}

// ------------------------------- Create Team Targets Endpoint -------------------

// Create "Team_X_Target" notes for teams if they don't exist yet (no password required)
app.post('/create-team-targets', async (req, res) => {
    try {
        // Fetch zones
        console.log(`[${getTimestamp()}] Fetching zones via /get-zones route.`);
        const zonesResponse = await apiClient.get(`/get-zones`);
        const zones = zonesResponse.data.zones;

        // Fetch existing widgets to find existing team targets
        console.log(`[${getTimestamp()}] Fetching widgets to identify existing team targets.`);
        const widgetsResponse = await apiClient.get(`/api/v1/canvases/${process.env.CANVAS_ID}/widgets`);
        const widgets = widgetsResponse.data;

        const existingTeamTargets = new Set();
        widgets.forEach(widget => {
            if (widget.widget_type === "Note" && widget.title && widget.title.startsWith("Team_") && widget.title.endsWith("_Target")) {
                const match = widget.title.match(/^Team_(\d+)_Target$/);
                if (match && match[1]) {
                    existingTeamTargets.add(parseInt(match[1], 10));
                }
            }
        });

        const teamNumbers = [1, 2, 3, 4, 5, 6, 7];
        const teamsToCreate = teamNumbers.filter(team => !existingTeamTargets.has(team));
        const createdTeams = [];

        if (teamsToCreate.length === 0) {
            console.log(`[${getTimestamp()}] All team targets already exist. No targets created.`);
            return res.json({ success: true, message: "All team targets already exist. No new targets created." });
        }

        // Create missing team targets
        for (const team of teamsToCreate) {
            const zone = zones.find(z => z.anchor_index === team);
            if (!zone || !zone.location) {
                console.warn(`[${getTimestamp()}] No zone found with index ${team}. Skipping creation for Team ${team}.`);
                continue;
            }

            const location = zone.location;
            const noteTitle = `Team_${team}_Target`;
            const noteText = `Team ${team}`;
            const noteColor = getTeamBaseColor(team);

            try {
                await createNoteAtLocation(noteTitle, noteText, noteColor, location);
                createdTeams.push(team);
            } catch (error) {
                console.error(`[${getTimestamp()}] Failed to create target for Team ${team}:`, error.message);
            }
        }

        if (createdTeams.length === 0) {
            return res.json({ success: false, message: "Failed to create any team targets." });
        }

        const confirmationMessage = `Create Team Targets ${createdTeams.join(", ")}`;
        console.log(`[${getTimestamp()}] ${confirmationMessage}`);
        res.json({ success: true, message: confirmationMessage });

    } catch (error) {
        console.error(`[${getTimestamp()}] Error creating team targets:`, error.message);
        res.status(500).json({ success: false, error: "Failed to create team targets." });
    }
});

// ------------------------------- Zone Creation Helpers --------------------------

// Generate spiral order from center for zone placement (used by create-zones)
function generateSpiralOrderFromCenter(gridSize) {
    const spiralOrder = [];
    let x = Math.floor(gridSize / 2);
    let y = Math.floor(gridSize / 2);

    spiralOrder.push({ row: y, col: x });
    let step = 1;

    while (spiralOrder.length < gridSize * gridSize) {
        // Move right
        for (let i = 0; i < step; i++) {
            x += 1;
            if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) spiralOrder.push({ row: y, col: x });
        }
        // Move down
        for (let i = 0; i < step; i++) {
            y += 1;
            if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) spiralOrder.push({ row: y, col: x });
        }

        step++;

        // Move left
        for (let i = 0; i < step; i++) {
            x -= 1;
            if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) spiralOrder.push({ row: y, col: x });
        }
        // Move up
        for (let i = 0; i < step; i++) {
            y -= 1;
            if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) spiralOrder.push({ row: y, col: x });
        }

        step++;
    }

    return spiralOrder;
}

function generateSpiralOrder(gridSize) {
    return generateSpiralOrderFromCenter(gridSize);
}

function generateZOrder(gridSize) {
    const order = [];
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            order.push({ row, col });
        }
    }
    return order;
}

function generateSnakeOrder(gridSize) {
    const order = [];
    for (let row = 0; row < gridSize; row++) {
        const cols = [];
        for (let col = 0; col < gridSize; col++) {
            cols.push(col);
        }
        if (row % 2 !== 0) {
            cols.reverse();
        }
        for (const col of cols) {
            order.push({ row, col });
        }
    }
    return order;
}

// Helper to generate subgrid coordinates with an aspect ratio
function generateSubGrid(rows, cols, zoneWidth, zoneHeight, zoneX, zoneY, aspectRatio) {
    const coordinates = [];
    const subZoneWidth = zoneWidth / cols;
    const subZoneHeight = zoneHeight / rows;

    const adjustedSubZoneHeight = subZoneWidth / aspectRatio;
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

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = startX + c * finalSubZoneWidth;
            const y = startY + r * finalSubZoneHeight;
            coordinates.push({ x, y, width: finalSubZoneWidth, height: finalSubZoneHeight });
        }
    }

    return coordinates;
}

// Create initial zones (main zones) in a chosen pattern
async function createInitialZones(gridSize, gridPattern) {
  gridSize = parseInt(gridSize);
  console.log(`[${getTimestamp()}] createInitialZones called with gridSize=${gridSize}, gridPattern=${gridPattern}`);

  if (![1, 3, 4, 5].includes(gridSize)) {
      console.error(`[${getTimestamp()}] Invalid grid size: ${gridSize}`);
      throw new Error("Invalid grid size. Choose 1, 3, 4, or 5.");
  }

  const validPatterns = ["Z", "Snake", "Spiral"];
  const pattern = gridPattern ? gridPattern.trim() : "Z";
  if (!validPatterns.includes(pattern)) {
      console.error(`[${getTimestamp()}] Invalid grid pattern: ${pattern}`);
      throw new Error(`Invalid grid pattern. Choose one of: ${validPatterns.join(", ")}`);
  }

  console.log(`[${getTimestamp()}] Fetching widgets to determine SharedCanvas size.`);
  const { data: widgets } = await apiClient.get(`/api/v1/canvases/${process.env.CANVAS_ID}/widgets`);

  const sharedCanvas = widgets.find(widget => widget.widget_type === 'SharedCanvas');
  if (!sharedCanvas) {
      console.error(`[${getTimestamp()}] SharedCanvas widget not found.`);
      throw new Error("SharedCanvas widget not found.");
  }

  const canvasSize = sharedCanvas.size;
  if (!canvasSize || typeof canvasSize.width !== 'number' || typeof canvasSize.height !== 'number') {
      console.error(`[${getTimestamp()}] Invalid canvas size in SharedCanvas widget.`);
      throw new Error("Invalid canvas size in SharedCanvas widget.");
  }

  const canvasWidth = canvasSize.width;
  const canvasHeight = canvasSize.height;

  let coordinates = [];
  switch (pattern) {
      case "Z":
          coordinates = generateZOrder(gridSize).map(coord => ({
              x: coord.col * (canvasWidth / gridSize),
              y: coord.row * (canvasHeight / gridSize)
          }));
          break;
      case "Snake":
          coordinates = generateSnakeOrder(gridSize).map(coord => ({
              x: coord.col * (canvasWidth / gridSize),
              y: coord.row * (canvasHeight / gridSize)
          }));
          break;
      case "Spiral":
          coordinates = generateSpiralOrder(gridSize).map(coord => ({
              x: coord.col * (canvasWidth / gridSize),
              y: coord.row * (canvasHeight / gridSize)
          }));
          break;
      default:
          coordinates = generateZOrder(gridSize).map(coord => ({
              x: coord.col * (canvasWidth / gridSize),
              y: coord.row * (canvasHeight / gridSize)
          }));
  }

  const zoneWidth = canvasWidth / gridSize;
  const zoneHeight = canvasHeight / gridSize;

  console.log(`[${getTimestamp()}] Canvas Size: Width=${canvasWidth}, Height=${canvasHeight}`);
  console.log(`[${getTimestamp()}] Zone Size: Width=${zoneWidth}, Height=${zoneHeight}`);
  console.log(`[${getTimestamp()}] Creating ${gridSize * gridSize} zones with '${pattern}' pattern.`);

  let zoneNumber = 1;
  let createdCount = 0;
  let failedCount = 0;

  for (const coord of coordinates) {
      const anchorName = `${gridSize}x${gridSize} Zone ${zoneNumber} (Script Made)`;
      const payload = {
          anchor_name: anchorName,
          location: { x: coord.x, y: coord.y },
          size: { width: zoneWidth, height: zoneHeight },
          pinned: true,
          scale: 1,
          depth: 0
      };

      console.log(`[${getTimestamp()}] Creating anchor '${anchorName}'`);

      try {
          const response = await apiClient.post(
              `/api/v1/canvases/${process.env.CANVAS_ID}/anchors`,
              payload
          );
          console.log(`[${getTimestamp()}] Successfully created anchor '${anchorName}'`);
          createdCount++;
      } catch (err) {
          console.error(`[${getTimestamp()}] Error creating anchor '${anchorName}':`, err.response?.data || err.message);
          failedCount++;
      }

      zoneNumber++;
  }

  console.log(`[${getTimestamp()}] Completed zone creation. Success: ${createdCount}, Failed: ${failedCount}`);
  return {
      success: true,
      message: `${createdCount} zones created successfully, ${failedCount} failed.`
  };
}

// ------------------------------- Create Zones Endpoint --------------------------

// Create main zones or sub-zones within an existing zone
app.post("/create-zones", async (req, res) => {
  const { gridSize, gridPattern, subZoneId, subZoneArray } = req.body;
  console.log(`[${getTimestamp()}] /create-zones called with gridSize=${gridSize}, gridPattern=${gridPattern}, subZoneId=${subZoneId}, subZoneArray=${subZoneArray}`);

  try {
      if (subZoneId && subZoneArray) {
          // SubZone creation
          console.log(`[${getTimestamp()}] Fetching details for zone ID: ${subZoneId}`);
          const { data: selectedZone } = await apiClient.get(`/api/v1/canvases/${process.env.CANVAS_ID}/anchors/${subZoneId}`);

          const [cols, rows] = subZoneArray.split('x').map(Number);
          if (isNaN(cols) || isNaN(rows) || cols <= 0 || rows <= 0) {
              console.error(`[${getTimestamp()}] Invalid subZoneArray format: ${subZoneArray}`);
              return res.status(400).json({ success: false, error: "Invalid SubZone Array format." });
          }

          const zoneWidth = selectedZone.size.width / cols;
          const zoneHeight = selectedZone.size.height / rows;

          const subZones = [];
          for (let row = 0; row < rows; row++) {
              for (let col = 0; col < cols; col++) {
                const anchorName = `SubZone ${selectedZone.anchor_name.match(/\s(\d+)\s/)[1]}.${row * cols + col + 1} (Script Made)`;
                const payload = {
                      anchor_name: anchorName,
                      location: { x: selectedZone.location.x + col * zoneWidth, y: selectedZone.location.y + row * zoneHeight },
                      size: { width: zoneWidth, height: zoneHeight },
                      pinned: true,
                      scale: 1,
                      depth: 1
                  };
                  subZones.push(payload);
              }
          }

          let createdCount = 0;
          let failedCount = 0;

          for (const subZone of subZones) {
              try {
                  await apiClient.post(`/api/v1/canvases/${process.env.CANVAS_ID}/anchors`, subZone);
                  createdCount++;
              } catch (err) {
                  console.error(`[${getTimestamp()}] Error creating subzone '${subZone.anchor_name}':`, err.response?.data || err.message);
                  failedCount++;
              }
          }

          console.log(`[${getTimestamp()}] Subzone creation completed. Success: ${createdCount}, Failed: ${failedCount}`);
          res.json({
              success: true,
              message: `${createdCount} subzones created successfully, ${failedCount} failed.`
          });

      } else {
          // Main zone creation
          const result = await createInitialZones(gridSize, gridPattern);
          res.json(result);
      }
  } catch (error) {
      console.error(`[${getTimestamp()}] Error in zone creation:`, error.message);
      res.status(500).json({ error: error.message || "Failed to create zones." });
  }
});


// Delete Zones (no password)
app.delete("/delete-zones", async (req, res) => {
    try {
        console.log(`[${getTimestamp()}] Fetching all anchors for canvas ID: ${process.env.CANVAS_ID}`);
        const { data: anchors } = await apiClient.get(`/api/v1/canvases/${process.env.CANVAS_ID}/anchors`);

        // Identify script-created anchors
        const scriptAnchors = anchors.filter(anchor => anchor.anchor_name && anchor.anchor_name.endsWith("(Script Made)"));
        console.log(`[${getTimestamp()}] Found ${scriptAnchors.length} script-created anchors to delete.`);

        if (scriptAnchors.length === 0) {
            console.log(`[${getTimestamp()}] No script-created anchors to delete.`);
            return res.json({ success: true, message: "No script-created zones to delete." });
        }

        let deletedCount = 0;
        let failedCount = 0;

        for (const anchor of scriptAnchors) {
            const anchorId = anchor.id;
            const anchorName = anchor.anchor_name;

            console.log(`[${getTimestamp()}] Deleting anchor '${anchorName}' (ID: ${anchorId})`);
            try {
                await apiClient.delete(
                    `/api/v1/canvases/${process.env.CANVAS_ID}/anchors/${anchorId}`
                );
                console.log(`[${getTimestamp()}] Successfully deleted anchor '${anchorName}' (ID: ${anchorId})`);
                deletedCount++;
            } catch (err) {
                console.error(`[${getTimestamp()}] Error deleting anchor '${anchorName}' (ID: ${anchorId}):`, err.response?.data || err.message);
                failedCount++;
            }
        }

        console.log(`[${getTimestamp()}] Completed deletion. Deleted: ${deletedCount}, Failed: ${failedCount}`);
        res.json({
            success: true,
            message: `${deletedCount} zones deleted successfully, ${failedCount} failed.`
        });
    } catch (error) {
        console.error(`[${getTimestamp()}] Error deleting zones:`, error.response?.data || error.message);
        res.status(500).json({ success: false, error: `Failed to delete zones. ${error.message}` });
    }
});

// ------------------------------- Create Note Endpoint ---------------------------

// Create a note near a team's icon
app.post("/create-note", [
    body('team').isInt({ min: 1, max: 7 }).withMessage('Team must be between 1 and 7.'),
    body('name').isString().trim().escape().notEmpty().withMessage('Name is required.'),
    body('text').isString().trim().escape().notEmpty().withMessage('Text is required.'),
    body('color').matches(/^#[0-9A-Fa-f]{8}$/).withMessage('Color must be #RRGGBBAA format.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { team, name, text, color } = req.body;

    try {
        const iconTitle = `Team_${team}_Target`;
        console.log(`[${getTimestamp()}] Fetching widgets to locate ${iconTitle}.`);
        const widgetsResponse = await apiClient.get(`/api/v1/canvases/${process.env.CANVAS_ID}/widgets`);
        const widgets = widgetsResponse.data;

        const teamIcon = widgets.find(widget => widget.title === iconTitle);
        if (!teamIcon) {
            return res.status(404).json({ success: false, error: `${iconTitle} not found on the canvas.` });
        }

        const { location: iconLocation, depth: iconDepth, scale: iconScale } = teamIcon;

        // Generate random offsets
        const randomOffsetX = Math.floor(Math.random() * 601) - 300;
        const randomOffsetY = Math.floor(Math.random() * 601) - 300;

        const newNoteLocation = {
            x: iconLocation.x + randomOffsetX,
            y: iconLocation.y + randomOffsetY
        };

        // Random depth between 100 and 300 above the icon's depth
        const randomDepth = iconDepth + Math.floor(Math.random() * 201) + 100;

        // Timestamp for note title
        const now = new Date();
        const timestamp = now.toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).replace(',', '');

        // Prepare payload for note creation
        const payload = {
            auto_text_color: true,
            background_color: color,
            depth: randomDepth,
            location: newNoteLocation,
            pinned: false,
            scale: iconScale,
            size: { height: 300, width: 300 },
            state: "normal",
            text: text,
            title: `${name} @ (${timestamp})`,
            widget_type: "Note"
        };

        console.log(`[${getTimestamp()}] Creating new note with payload:`, payload);

        const createNoteResponse = await apiClient.post(
            `/api/v1/canvases/${process.env.CANVAS_ID}/notes`,
            payload
        );

        if (createNoteResponse.status === 201 || createNoteResponse.status === 200) {
            console.log(`[${getTimestamp()}] Note created successfully.`);
            return res.json({ success: true, message: "Note created successfully." });
        } else {
            console.error(`[${getTimestamp()}] Failed to create note. Status: ${createNoteResponse.status}`);
            return res.status(createNoteResponse.status).json({ success: false, error: "Failed to create note." });
        }

    } catch (error) {
        console.error(`[${getTimestamp()}] Error creating note:`, error.response?.data || error.message);
        res.status(500).json({ success: false, error: "An error occurred while creating the note." });
    }
});

// ------------------------------- Upload Item Endpoint ---------------------------

// Upload an item (image, video, or PDF) and create a corresponding widget on the canvas
app.post("/upload-item", upload.single('file'), async (req, res) => {
    try {
        // Debug
        console.log("[upload-item] req.body:", req.body);

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded.' });
        }

        const file = req.file;
        const fileName = file.filename;
        const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);

        if (!supportedFileExtensions.includes(fileExtension)) {
            console.warn(`[${getTimestamp()}] Unsupported file type: ${file.originalname}`);
            fs.unlinkSync(path.join(uploadDir, fileName));
            return res.status(400).json({ success: false, error: `File type "${fileExtension}" is not supported.` });
        }

        console.log(`[${getTimestamp()}] Received supported file: ${file.originalname}`);

        const widgetInfo = widgetTypeMapping[fileExtension];
        if (!widgetInfo) {
            console.error(`[${getTimestamp()}] No widget mapping found for: ${fileExtension}`);
            fs.unlinkSync(path.join(uploadDir, fileName));
            return res.status(400).json({ success: false, error: `Unsupported widget type: "${fileExtension}".` });
        }

        const { type: widgetType, endpoint: widgetEndpoint } = widgetInfo;
        const filePath = path.join(uploadDir, fileName);
        
        // Extract team and name from req.body
        const team = parseInt(req.body.team, 10);
        const name = req.body.name;

        if (!team || !name) {
            console.warn(`[${getTimestamp()}] Team or name not provided in req.body:`, req.body);
            // Default to team 1 and a generic name if missing
            // But ideally, you should return an error if these are required.
            return res.status(400).json({ success: false, error: "Team or name missing in upload request." });
        }

        // Fetch widgets to find Team_X_Target location
        console.log(`[${getTimestamp()}] Fetching widgets to locate Team_${team}_Target.`);
        const widgetsResponse = await apiClient.get(`/api/v1/canvases/${process.env.CANVAS_ID}/widgets`);
        const widgets = widgetsResponse.data;
        const iconTitle = `Team_${team}_Target`;
        const teamIcon = widgets.find(widget => widget.title === iconTitle);

        let newX = 0;
        let newY = 0;

        if (teamIcon && teamIcon.location) {
            const iconLocation = teamIcon.location;
            const randomOffsetX = Math.floor(Math.random() * 601) - 300;
            const randomOffsetY = Math.floor(Math.random() * 601) - 300;
            newX = iconLocation.x + randomOffsetX;
            newY = iconLocation.y + randomOffsetY;
        } else {
            console.warn(`[${getTimestamp()}] ${iconTitle} not found. Defaulting to (0,0)`);
        }

        // Timestamp for the widget title
        const now = new Date();
        const timestamp = now.toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).replace(',', '');
        
        // Construct the JSON part as per the API docs
        const jsonPart = {
            title: `${name} uploaded ${file.originalname} @ (${timestamp})`,
            location: { x: newX, y: newY },
            pinned: false,
            scale: 1,
            depth: 0
            // You can add "size", "original_filename", etc. if needed
        };

        const form = new FormData();
        // Append 'json' as a stringified JSON
        form.append('json', JSON.stringify(jsonPart));

        // Append 'data' as the file stream
        form.append('data', fs.createReadStream(filePath));

        console.log(`[${getTimestamp()}] Creating widget of type "${widgetType}" near Team_${team}_Target at (${newX}, ${newY}) using multipart/form-data`);

        const widgetCreationURL = `/api/v1/canvases/${process.env.CANVAS_ID}${widgetEndpoint}`;

        const widgetResponse = await apiClient.post(widgetCreationURL, form, {
            headers: {
                ...form.getHeaders()
            }
        });

        if (widgetResponse.status === 201 || widgetResponse.status === 200) {
            console.log(`[${getTimestamp()}] Widget created successfully.`);
            return res.json({ success: true, message: `File "${file.originalname}" uploaded and widget created successfully.` });
        } else {
            console.error(`[${getTimestamp()}] Failed to create widget. Status: ${widgetResponse.status}`);
            fs.unlinkSync(filePath);
            return res.status(widgetResponse.status).json({ success: false, error: "Failed to create widget on canvas." });
        }

    } catch (error) {
        console.error(`[${getTimestamp()}] Error in /upload-item:`, error.response?.data || error.message);
        res.status(500).json({ success: false, error: "An error occurred during file upload." });
    }
});

// New endpoints for Delete Targets and Clear Users
// 1) List target notes (Team_#_Target)
app.get('/list-target-notes', async (req, res) => {
    try {
        console.log(`[${getTimestamp()}] Fetching widgets to list target notes.`);
        const widgetsResponse = await apiClient.get(`/api/v1/canvases/${process.env.CANVAS_ID}/widgets`);
        const widgets = widgetsResponse.data;

        const targetNotes = widgets.filter(w => w.title && /^Team_(\d+)_Target$/.test(w.title));
        res.json({ success: true, notes: targetNotes });
    } catch (error) {
        console.error(`[${getTimestamp()}] Error listing target notes:`, error.response?.data || error.message);
        res.status(500).json({ success: false, error: "Failed to list target notes." });
    }
});

// 2) Delete selected target notes
app.post('/delete-target-notes', async (req, res) => {
    const { noteIds } = req.body;
    if (!Array.isArray(noteIds) || noteIds.length === 0) {
        return res.status(400).json({ success: false, error: "noteIds array required." });
    }

    let deletedCount = 0;
    let failedCount = 0;

    for (const id of noteIds) {
        try {
            await apiClient.delete(`/api/v1/canvases/${process.env.CANVAS_ID}/notes/${id}`);
            deletedCount++;
        } catch (error) {
            console.error(`[${getTimestamp()}] Error deleting note ID ${id}:`, error.response?.data || error.message);
            failedCount++;
        }
    }

    res.json({ success: true, message: `${deletedCount} notes deleted, ${failedCount} failed.` });
});

// 3) List users from users.json
app.get('/list-users', (req, res) => {
    const users = readUsers();
    // Convert structure {team: {username: color}} to a list
    let userList = [];
    for (const [team, teamUsers] of Object.entries(users)) {
        for (const [username, color] of Object.entries(teamUsers)) {
            userList.push({ team: parseInt(team), name: username, color: color });
        }
    }
    res.json({ success: true, users: userList });
});

// 4) Delete selected users or all users
//   Expect { all: boolean, users: [{team, name}] } if not all
app.post('/delete-users', (req, res) => {
    const { all, users } = req.body;
    let currentUsers = readUsers();

    if (all === true) {
        // Clear all
        currentUsers = {};
        writeUsers(currentUsers);
        return res.json({ success: true, message: "All users deleted." });
    }

    if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ success: false, error: "No users specified for deletion." });
    }

    let deletedCount = 0;
    users.forEach(u => {
        const t = u.team;
        const n = u.name;
        if (currentUsers[t] && currentUsers[t][n]) {
            delete currentUsers[t][n];
            deletedCount++;
            if (Object.keys(currentUsers[t]).length === 0) {
                delete currentUsers[t];
            }
        }
    });

    writeUsers(currentUsers);
    res.json({ success: true, message: `${deletedCount} users deleted.` });
});

// Helper functions for grid generation (unchanged from previous code)
function generateSubGrid(rows, cols, zoneWidth, zoneHeight, zoneX, zoneY, aspectRatio) {
    const coordinates = [];
    const subZoneWidth = zoneWidth / cols;
    const subZoneHeight = zoneHeight / rows;

    const adjustedSubZoneHeight = subZoneWidth / aspectRatio;
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

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = startX + c * finalSubZoneWidth;
            const y = startY + r * finalSubZoneHeight;
            coordinates.push({ x, y, width: finalSubZoneWidth, height: finalSubZoneHeight });
        }
    }
    return coordinates;
}

function generateZOrder(gridSize) {
    const order = [];
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            order.push({ row, col });
        }
    }
    return order;
}

function generateSnakeOrder(gridSize) {
    const order = [];
    for (let row = 0; row < gridSize; row++) {
        const cols = [];
        for (let col = 0; col < gridSize; col++) {
            cols.push(col);
        }
        if (row % 2 !== 0) {
            cols.reverse();
        }
        for (const col of cols) {
            order.push({ row, col });
        }
    }
    return order;
}

function generateSpiralOrderFromCenter(gridSize) {
    const spiralOrder = [];
    let x = Math.floor(gridSize / 2);
    let y = Math.floor(gridSize / 2);

    spiralOrder.push({ row: y, col: x });
    let step = 1;

    while (spiralOrder.length < gridSize * gridSize) {
        // right
        for (let i = 0; i < step; i++) { x += 1; if (x>=0 && x<gridSize && y>=0 && y<gridSize) spiralOrder.push({ row: y, col: x }); }
        // down
        for (let i = 0; i < step; i++) { y += 1; if (x>=0 && x<gridSize && y>=0 && y<gridSize) spiralOrder.push({ row: y, col: x }); }

        step++;

        // left
        for (let i = 0; i < step; i++) { x -= 1; if (x>=0 && x<gridSize && y>=0 && y<gridSize) spiralOrder.push({ row: y, col: x }); }
        // up
        for (let i = 0; i < step; i++) { y -= 1; if (x>=0 && x<gridSize && y>=0 && y<gridSize) spiralOrder.push({ row: y, col: x }); }

        step++;
    }

    return spiralOrder;
}

function generateSpiralOrder(gridSize) {
    return generateSpiralOrderFromCenter(gridSize);
}

// createInitialZones - unchanged logic, no password required now
async function createInitialZones(gridSize, gridPattern) {
    gridSize = parseInt(gridSize);
    console.log(`[${getTimestamp()}] createInitialZones with gridSize=${gridSize}, pattern=${gridPattern}`);

    if (![1 ,3, 4, 5].includes(gridSize)) {
        throw new Error("Invalid grid size. Choose 1, 3, 4, or 5.");
    }

    const validPatterns = ["Z", "Snake", "Spiral"];
    const pattern = gridPattern ? gridPattern.trim() : "Z";
    if (!validPatterns.includes(pattern)) {
        throw new Error(`Invalid grid pattern. Choose one of: ${validPatterns.join(", ")}`);
    }

    const widgetsResponse = await apiClient.get(`/api/v1/canvases/${process.env.CANVAS_ID}/widgets`);
    const widgets = widgetsResponse.data;

    const sharedCanvas = widgets.find(widget => widget.widget_type === 'SharedCanvas');
    if (!sharedCanvas) {
        throw new Error("SharedCanvas widget not found.");
    }

    const canvasSize = sharedCanvas.size;
    if (!canvasSize || typeof canvasSize.width !== 'number' || typeof canvasSize.height !== 'number') {
        throw new Error("Canvas size information missing or invalid.");
    }

    const canvasWidth = canvasSize.width;
    const canvasHeight = canvasSize.height;

    let coordinates = [];
    switch (pattern) {
        case "Z": coordinates = generateZOrder(gridSize); break;
        case "Snake": coordinates = generateSnakeOrder(gridSize); break;
        case "Spiral": coordinates = generateSpiralOrder(gridSize); break;
    }

    coordinates = coordinates.map(coord => ({
        x: coord.col * (canvasWidth / gridSize),
        y: coord.row * (canvasHeight / gridSize)
    }));

    const zoneWidth = canvasWidth / gridSize;
    const zoneHeight = canvasHeight / gridSize;

    let zoneNumber = 1;
    let createdCount = 0;
    let failedCount = 0;

    for (const coord of coordinates) {
        const anchorName = `${gridSize}x${gridSize} Zone ${zoneNumber} (Script Made)`;
        const payload = {
            anchor_name: anchorName,
            location: { x: coord.x, y: coord.y },
            size: { width: zoneWidth, height: zoneHeight },
            pinned: true,
            scale: 1,
            depth: 0
        };

        try {
            await apiClient.post(
                `/api/v1/canvases/${process.env.CANVAS_ID}/anchors`,
                payload
            );
            createdCount++;
        } catch (err) {
            failedCount++;
        }

        zoneNumber++;
    }

    return {
        success: true,
        message: `${createdCount} zones created successfully, ${failedCount} failed.`
    };
}

// ---- MACRO ENDPOINTS ----

// 1) Helpers

function getWidgetPatchURL(widget) {
    // For example:
    //  - If widget_type === "Note", use `/notes`
    //  - If widget_type === "Image", use `/images`
    //  - If widget_type === "Connector", skip?
    switch ((widget.widget_type || "").toLowerCase()) {
        case "note":      return "/notes";      
        case "browser":   return "/browsers";
        case "image":     return "/images";
        case "pdf":       return "/pdfs";
        case "video":     return "/videos";
        case "connector": return "/connectors";
        case "anchor":    return "/anchors";  // or skip them entirely
      default:
        // fallback? maybe /widgets is read-only in your environment
        console.log(`[getWidgetPatchURL] Unrecognized widget_type="${widget.widget_type}", defaulting to /notes`);
        return "/notes";
    }
  }
  

async function getAllWidgets() {
    const response = await apiClient.get(`/api/v1/canvases/${process.env.CANVAS_ID}/widgets`);
    return response.data; // Array of widget objects
}

async function getZoneBoundingBox(zoneId) {
    // retrieve anchor (zone)
    const { data: anchor } = await apiClient.get(
        `/api/v1/canvases/${process.env.CANVAS_ID}/anchors/${zoneId}`
    );
    return {
        x: anchor.location.x,
        y: anchor.location.y,
        width: anchor.size.width,
        height: anchor.size.height,
        scale: anchor.scale || 1
    };
}

// We only check widget.location.x,y vs. zone bounding box
function widgetIsInZone(widget, zoneBB) {
    const wx = widget.location.x;
    const wy = widget.location.y;
    return (
        wx >= zoneBB.x &&
        wx <= zoneBB.x + zoneBB.width &&
        wy >= zoneBB.y &&
        wy <= zoneBB.y + zoneBB.height
    );
}

/**
 * transformWidgetLocationAndScale:
 *   Applies a uniform scale factor based on width ratio.
 *   Ignores aspect ratio differences (like you requested).
 */
function transformWidgetLocationAndScale(widget, sourceBB, targetBB) {
    const scaleFactor = targetBB.width / sourceBB.width;

    // Delta from source zone
    const deltaX = widget.location.x - sourceBB.x;
    const deltaY = widget.location.y - sourceBB.y;

    widget.location.x = targetBB.x + deltaX * scaleFactor;
    widget.location.y = targetBB.y + deltaY * scaleFactor;

    const oldScale = widget.scale || 1;
    widget.scale = oldScale * scaleFactor;
    return widget;
}

// 2) Move
app.post("/api/macros/move", async (req, res) => {
    console.log(`[${getTimestamp()}] Starting /api/macros/move endpoint...`);
    try {
        // 1) Parse Input
        const { sourceZoneId, targetZoneId } = req.body;
        console.log(`[${getTimestamp()}] Received sourceZoneId=${sourceZoneId}, targetZoneId=${targetZoneId}`);

        if (!sourceZoneId || !targetZoneId) {
            console.log(`[${getTimestamp()}] Missing sourceZoneId/targetZoneId -> returning 400.`);
            return res.status(400).json({ error: "sourceZoneId and targetZoneId are required." });
        }

        // 2) Retrieve Zone Bounding Boxes
        console.log(`[${getTimestamp()}] Attempting to retrieve bounding boxes...`);
        const sourceBB = await getZoneBoundingBox(sourceZoneId);
        console.log(`[${getTimestamp()}] sourceBB:`, sourceBB);
        const targetBB = await getZoneBoundingBox(targetZoneId);
        console.log(`[${getTimestamp()}] targetBB:`, targetBB);

        // 3) Fetch All Widgets
        console.log(`[${getTimestamp()}] Fetching all widgets from canvas...`);
        const widgets = await getAllWidgets();
        console.log(`[${getTimestamp()}] Total widgets on canvas: ${widgets.length}`);

        // 4) Filter Widgets Within Source Zone
        console.log(`[${getTimestamp()}] Filtering widgets inside sourceBB...`);
        const widgetsToMove = widgets.filter((w) => {
            if (!w.location) {
                console.log(`[${getTimestamp()}] Widget ${w.id} missing location field, skipping...`);
                return false;
            }
            return widgetIsInZone(w, sourceBB);
        });
        console.log(`[${getTimestamp()}] Found ${widgetsToMove.length} widget(s) to move.`);

        let movedCount = 0;

        // 5) Transform & PATCH Each Widget
        for (const w of widgetsToMove) {
            console.log(`[${getTimestamp()}] Processing widget ID=${w.id}, original location=`, w.location);

            // Clone widget object so we don't mutate the original
            const cloned = JSON.parse(JSON.stringify(w));
            console.log(`[${getTimestamp()}] Cloned widget location=`, cloned.location);

            console.log(`[${getTimestamp()}] Transforming location/scale from source -> target...`);
            const updated = transformWidgetLocationAndScale(cloned, sourceBB, targetBB);
            console.log(`[${getTimestamp()}] Updated location=`, updated.location, ` scale=`, updated.scale);

            let tries = 0;
            let success = false;

            // Up to 3 attempts (with 500ms delay on fail)
            while (tries < 3 && !success) {
                try {
                    console.log(`[${getTimestamp()}] Attempting PATCH for widget ID=${w.id}, try #${tries + 1}`);
                    await apiClient.patch(
                        `/api/v1/canvases/${process.env.CANVAS_ID}/widgets/${w.id}`,
                        { location: updated.location, scale: updated.scale }
                    );
                    success = true;
                    movedCount++;
                    console.log(`[${getTimestamp()}] Successfully moved widget ID=${w.id}`);
                } catch (err) {
                    tries++;
                    console.error(`[${getTimestamp()}] Move failed for widget ${w.id}, try #${tries}: ${err.message}`);
                    if (tries < 3) {
                        console.log(`[${getTimestamp()}] Retrying move after 500ms...`);
                        await new Promise((resolve) => setTimeout(resolve, 500));
                    }
                }
            }
        }

        console.log(`[${getTimestamp()}] /api/macros/move complete. Moved: ${movedCount} widget(s)`);
        return res.json({ success: true, message: `${movedCount} widgets moved.` });
    } catch (error) {
        console.error(`[${getTimestamp()}] Error in /api/macros/move:`, error.message);
        return res.status(500).json({ error: error.message });
    }
});

// 3) Copy
app.post("/api/macros/copy", async (req, res) => {
    try {
        const { sourceZoneId, targetZoneId } = req.body;
        if (!sourceZoneId || !targetZoneId) {
            return res.status(400).json({ error: "sourceZoneId and targetZoneId are required." });
        }

        const sourceBB = await getZoneBoundingBox(sourceZoneId);
        const targetBB = await getZoneBoundingBox(targetZoneId);

        const allWidgets = await getAllWidgets();
        let widgetsToCopy = allWidgets.filter(w => widgetIsInZone(w, sourceBB));

        // BFS-like approach for parent-child references
        const toCopyMap = new Map(); // oldId -> widget
        widgetsToCopy.forEach(w => toCopyMap.set(w.id, w));

        const copiedMap = new Map(); // oldId -> newId

        function canCopy(w) {
            if (!w.parent_id) return true;
            // copy if parent isn't in set or parent's new ID is known
            return !toCopyMap.has(w.parent_id) || copiedMap.has(w.parent_id);
        }

        let attempts = widgetsToCopy.length;
        let safetyCounter = 0;
        let totalCopied = 0;

        while (attempts > 0 && safetyCounter < 1000) {
            for (const w of widgetsToCopy) {
                if (!copiedMap.has(w.id) && canCopy(w)) {
                    // transform coords
                    const updated = transformWidgetLocationAndScale(
                        JSON.parse(JSON.stringify(w)),
                        sourceBB,
                        targetBB
                    );
                    delete updated.id;

                    // fix parent
                    if (toCopyMap.has(w.parent_id)) {
                        const newParentId = copiedMap.get(w.parent_id);
                        if (newParentId) {
                            updated.parent_id = newParentId;
                        } else {
                            delete updated.parent_id;
                        }
                    }

                    // Rate-limit 200ms
                    await new Promise(resolve => setTimeout(resolve, 200));

                    // up to 3 tries
                    let tries = 0;
                    let success = false;
                    let newId = null;
                    while (tries < 3 && !success) {
                        try {
                            // TODO: If different endpoints for notes/images, do so by w.widget_type
                            // For now, just assume a single /widgets endpoint:
                            const resp = await apiClient.post(
                                `/api/v1/canvases/${process.env.CANVAS_ID}/widgets`,
                                updated
                            );
                            success = true;
                            newId = resp.data.id;
                            copiedMap.set(w.id, newId);
                            totalCopied++;
                        } catch (err) {
                            tries++;
                            if (tries < 3) {
                                await new Promise(resolve => setTimeout(resolve, 500));
                            } else {
                                console.error(`[${getTimestamp()}] Copy failed for widget ${w.id}:`, err.message);
                            }
                        }
                    }
                }
            }
            const copiedSoFar = copiedMap.size;
            attempts = widgetsToCopy.length - copiedSoFar;
            safetyCounter++;
        }

        return res.json({ success: true, message: `${totalCopied} widgets copied.` });
    } catch (error) {
        console.error(`[${getTimestamp()}] Error in /api/macros/copy:`, error.message);
        return res.status(500).json({ error: error.message });
    }
});

// 4) Delete + log => Undelete
const DELETED_WIDGETS_FILE = path.join(__dirname, 'macros-deleted-widgets.json');

function logDeletedWidgets(deletedItems) {
    let existing = [];
    if (fs.existsSync(DELETED_WIDGETS_FILE)) {
        try {
            existing = JSON.parse(fs.readFileSync(DELETED_WIDGETS_FILE, 'utf8'));
        } catch (err) {
            console.error(`[${getTimestamp()}] Could not read macros-deleted-widgets.json:`, err.message);
        }
    }
    existing.push({
        timestamp: new Date().toISOString(),
        items: deletedItems
    });
    fs.writeFileSync(DELETED_WIDGETS_FILE, JSON.stringify(existing, null, 2), 'utf8');
}

/******************************************************************************
 * DELETE (Enhanced with Cleanup)
 ******************************************************************************/
app.post("/api/macros/delete", async (req, res) => {
    console.log("[/api/macros/delete] route invoked.");
    const { zoneId } = req.body;
    if (!zoneId) {
      return res.status(400).send("zoneId is required for deletion.");
    }
    try {
      const allWidgets = await getAllWidgets();
      const zoneBB = await getZoneBoundingBox(zoneId);
      const widgetsToDelete = allWidgets.filter(w => {
        if (w.id === zoneId) return false;
        if (!w.location) return false;
        return widgetIsInZone(w, zoneBB);
      });
  
      if (widgetsToDelete.length === 0) {
        return res.json({ success: true, message: "No widgets found in the selected zone to delete." });
      }
  
      // Create a deletion record
      const recordId = `rec-${Date.now()}`;
      const timestamp = new Date().toISOString();
  
      const deletionRecord = {
        recordId,
        timestamp,
        zoneId,
        widgets: widgetsToDelete
      };
  
      // Read existing deleted records
      let deletedRecords = await readDeletedRecords();
  
      // Add the new deletion record
      deletedRecords.push(deletionRecord);
  
      // Cleanup if exceeding 50 records
      const MAX_RECORDS = 50;
      if (deletedRecords.length > MAX_RECORDS) {
        // Remove oldest records
        deletedRecords = deletedRecords.slice(deletedRecords.length - MAX_RECORDS);
        console.log(`[cleanup] Deleted records exceeded ${MAX_RECORDS}. Oldest records removed.`);
      }
  
      // Write back to the JSON file
      await writeDeletedRecords(deletedRecords);
  
      // Implement actual widget deletion logic here
      // Example: await deleteWidgets(widgetsToDelete);
      console.log(`Widgets deleted from zone ${zoneId} and recorded with ID ${recordId}.`);
  
      return res.json({
        success: true,
        message: `${widgetsToDelete.length} widgets deleted from zone ${zoneId} and recorded with ID ${recordId}.`
      });
    } catch (err) {
      console.error("Error in /api/macros/delete:", err.message);
      return res.status(500).send(err.message);
    }
  });
  
  /******************************************************************************
   * GET DELETED RECORDS
   ******************************************************************************/
  app.get("/api/macros/deleted-records", async (req, res) => {
    console.log("[/api/macros/deleted-records] route invoked.");
    try {
      const deletedRecords = await readDeletedRecords();
      return res.json({ success: true, records: deletedRecords });
    } catch (err) {
      console.error("Error in /api/macros/deleted-records:", err.message);
      return res.status(500).send("Failed to load deleted records.");
    }
  });
  
  /******************************************************************************
   * GET DELETED RECORD DETAILS (Optional)
   ******************************************************************************/
  app.get("/api/macros/deleted-details", async (req, res) => {
    console.log("[/api/macros/deleted-details] route invoked.");
    const recordId = req.query.recordId;
    if (!recordId) {
      return res.status(400).json({ success: false, error: "recordId query param required." });
    }
  
    try {
      const deletedRecords = await readDeletedRecords();
      const record = deletedRecords.find(r => r.recordId === recordId);
      if (!record) {
        return res.status(404).json({ success: false, error: "No such deleted record found." });
      }
  
      const total = record.widgets ? record.widgets.length : 0;
      const typeMap = {};
  
      if (record.widgets) {
        for (const w of record.widgets) {
          const type = w.widget_type || "Unknown";
          if (!typeMap[type]) typeMap[type] = 0;
          typeMap[type]++;
        }
      }
  
      return res.json({ success: true, count: total, types: typeMap });
    } catch (err) {
      console.error("[deleted-details] error:", err.message);
      return res.status(500).json({ success: false, error: "Failed to load details." });
    }
  });

/******************************************************************************
 * AUTO-GRID (New Logic)
 * 
 * Instead of using user-defined rows/cols, we:
 * 1) Count how many items we have in the zone.
 * 2) Compute a "gridSize" such that gridSize x gridSize >= numberOfItems.
 *    Example: if we have 10 items, the nearest uniform grid might be 4x4=16.
 * 3) Compute item scale so each item's height fits the cell. Then we apply that
 *    scale to its location. We maintain at least 50 units between items.
 *
 * Example Steps:
 *   - # items => N
 *   - gridSize = ceil( sqrt(N) )
 *   - cellWidth = (zoneBB.width / gridSize)
 *   - cellHeight = (zoneBB.height / gridSize)
 *   - Use the smaller dimension (height or width) to set scale factor. 
 *     The item's new height <= cellHeight - 50?? Or we fix 50 units between them?
 *   - Place items left-to-right, top-to-bottom in that grid.
 ******************************************************************************/
app.post("/api/macros/auto-grid", async (req, res) => {
    console.log("[/api/macros/auto-grid] route invoked.");
    const { zoneId } = req.body;
    if (!zoneId) {
      return res.status(400).send("zoneId is required for auto-grid.");
    }
    try {
      const zoneBB = await getZoneBoundingBox(zoneId);
      const allWidgets = await getAllWidgets();
  
      // Filter out anchors, connectors, and the zone widget itself
      const inZone = allWidgets.filter(w => {
        if (w.id === zoneId) return false;
        if (!w.location) return false;
        const t = (w.widget_type || "").toLowerCase();
        if (t === "connector" || t === "anchor") return false;
        return widgetIsInZone(w, zoneBB);
      });
  
      if (inZone.length === 0) {
        return res.json({
          success: true,
          message: "No widgets found to auto-grid."
        });
      }
  
      // 1) Determine gridSize = smallest integer where gridSize^2 >= inZone.length
      const N = inZone.length;
      const gridSize = Math.ceil(Math.sqrt(N));
      console.log(`[auto-grid] We have ${N} items => using gridSize=${gridSize}x${gridSize}`);
  
      // 2) Cell size in the zone
      //    We'll maintain at least 50 units between items horizontally and vertically.
      //    So effectively, each cell has "usable" space = cellWidth-50 x cellHeight-50
      const zoneWidth = zoneBB.width;
      const zoneHeight = zoneBB.height;
      const cellWidth = zoneWidth / gridSize;
      const cellHeight = zoneHeight / gridSize;
  
      // 3) Scale each item so its *height* fits within cellHeight - 50 (for spacing).
      //    We'll ignore the item's original aspect ratio except for preserving it (scaling).
      //    i.e., newScale = min( (cellHeight-50) / itemOriginalHeight, ... ) 
      //    We must retrieve itemOriginalHeight from the widget's size property.
      //
      //    For simplicity, let's do a 2-pass approach:
      //    - We'll collect each item's original height => compute scale => store in an array
      //    - Then place them left->right, top->bottom
  
      let index = 0;
      let updatedCount = 0;
  
      for (const w of inZone) {
        // We'll figure out how to scale based on w.size.height
        // (If w.size is missing, default to 300, say.)
        const originalHeight = w.size?.height || 300;
        const desiredCellHeight = cellHeight - 50; // keep 50 as spacing
        let newScale = 1;
        if (desiredCellHeight > 0) {
          newScale = desiredCellHeight / originalHeight;
        }
        // but also we might want to ensure we don't exceed cellWidth dimension
        // if we want to preserve aspect ratio, let's check width too
        if (w.size?.width) {
          const originalWidth = w.size.width;
          const desiredCellWidth = cellWidth - 50;
          const scaleByWidth = desiredCellWidth / originalWidth;
          // final scale = min(scaleByHeight, scaleByWidth)
          newScale = Math.min(newScale, scaleByWidth);
        }
  
  
        // clamp scale > 0
        if (newScale < 0) newScale = 0.1;
  
        const r = Math.floor(index / gridSize);
        const c = index % gridSize;
        index++;
  
        // 4) targetX = zoneBB.x + c*cellWidth + 25 => we offset by 25 to ensure spacing
        //    targetY = zoneBB.y + r*cellHeight + 25
        const targetX = zoneBB.x + c * cellWidth + 25;
        const targetY = zoneBB.y + r * cellHeight + 25;
  
        const patchRoute = getWidgetPatchURL(w);
        await patchWidgetAtURL(patchRoute, w.id, {
          location: { x: targetX, y: targetY },
          scale: newScale
        });
        updatedCount++;
      }
  
      return res.json({
        success: true,
        message: `Auto-Grid placed ${updatedCount} widgets in a ~${gridSize}x${gridSize} grid.`
      });
    } catch (err) {
      console.error("Error in /api/macros/auto-grid:", err.message);
      return res.status(500).send(err.message);
    }
  });
  
  
  /******************************************************************************
   * GROUP BY COLOR (Updated to ensure no overlap + spacing)
   * 
   * Instead of filling the entire horizontal space, we place items starting at (100,100)
   * with 100 units between columns, and 25 units between items within each cluster.
   ******************************************************************************/
  app.post("/api/macros/group-color", async (req, res) => {
    console.log("[/api/macros/group-color] route invoked.");
    const { zoneId, tolerance } = req.body;
    if (!zoneId || !tolerance) {
      return res.status(400).send("zoneId and tolerance are required for group-color.");
    }
    try {
      const zoneBB = await getZoneBoundingBox(zoneId);
      const allW = await getAllWidgets();
      const inZone = allW.filter(w => {
        if (w.id === zoneId) return false;
        if (!w.location) return false;
        const t = (w.widget_type || "").toLowerCase();
        if (t === "connector" || t === "anchor") return false;
        return widgetIsInZone(w, zoneBB);
      });
  
      if (inZone.length === 0) {
        return res.json({ success: true, message: "No widgets found to group by color." });
      }
  
      function colorDistance(c1, c2) {
        const r1 = parseInt(c1.slice(1, 3), 16) || 0;
        const g1 = parseInt(c1.slice(3, 5), 16) || 0;
        const b1 = parseInt(c1.slice(5, 7), 16) || 0;
        const r2 = parseInt(c2.slice(1, 3), 16) || 0;
        const g2 = parseInt(c2.slice(3, 5), 16) || 0;
        const b2 = parseInt(c2.slice(5, 7), 16) || 0;
        return Math.sqrt((r1 - r2)**2 + (g1 - g2)**2 + (b1 - b2)**2);
      }
  
      const threshold = 255 * (parseInt(tolerance, 10) / 100.0);
      const clusters = [];
      for (const w of inZone) {
        const color = w.background_color || "#FFFFFF00";
        let placed = false;
        for (const cl of clusters) {
          const dist = colorDistance(color, cl.representativeColor);
          if (dist <= threshold) {
            cl.widgets.push(w);
            placed = true;
            break;
          }
        }
        if (!placed) {
          clusters.push({
            representativeColor: color,
            widgets: [w]
          });
        }
      }
  
      // We place each cluster starting at (zoneBB.x+100, zoneBB.y+100).
      // Each cluster is in a new column => clusterX += 100 + maxItemWidth? or just 100 units
      // We'll do a fixed horizontal spacing of 100 between columns
      // vertical spacing of 25 between items in that cluster
      let clusterX = zoneBB.x + 100;
      let clusterY = zoneBB.y + 100;
      let updatedCount = 0;
  
      for (const cluster of clusters) {
        // For each cluster, we place items spaced by 25 vertically
        for (const w of cluster.widgets) {
          const route = getWidgetPatchURL(w);
          await patchWidgetAtURL(route, w.id, {
            location: { x: clusterX, y: clusterY }
          });
          updatedCount++;
          clusterY += 25; 
        }
        // after finishing this cluster, move right by 100
        clusterX += 100;
        // reset clusterY to top
        clusterY = zoneBB.y + 100;
      }
  
      return res.json({
        success: true,
        message: `${updatedCount} widgets grouped by color into ${clusters.length} cluster(s).`
      });
    } catch (err) {
      console.error("Error in /api/macros/group-color:", err.message);
      return res.status(500).send(err.message);
    }
  });
  
  
  /******************************************************************************
   * GROUP BY TITLE (Updated to ensure no overlap + spacing)
   * 
   * Instead of filling entire zone, we place items starting at (100,100),
   * each item 60 units below the previous one, and each new "group" 
   * is in a new column with 100 units between columns. 
   * But if your grouping is purely one big vertical stack, 
   * we can do a single column. Below is a simpler approach:
   ******************************************************************************/
  app.post("/api/macros/group-title", async (req, res) => {
    console.log("[/api/macros/group-title] route invoked.");
    const { zoneId } = req.body;
    if (!zoneId) {
      return res.status(400).send("zoneId is required for group-title.");
    }
    try {
      const zoneBB = await getZoneBoundingBox(zoneId);
      const allW = await getAllWidgets();
      let inZone = allW.filter(w => {
        if (w.id === zoneId) return false;
        if (!w.location) return false;
        const t = (w.widget_type || "").toLowerCase();
        if (t === "connector" || t === "anchor") return false;
        return widgetIsInZone(w, zoneBB);
      });
  
      if (inZone.length === 0) {
        return res.json({ success: true, message: "No widgets found in this zone to group by title." });
      }
  
      // Sort by title
      inZone.sort((a, b) => {
        const tA = (a.title || "").toLowerCase();
        const tB = (b.title || "").toLowerCase();
        if (tA < tB) return -1;
        if (tA > tB) return 1;
        return 0;
      });
  
      // We'll place them in one column, starting at (zoneBB.x+100, zoneBB.y+100),
      // each item 60 units below the previous.
      let offsetX = zoneBB.x + 100;
      let offsetY = zoneBB.y + 100;
      let count = 0;
  
      for (const w of inZone) {
        const patchURL = getWidgetPatchURL(w);
        await patchWidgetAtURL(patchURL, w.id, {
          location: { x: offsetX, y: offsetY }
        });
        offsetY += 60;
        count++;
      }
  
      return res.json({
        success: true,
        message: `${count} widgets grouped by title (alphabetical), spaced at 60 units vertically from (100,100).`
      });
    } catch (err) {
      console.error("Error in /api/macros/group-title:", err.message);
      return res.status(500).send(err.message);
    }
  });
  

// 7) Export
app.post("/api/macros/export", async (req, res) => {
    try {
        const { zoneId } = req.body;
        if (!zoneId) {
            return res.status(400).json({ error: "zoneId is required." });
        }

        const zoneBB = await getZoneBoundingBox(zoneId);
        const allWidgets = await getAllWidgets();
        const inZone = allWidgets.filter(w => widgetIsInZone(w, zoneBB));

        const exportPayload = {
            timestamp: new Date().toISOString(),
            zoneId: zoneId,
            widgets: inZone
        };

        // Write to a local file or send directly. For now, a local .json:
        const exportFilePath = path.join(__dirname, `export_${Date.now()}.json`);
        fs.writeFileSync(exportFilePath, JSON.stringify(exportPayload, null, 2), 'utf8');

        return res.json({
            success: true,
            message: `Export complete. File at ${exportFilePath}`,
            filePath: exportFilePath
        });
    } catch (error) {
        console.error(`[${getTimestamp()}] Error in /api/macros/export:`, error.message);
        return res.status(500).json({ error: error.message });
    }
});

// 8) Import
app.post("/api/macros/import", upload.single('importFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded for import." });
        }
        const filePath = path.join(uploadDir, req.file.filename);
        const dataStr = fs.readFileSync(filePath, 'utf8');
        const dataObj = JSON.parse(dataStr);

        if (!dataObj.widgets || !Array.isArray(dataObj.widgets)) {
            return res.status(400).json({ error: "Uploaded file missing 'widgets' array." });
        }

        const widgetsToImport = dataObj.widgets;
        const toImportMap = new Map();
        widgetsToImport.forEach(w => toImportMap.set(w.id, w));

        const importedMap = new Map(); // oldId -> newId

        function canImport(w) {
            if (!w.parent_id) return true;
            return !toImportMap.has(w.parent_id) || importedMap.has(w.parent_id);
        }

        let attempts = widgetsToImport.length;
        let safetyCounter = 0;
        let importedCount = 0;

        while (attempts > 0 && safetyCounter < 1000) {
            for (const w of widgetsToImport) {
                if (!importedMap.has(w.id) && canImport(w)) {
                    let newWidget = JSON.parse(JSON.stringify(w));
                    delete newWidget.id;

                    if (toImportMap.has(w.parent_id)) {
                        const newParentId = importedMap.get(w.parent_id);
                        if (newParentId) {
                            newWidget.parent_id = newParentId;
                        } else {
                            delete newWidget.parent_id;
                        }
                    }

                    let tries = 0;
                    let success = false;
                    while (tries < 3 && !success) {
                        try {
                            const resp = await apiClient.post(
                                `/api/v1/canvases/${process.env.CANVAS_ID}/widgets`,
                                newWidget
                            );
                            let newId = resp.data.id;
                            importedMap.set(w.id, newId);
                            success = true;
                            importedCount++;
                        } catch (err) {
                            tries++;
                            if (tries < 3) {
                                await new Promise(resolve => setTimeout(resolve, 500));
                            } else {
                                console.error(`[${getTimestamp()}] Import failed for widget ${w.id}:`, err.message);
                            }
                        }
                    }
                }
            }
            const importedSoFar = importedMap.size;
            attempts = widgetsToImport.length - importedSoFar;
            safetyCounter++;
        }

        return res.json({ success: true, message: `${importedCount} widgets imported successfully.` });
    } catch (error) {
        console.error(`[${getTimestamp()}] Error in /api/macros/import:`, error.message);
        return res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(PORT, () => console.log(`[${getTimestamp()}] Server running at http://localhost:${PORT}`));

// -----------------------------------------------------------------------------
// End of script
// -----------------------------------------------------------------------------

// Get Canvas Info Endpoint
app.get('/get-canvas-info', (req, res) => {
    try {
        const canvasName = process.env.CANVAS_NAME;
        if (!canvasName) {
            return res.status(404).json({ error: 'Canvas name not found in environment variables.' });
        }
        res.json({ canvasName });
    } catch (error) {
        console.error(`[${getTimestamp()}] Error getting canvas info:`, error.message);
        res.status(500).json({ error: 'Failed to get canvas info.' });
    }
});

// Admin Routes
app.post('/admin/createTargets', validateAdminAuth, async (req, res) => {
    try {
        console.log(`[${getTimestamp()}] Creating target notes...`);
        
        // Get zones using our existing endpoint
        const zonesResponse = await apiClient.get(`/get-zones`);
        if (!zonesResponse.data.success) {
            throw new Error('Failed to fetch zones');
        }
        
        const zones = zonesResponse.data.zones;
        if (zones.length < 8) {
            return res.status(400).json({ success: false, message: 'Not enough zones available' });
        }

        // Create notes for teams 1-7 (skipping first zone)
        const createdTeams = [];
        for (let i = 1; i <= 7; i++) {
            const zone = zones.find(z => z.anchor_index === i);
            if (!zone || !zone.location) {
                console.warn(`[${getTimestamp()}] No zone found with index ${i}. Skipping creation for Team ${i}.`);
                continue;
            }

            const noteTitle = `Team_${i}_Target`;
            const noteText = `Team ${i}`;
            const noteColor = getTeamBaseColor(i);

            try {
                await createNoteAtLocation(noteTitle, noteText, noteColor, zone.location);
                createdTeams.push(i);
            } catch (error) {
                console.error(`[${getTimestamp()}] Failed to create target for Team ${i}:`, error.message);
            }
        }

        if (createdTeams.length === 0) {
            return res.json({ success: false, message: "Failed to create any team targets." });
        }

        const confirmationMessage = `Created Team Targets ${createdTeams.join(", ")}`;
        console.log(`[${getTimestamp()}] ${confirmationMessage}`);
        res.json({ success: true, message: confirmationMessage });

    } catch (error) {
        console.error(`[${getTimestamp()}] Error creating target notes:`, error);
        res.status(500).json({ success: false, message: 'Failed to create target notes' });
    }
});

app.post('/admin/deleteTargets', validateAdminAuth, async (req, res) => {
    try {
        console.log(`[${getTimestamp()}] Deleting target notes...`);
        
        // Get all widgets from CANVUS
        const response = await apiClient.get(
            `/api/v1/canvases/${process.env.CANVAS_ID}/widgets`
        );

        // Filter target notes - using correct property names and values
        const targetNotes = response.data.filter(widget => 
            widget.widget_type === 'Note' && widget.title && widget.title.match(/^Team_\d+_Target$/)
        );

        console.log(`[${getTimestamp()}] Found ${targetNotes.length} target notes to delete`);

        // Delete each target note
        let deletedCount = 0;
        for (const note of targetNotes) {
            try {
                await apiClient.delete(
                    `/api/v1/canvases/${process.env.CANVAS_ID}/notes/${note.id}`
                );
                deletedCount++;
                console.log(`[${getTimestamp()}] Successfully deleted note "${note.title}"`);
            } catch (error) {
                console.error(`[${getTimestamp()}] Failed to delete note "${note.title}":`, error.message);
            }
        }

        console.log(`[${getTimestamp()}] Successfully deleted ${deletedCount} target notes`);
        res.json({ success: true, message: `Deleted ${deletedCount} target notes` });
    } catch (error) {
        console.error(`[${getTimestamp()}] Error deleting target notes:`, error);
        res.status(500).json({ success: false, message: 'Failed to delete target notes' });
    }
});

app.get('/admin/listUsers', validateAdminAuth, async (req, res) => {
    try {
        console.log(`[${getTimestamp()}] Listing users...`);
        const usersObj = readUsers();
        const users = [];
        
        // Transform the nested object structure into array of user objects
        Object.entries(usersObj).forEach(([team, teamUsers]) => {
            Object.entries(teamUsers).forEach(([name, color]) => {
                users.push({
                    team: parseInt(team),
                    name: name,
                    color: color
                });
            });
        });
        
        res.json({ success: true, users });
    } catch (error) {
        console.error(`[${getTimestamp()}] Error listing users:`, error);
        res.status(500).json({ success: false, message: 'Failed to list users' });
    }
});

app.post('/admin/deleteUsers', validateAdminAuth, async (req, res) => {
    try {
        console.log(`[${getTimestamp()}] Deleting all users...`);
        writeUsers({});
        res.json({ success: true, message: 'All users deleted successfully' });
    } catch (error) {
        console.error(`[${getTimestamp()}] Error deleting users:`, error);
        res.status(500).json({ success: false, message: 'Failed to delete users' });
    }
});

/* ------------------------------------------------------------------------- */
/* Pin/Unpin Functions                                                       */
/* ------------------------------------------------------------------------- */

app.post("/api/macros/pin-all", async (req, res) => {
  console.log("[/api/macros/pin-all] route invoked.");
  const { zoneId } = req.body;
  if (!zoneId) {
    return res.status(400).send("zoneId is required for pinning.");
  }

  try {
    const zoneBB = await getZoneBoundingBox(zoneId);
    const allWidgets = await getAllWidgets();

    // Filter widgets within the zone, excluding connectors and anchors
    const inZone = allWidgets.filter(w => {
      if (w.id === zoneId) return false;
      if (!w.location) return false;
      const type = (w.widget_type || "").toLowerCase();
      if (type === "connector" || type === "anchor") return false;
      return widgetIsInZone(w, zoneBB);
    });

    if (inZone.length === 0) {
      return res.json({ success: true, message: "No widgets found in zone to pin." });
    }

    let pinnedCount = 0;
    for (const w of inZone) {
      const patchRoute = getWidgetPatchURL(w);
      try {
        await patchWidgetAtURL(patchRoute, w.id, {
          pinned: true  // Changed from is_pinned to pinned
        });
        pinnedCount++;
      } catch (err) {
        console.error(`Error pinning widget ${w.id}:`, err.message);
      }
    }

    return res.json({
      success: true,
      message: `${pinnedCount} widgets pinned in the zone.`
    });
  } catch (err) {
    console.error("Error in /api/macros/pin-all:", err.message);
    return res.status(500).send(err.message);
  }
});

app.post("/api/macros/unpin-all", async (req, res) => {
  console.log("[/api/macros/unpin-all] route invoked.");
  const { zoneId } = req.body;
  if (!zoneId) {
    return res.status(400).send("zoneId is required for unpinning.");
  }

  try {
    const zoneBB = await getZoneBoundingBox(zoneId);
    const allWidgets = await getAllWidgets();

    // Filter widgets within the zone, excluding connectors and anchors
    const inZone = allWidgets.filter(w => {
      if (w.id === zoneId) return false;
      if (!w.location) return false;
      const type = (w.widget_type || "").toLowerCase();
      if (type === "connector" || type === "anchor") return false;
      return widgetIsInZone(w, zoneBB);
    });

    if (inZone.length === 0) {
      return res.json({ success: true, message: "No widgets found in zone to unpin." });
    }

    let unpinnedCount = 0;
    for (const w of inZone) {
      const patchRoute = getWidgetPatchURL(w);
      try {
        await patchWidgetAtURL(patchRoute, w.id, {
          pinned: false  // Changed from is_pinned to pinned
        });
        unpinnedCount++;
      } catch (err) {
        console.error(`Error unpinning widget ${w.id}:`, err.message);
      }
    }

    return res.json({
      success: true,
      message: `${unpinnedCount} widgets unpinned in the zone.`
    });
  } catch (err) {
    console.error("Error in /api/macros/unpin-all:", err.message);
    return res.status(500).send(err.message);
  }
});

// Add theme routes
app.use('/admin', themeRoutes);

// Verify Canvas endpoint
app.get('/verifycanvas/:canvasId', async (req, res) => {
    const { canvasId } = req.params;
    
    console.log(`[${getTimestamp()}] Verifying canvas ID: ${canvasId}`);
    
    try {
        const response = await apiClient.get(`/api/v1/canvases/${canvasId}`);
        
        if (response.data) {
            console.log(`[${getTimestamp()}] Canvas verified. Name: ${response.data.name}`);
            res.json({ 
                exists: true, 
                name: response.data.name,
                id: response.data.id
            });
        } else {
            console.log(`[${getTimestamp()}] Canvas not found`);
            res.json({ exists: false });
        }
    } catch (error) {
        console.error(`[${getTimestamp()}] Error verifying canvas:`, error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            exists: false, 
            error: error.response?.data?.error || 'Failed to verify canvas' 
        });
    }
});
