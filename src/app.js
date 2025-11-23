// this is a simple Express server setup


const express = require('express');const app = express();
const port = 3000;  
app.get('/', (req, res) => {  
  res.send('Hello World!');  
});
app.listen(port, () => {  
  console.log(`Server is running at http://localhost:${port}`);  
});
module.exports = app;
// export the app for testing or further usage
