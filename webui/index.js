// Import required modules
const express = require('express');
const fs = require('fs');
const dotenv = require('dotenv');
const session = require('express-session'); 
const { v4: uuidv4 } = require('uuid');

dotenv.config({ path: '../.env' });

// Initialize the Express app
const app = express();
const port = 3000;

// Middleware to serve static files from 'public' folder and parse request bodies
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use session middleware to enable sessions
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/main.html'); // Serve the main page
});

// Route to start a session and return a session ID
app.get('/start-session', (req, res) => {
  if (!req.session.uniqueID) {
    req.session.uniqueID = uuidv4(); // Generate a unique session ID
  }
  res.json({ sessionID: req.session.uniqueID }); // Return the session ID to the client
});

// Route to serve the control page for a specific session ID
app.get('/control/:id', (req, res) => {
  if (req.params.id === req.session.uniqueID) {
    res.sendFile(__dirname + '/public/pages.html'); // Serve the control page
  } else {
    res.status(403).send('Unauthorized: Invalid Session'); // Protect against unauthorized access
  }
});

app.listen(port, () => {
  console.log(`Web UI listening at http://localhost:${port}`);
});
