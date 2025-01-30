# Canvus WebUI

This project is a demonstration of the capabilities of the CanvusAPI combined with some JavaScript. It provides a backend script and a web interface for managing Canvus-based canvases, anchors, and widgets.

---

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

### Advanced Pages (No Navbar Entry)
- **/postme.html**: Bulk creation of interconnected notes
  - Paste JSON containing note and connector definitions
  - Uses integer IDs to map connections between notes
  - Creates notes first, then establishes connections
  - Example format:
    ```json
   {
      "id": 36,
      "type": "Note",
      "location": { "x": 800, "y": 550 },
      "size": { "width": 400, "height": 220 },
      "text": "### Data & AI Interpretation\n- Detect enemy patterns & anomalies\n- Correlate data for predictive insights",
      "title": "AI & Data Analysis",
      "auto_text_color": false,
      "background_color": "#B3FFD3",
      "text_color": "#000000"
   },
   {
      "id": 37,
      "type": "Note",
      "location": { "x": 800, "y": 800 },
      "size": { "width": 400, "height": 220 },
      "text": "### Command Recommendations\n- Formulate action strategies\n- Advise command on enemy tactics",
      "title": "Command Team Decision Support",
      "auto_text_color": false,
      "background_color": "#FFB3B3",
      "text_color": "#000000"
   },
   {
      "id": 38,
      "widget_type": "Connector",
      "src": {
         "id": 36,
         "auto_location": true
      },
      "dst": {
         "id": 37,
         "auto_location": true
      }
   }
    ```

- **/minime.html**: Canvas space management
  1. Creates 3x3 anchor grid for work zones
  2. Creates full-canvas anchor
  3. Minifies content to center grid section
  **Warning**: Current API doesn't support background annotation interaction. Move annotations to notes using the selection tool before minifying.
  - **Background Annotations**: API doesn't support background annotation interaction. Move to notes before using minify feature.

## Prerequisites

- Node.js (v16 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd CanvusWebUI
```

2. Install dependencies:
```bash
cd webui
npm install
```

3. Create a `.env` file in the root directory:
```env
CANVUS_SERVER=https://your-canvus-server.com
CANVAS_NAME=YourCanvasName       # If you know the name of the canvas you want to control, you can enter it here and the webui backend will search for the ID.
CANVAS_ID=your-canvas-id         # If you enter test for both ID and NAME the backend will search for the canvas with your browser in and prompt you to confirm the canvas you want to control.
CANVUS_API_KEY=your-api-key      # Generate from Canvus Server control panel user profile
WEBUI_KEY=your-admin-password    # This is the password for the admin page.
```

## Usage

1. Start the server:
```bash
cd webui
npm start
```

2. Access the web interface at `http://localhost:3000` (or next available port)  #If you are deploying to a server, you will need to change the port 80 for HTTP and 443 for HTTPS.

3. **Main Features**:
   - **UID Validation**: Confirms the canvas to control.
   - **Pages**: Split the canvas into grids and sub-grids.
   - **Macros**: Move, copy, delete, and restore widgets.
   - **Upload**: Assigns unique colors and organizes uploads by team.
   - **Admin**: View and update `.env` variables.



## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a Pull Request

## License

MIT License

Copyright (c) 2024 [Your Name/Organization]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## Contact
For any issues or questions, please reach out to the project maintainer.

---
