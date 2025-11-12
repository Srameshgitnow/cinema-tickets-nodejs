import express from "express";
// import v1Router from "./v1/index.js";
import v1Router from "./v1/tickets.js";

//-- express app object
const app = express();

// the app to take and use http request body
app.use(express.json());

const PORT = process.env.port || 8081;

// app would run and listen the port
app.listen(PORT, () => {
    console.log(`API is listening on port ${PORT}`)
});

app.use('/api/v1', v1Router);

export default app;



