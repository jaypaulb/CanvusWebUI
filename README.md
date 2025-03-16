# CanvusAPI Demonstration Backend

This project is a demonstration of the capabilities of the CanvusAPI combined with JavaScript. It provides a backend script and a web interface for managing Canvus-based canvases, anchors, and widgets.

---

## Project Structure

```
CanvusWebUI/
├── webui/               # Main application directory
│   ├── server.js       # Main server application
│   ├── public/         # Static files
│   │   ├── css/       # Stylesheets
│   │   ├── js/        # Client-side JavaScript
│   │   └── index.html # Main entry point
│   ├── uploads/        # File upload directory
│   ├── canvusapi/     # API integration
│   └── package.json    # Dependencies
├── old/                # Archived files
├── .env               # Environment configuration
└── README.md          # This file
```

## Features

### Remote Content Upload (RCU) - Public Facing Page
- **Public Access**: A dedicated page for external users to upload content without needing access to admin features
- **Team-based Organization**: Users can select their team and get assigned a unique color
- **File Upload**: Supports various file formats including images, videos, and PDFs
- **Note Creation**: Users can create and post notes with their team color
- **QR Code Sharing**: Easy access via QR code for mobile devices
- **Isolated Interface**: Restricted navigation to maintain security and simplicity

### Admin Interface
- **UID Validation**: Validates browser widget UID in the Canvus environment
- **Pages Management**: Split canvas into grids and sub-grids
- **Macros**: 
  - Move, copy, or delete operations using anchor zones
  - Save deleted items for restoration
  - Quick content duplication across zones
- **Upload Management**:
  - Team-based file organization
  - User color assignment
  - Team reference note management
- **Configuration**: Direct access to view and update `.env` settings

---

## Deployment Instructions

### Prerequisites
- Node.js (v14 or higher)
- Windows Server 2016+ or Linux Server with Node.js support
- Network access to Canvus server

### Windows Deployment
1. **Prepare the Environment**:
   ```powershell
   # Create deployment directory
   New-Item -ItemType Directory -Path C:\CanvusWebUI
   cd C:\CanvusWebUI

   # Clone the repository
   git clone <repository-url> .

   # Install dependencies
   npm install
   ```

2. **Configure the Application**:
   ```powershell
   # Create .env file
   Copy-Item .env.example .env
   # Edit .env with your settings
   notepad .env
   ```

3. **Set Up Windows Service** (Optional):
   ```powershell
   # Install node-windows
   npm install -g node-windows
   npm link node-windows

   # Create and start Windows service
   node install_service.js
   ```

### Linux Deployment
1. **Prepare the Environment**:
   ```bash
   # Create deployment directory
   mkdir -p /opt/canvuswebui
   cd /opt/canvuswebui

   # Clone the repository
   git clone <repository-url> .

   # Install dependencies
   npm install
   ```

2. **Configure the Application**:
   ```bash
   # Create .env file
   cp .env.example .env
   # Edit .env with your settings
   nano .env
   ```

3. **Set Up Systemd Service**:
   ```bash
   # Create service file
   sudo nano /etc/systemd/system/canvuswebui.service

   # Add service configuration
   [Unit]
   Description=Canvus Web UI
   After=network.target

   [Service]
   Type=simple
   User=canvuswebui
   WorkingDirectory=/opt/canvuswebui
   ExecStart=/usr/bin/node server.js
   Restart=always

   [Install]
   WantedBy=multi-user.target

   # Start service
   sudo systemctl enable canvuswebui
   sudo systemctl start canvuswebui
   ```

### Configuration
Create a `.env` file with the following variables:
```env
CANVUS_SERVER=your.canvus.server
CANVAS_ID=your_canvas_id
CANVUS_API_KEY=your_api_key
WEBUI_KEY=admin_password
PORT=3000
```

### Security Considerations
1. **Access Control**:
   - Restrict admin interface access using `WEBUI_KEY`
   - Configure firewall rules to limit access to admin pages
   - Use HTTPS for all connections

2. **File Upload Security**:
   - Implement file type restrictions
   - Set maximum file size limits
   - Scan uploaded files for malware

3. **API Security**:
   - Keep API keys secure
   - Use environment variables for sensitive data
   - Implement rate limiting

---

## Usage

### Public RCU Page
1. Access the RCU page directly via URL or QR code
2. Enter name and select team
3. Upload files or create notes
4. Content automatically appears in the designated team area

### Admin Interface
1. Access the admin interface with proper credentials
2. Manage canvas layout and content
3. Monitor and manage team uploads
4. Configure system settings

---

## Troubleshooting

### Common Issues
1. **Connection Issues**:
   - Verify Canvus server accessibility
   - Check API key validity
   - Confirm network settings

2. **Upload Problems**:
   - Check file size limits
   - Verify supported file types
   - Ensure sufficient storage space

3. **Performance Issues**:
   - Monitor server resources
   - Check log files for errors
   - Verify database connections

---

## Contributing
Contributions are welcome! Please ensure your code adheres to the existing style and includes appropriate comments.

---

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Contact
For any issues or questions, please reach out to the project maintainer.

---
