const express = require("express");
const axios = require("axios")
const app = express(); 

app.get("/api/list", async (req, res) => { 
    
    const response = await axios.post("https://live.ecomm-data.com/api/schedule/list", 
        { 
            date: "260807" 
        });
    
        res.json(
            response.data
        );
    });

app.listen(3000, () => {    // Start the server and listen on port 3000
    console.log("Server is running on port 3000");
});