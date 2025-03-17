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
copy .env.example .env
notepad .env  # Put in your Canvus details

# 4. Fire it up!
npm start
```

### On Linux
```bash
# 1. Get Node.js if you haven't already
# Use your package manager or https://nodejs.org

# 2. Grab the code & jump in
git clone <repository-url> canvus-demo
cd canvus-demo/webui  # Important: The app lives in webui!

# 3. Set it up
npm install
cp .env.example .env
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
└── .env               # Your settings
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
```

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

Need more help? Open an issue on GitHub or ping the maintainer.

---

## License
MIT License - do what you want with it! 🎈

---
