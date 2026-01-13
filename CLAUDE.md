# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CanvusWebUI is a web-based interface for the Canvus collaborative infinite canvas platform. It provides a browser UI for uploading files, creating notes, managing teams, and running widget macros against the Canvus API.

## Commands

### Development
```bash
cd webui
npm install         # Install dependencies
npm start           # Start server (port 3000 by default)
npm run start:dev   # Same as npm start
```

### Production with PM2
```bash
cd webui
npm run start:prod  # Start with PM2 using ecosystem.config.js
pm2 logs canvus-webui  # View logs
pm2 restart canvus-webui
```

### Environment Setup
```bash
cp example.env .env  # Create local config from template
# Edit .env with your Canvus server details
```

### Container Deployment (alongside Canvus Server)
```bash
# Build image
podman build -t canvus-webui .

# Run with Canvus stack (edit docker-compose.yml first)
podman-compose -f /path/to/canvus/podman-compose.yml -f docker-compose.yml up -d

# Or run standalone
podman-compose up -d

# View logs
podman logs -f canvus-webui
```

Access via `https://your-canvus-server:8443`

## Architecture

### Directory Structure
```
CanvusWebUI/
├── webui/                 # All server and client code lives here
│   ├── server.js          # Express server - ALL API endpoints (~3800 lines)
│   ├── utils/apiClient.js # Axios client for Canvus API with auth headers
│   ├── routes/theme.js    # Theme customization routes
│   ├── public/            # Static frontend assets
│   │   ├── js/            # Client-side JavaScript modules
│   │   └── css/           # Stylesheets
│   ├── uploads/           # User-uploaded files (images, videos, PDFs)
│   └── users.json         # User/team color assignments (runtime generated)
├── Dockerfile             # Container image build
├── docker-compose.yml     # Container deployment config
├── example.env            # Environment variable template
└── .env                   # Local config (not tracked)
```

### Server Architecture (server.js)

The server is a monolithic Express application with these functional areas:

**Admin Endpoints** (require `WEBUI_PWD` token via Bearer auth):
- `POST /validateAdmin` - Authenticate admin session
- `GET /admin/env-variables` - Retrieve environment config
- `POST /admin/update-env` - Modify environment variables (auto-verifies canvas ID)
- `POST /admin/createTargets`, `/admin/deleteTargets` - Team target management
- `GET /admin/listUsers`, `POST /admin/deleteUsers` - User management

**Canvas Operations**:
- `GET /verifycanvas/:canvasId` - Verify canvas exists on Canvus server
- `GET /get-zones` - List anchors (zones) on the canvas
- `POST /create-zones`, `DELETE /delete-zones` - Zone CRUD
- `GET /find-canvas-progress` - SSE endpoint for canvas search progress
- `POST /find-canvas` - Search for canvas by UID

**Widget Operations**:
- `POST /create-note` - Create sticky notes with team colors
- `POST /upload-item` - Upload images/videos/PDFs (via multer, 50MB limit)
- `POST /create-team-targets` - Create team target widgets

**Macro Endpoints** (`/api/macros/*`) - Bulk widget operations:
- `POST /api/macros/move` - Move widgets between zones
- `POST /api/macros/copy` - Copy widgets between zones
- `POST /api/macros/delete` - Soft-delete widgets (stores in macros-deleted-records.json)
- `POST /api/macros/undelete` - Restore deleted widgets
- `POST /api/macros/auto-grid` - Auto-arrange widgets in grid
- `POST /api/macros/group-color` - Group widgets by color (HSL tolerance)
- `POST /api/macros/group-title` - Group widgets by title text
- `POST /api/macros/pin-all`, `/api/macros/unpin-all` - Bulk pin/unpin
- `POST /api/macros/export`, `/api/macros/import` - Widget data export/import

### Client Architecture

**Page Flow**: `index.html` generates a unique UID and redirects to `main.html?uid=...`

**Key JavaScript Modules** (in `public/js/`):
- `common.js` - MessageSystem (toast notifications), AdminModal (auth dialog), `makeAdminRequest()` helper
- `admin.js` - Admin panel: env vars, theme editing, user management
- `macros.js` - Macro operations UI: move/copy/delete, grouping, pinning
- `upload.js` - File upload handling
- `navbar.js` - Navigation component

### API Client (utils/apiClient.js)

Axios instance pre-configured with:
- Base URL from `CANVUS_SERVER`
- `Private-Token` header from `CANVUS_API_KEY`
- Optional self-signed cert acceptance via `ALLOW_SELF_SIGNED_CERTS`
- 30-second timeout
- Error interceptor logging

### Team Colors

7 team colors (Red, Orange, Yellow, Green, Blue, Indigo, Violet) with HSL-based variations per user. Users identified by team number (1-7) and name.

## Environment Variables

Required:
- `CANVUS_SERVER` - Full URL to Canvus server (e.g., `https://canvus.example.com`)
- `CANVAS_ID` - Target canvas ID
- `CANVUS_API_KEY` - API key for Canvus authentication

Optional:
- `PORT` - Server port (default: 3000 local, 8443 container)
- `WEBUI_PWD` - Admin password for protected endpoints
- `CANVAS_NAME` - Display name (auto-updated from API)
- `ALLOW_SELF_SIGNED_CERTS` - Set `true` for dev environments with self-signed certs

SSL (for container HTTPS mode):
- `SSL_CERT_PATH` - Path to SSL certificate (e.g., `/certs/fullchain.pem`)
- `SSL_KEY_PATH` - Path to SSL private key (e.g., `/certs/privkey.pem`)

If `SSL_CERT_PATH` and `SSL_KEY_PATH` are set, server runs HTTPS. Otherwise HTTP.

## Key Patterns

### Canvus API Type-Specific Endpoints
The Canvus API uses widget-type-specific paths:
```javascript
const widgetTypeMapping = {
    'jpg': { type: 'Image', endpoint: '/images' },
    'mp4': { type: 'Video', endpoint: '/videos' },
    'pdf': { type: 'PDF', endpoint: '/pdfs' }
};
// Usage: /api/v1/canvases/{id}/images/{widgetId}
```

### Admin Authentication
Admin endpoints use Bearer token auth. Client stores token in memory and retries on 401:
```javascript
// Client side (common.js)
const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
});

// Server side
function validateAdminAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (token !== process.env.WEBUI_PWD) return res.status(401).json({...});
    next();
}
```

### SSE for Progress Updates
Canvas search uses Server-Sent Events:
```javascript
// Server: app.locals.sseRes stores response for progress messages
sendSSEMessage("Searching canvas...");
// Client: EventSource connection to /find-canvas-progress
```

## Known Technical Debt

- `server.js` is ~3800 lines with duplicate endpoint definitions (e.g., `/api/macros/move` defined twice)
- No test suite configured (`npm test` just exits with error)
- Routes could be extracted to separate files (only `theme.js` is split out)
