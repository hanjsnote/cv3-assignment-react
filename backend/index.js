const express = require("express");

const app = express(); 

app.get("/", (req, res) => {    // Define a route for the root URL ("/") that sends a response "Server Running"
    res.send("Server Running");
});

app.listen(3000, () => {    // Start the server and listen on port 3000
    console.log("Server is running on port 3000");
});