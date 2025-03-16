# CanvusAPI Demonstration Backend

This project is a demonstration of the capabilities of the CanvusAPI combined with some JavaScript. It provides a backend script and a web interface for managing Canvus-based canvases, anchors, and widgets.

---

## Project Structure

```
CanvusWebUI/
├── webui/               # Main application directory
│   ├── server.js       # Main server application
│   ├── public/         # Static files
│   ├── uploads/        # File upload directory
│   ├── canvusapi/     # API integration
│   └── package.json    # Dependencies
├── old/                # Archived files
├── .env               # Environment configuration
└── README.md          # This file
```

## Features

### Web UI
- **UID Validation**: Validates the browser widget UID in the Canvus environment and updates `.env` to control the specific canvas.
- **Pages**: Automatically split the canvas into grids and sub-grids. The delete button removes anchors with `(Script Made)` in their name, while others can be excluded manually.
- **Macros**:
  - Use anchor zones for move, copy, or delete operations.
  - Save deleted items for restoration.
  - Duplicate content quickly across zones.
- **Upload**:
  - Allows users to upload files by selecting a team and adding their name.
  - Assigns a unique color to each user and attaches their uploads to their team's reference note.
  - Admin options for creating team target notes.
- **Admin**: Displays and allows manual updates to the `.env` configuration.

---

## Development Environment

### Requirements
- Windows 11
- Node.js
- PowerShell

### IDE Support
This project includes configuration for Cursor.ai IDE. The following files are automatically ignored in git:
- `.cursor/`
- `.cursor.json`
- `cursor.json`
- `.cursorcache/`

---

## Requirements

### Dependencies
Install the required Node.js packages:
```bash
npm install express axios fs path dotenv body-parser multer express-validator
```

### Configuration
Create a `.env` file in the parent directory with the following variables:
- `CANVUS_SERVER`: Fully qualified domain name (FQDN) of the Canvus server.
- `CANVAS_ID`: Canvas ID (can be left blank initially).
- `CANVUS_API_KEY`: API key for Canvus API authentication. (see the user profile page in the Canvus Server control panel to generate per user API KEY's)
- `WEBUI_KEY`: Admin password for backend actions.

---

## Usage

### Setup
1. Ensure all dependencies are installed.
2. Run the server:
   ```bash
   node server.js
   ```

### Workflow
1. **Open the Web UI**:
   - Load the web interface inside the canvas to control.
   - Ensure the browser widget UID in the title bar is correct.
   - If the UID is not updating consistently, modify it manually by removing the last digit in the URL bar to force Canvus to refresh its internal DB.

2. **Main Features**:
   - **UID Validation**: Confirms the canvas to control.
   - **Pages**: Split the canvas into grids and sub-grids.
   - **Macros**: Move, copy, delete, and restore widgets.
   - **Upload**: Assigns unique colors and organizes uploads by team.
   - **Admin**: View and update `.env` variables.

---

## Notes

### Known Issues
None a present - please let me know if you find any issues.

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
