const express = require('express');
const http = require('http');
const App = require('./controller/app.js');

const app = express();
const server = http.createServer(app);

// Serve homepage
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/templates/home.html');
});

// Serve client.js
app.get('/static/client.js', (req, res) => {
    res.sendFile(__dirname + '/static/client.js');
});

// Serve kurento-utils
app.get('/static/kurento-utils.min.js', (req, res) => {
    res.sendFile(__dirname + '/static/kurento-utils.min.js');
});

// Serve styles.css
app.get('/static/styles.css', (req, res) => {
    res.sendFile(__dirname + '/static/styles.css');
});

const port = process.env.PORT || 8080;
server.listen(port, '0.0.0.0', _ => {
    console.log(`[+] Listening on port ${port}...`);
});

// Instantiate application
const backend = new App(server);