# CanvusAPI Demo UI

Want to see something cool? This demo lets you play with the CanvusAPI in your browser. It's like PowerPoint met Minecraft - but actually useful.

## ⚡ Quick Start (5 minutes)

### On Windows
```powershell
# 1. Get Node.js if you haven't already
# Download from https://nodejs.org (Latest LTS)

# 2. Grab the code & jump in
git clone <repository-url> canvus-demo
cd canvus-demo/webui  # Important: The app lives in webui!

# 3. Set it up
npm install
copy example.env .env  # Creates your local config file (not tracked in Git)
notepad .env  # Put in your Canvus details

# 4. Fire it up!
npm start
```

### On Linux
```bash
# 1. Get Node.js if you haven't already
# Use your package manager or https://nodejs.org

# 2. Grab the code & jump in
git clone <repository-url> canvus-webui
cd canvus-webui/webui  # Important: The app lives in webui!

# 3. Set it up
npm install
cp example.env .env  # Creates your local config file (not tracked in Git)
nano .env  # Put in your Canvus details

# 4. Fire it up!
npm start
```

Then just open http://localhost:3000 in your browser. That's it! 🎉

Need your Canvus details? Ask your admin for:
- CANVUS_SERVER (where your Canvus lives)
- CANVAS_ID (which canvas to use)
- CANVUS_API_KEY (your access key)

---

## 🔧 The Technical Bits

### What's Inside

```
canvus-demo/
├── webui/              # Where the magic happens - THIS IS WHERE WE RUN FROM
│   ├── server.js      # The server code
│   ├── public/        # Web stuff
│   └── uploads/       # Where files go
├── example.env        # Template for your settings
└── .env               # Your local settings (not tracked in Git)
```

### Features

#### For Everyone
- Upload files (images, videos, PDFs)
- Create sticky notes
- Pick your team color
- Share via QR code

#### For Facilitators
- Manage the canvas layout
- Move stuff around
- Keep track of who uploaded what
- Change settings on the fly

### Configuration (.env file)
```env
# The essentials
CANVUS_SERVER=your.canvus.server
CANVAS_ID=your_canvas_id
CANVUS_API_KEY=your_api_key

# Optional tweaks
PORT=3000              # Change this if 3000 is taken
WEBUI_PWD=admin123     # Password for admin stuff

# Security settings
ALLOW_SELF_SIGNED_CERTS=false  # Only set to 'true' in development/testing environments
```

#### SSL Certificate Settings

The application uses secure HTTPS connections to communicate with your Canvus server. There are two modes of operation:

1. **Production Mode** (Default, Recommended)
   - `ALLOW_SELF_SIGNED_CERTS=false`
   - Only accepts valid SSL certificates signed by trusted Certificate Authorities
   - Provides maximum security for production environments
   - Required for compliance with security standards

2. **Development/Testing Mode**
   - `ALLOW_SELF_SIGNED_CERTS=true`
   - Accepts self-signed certificates
   - ⚠️ **Security Warning**: This mode is less secure and should ONLY be used in:
     - Development environments
     - Testing environments
     - Internal networks where you control the certificate infrastructure
   - Risks of using self-signed certificates:
     - Vulnerable to man-in-the-middle attacks
     - No third-party verification of server identity
     - May expose sensitive data if network is compromised

🔒 **Best Practices**:
- Always use properly signed certificates in production
- Never enable self-signed certificates on public-facing servers
- If you must use self-signed certificates, restrict access to trusted networks only

### Running as a Service (Optional)

#### Windows
Want it to start with Windows? Use Task Scheduler:
1. Open Task Scheduler
2. Create Basic Task
3. Action: Start a program
4. Program: `node`
5. Arguments: `server.js`
6. Start in: `C:\path\to\canvus-demo\webui`  # Make sure this points to the webui directory!

#### Linux
Want it to run as a service? Use PM2 (run these from the webui directory):
```bash
npm install -g pm2
pm2 start server.js --name "canvus-demo"
pm2 save
pm2 startup
```

### Troubleshooting

1. **Won't Start?**
   - Is Node.js installed? `node --version`
   - Are you in the webui directory? `cd webui`
   - Did you run `npm install`?
   - Is port 3000 free? Try a different port in `.env`

2. **Can't Connect?**
   - Check your Canvus details in `.env`
   - Can you ping your Canvus server?
   - Firewall blocking port 3000?

3. **SSL Certificate Issues?**
   - Getting certificate errors? Check if your Canvus server uses:
     - A valid certificate from a trusted CA (recommended)
     - A self-signed certificate (requires `ALLOW_SELF_SIGNED_CERTS=true`)
   - In production, always use valid CA-signed certificates
   - For development/testing, you can enable self-signed certificates (see SSL Certificate Settings above)
   - Never ignore certificate errors in production environments

Need more help? Open an issue on GitHub or ping the maintainer.

---

## License
MIT License - do what you want with it! 🎈

---