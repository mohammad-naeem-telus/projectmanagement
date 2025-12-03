import app from "./app.js";
import connectDB from "./src/config/database.js";

const port = process.env.PORT;

app.get("/", (req, res) => {
  res.json({ value: "Hello World!" });
});

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Example app listening on url http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.log(error);
  });
