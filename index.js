import app from "./app.js";

const port = process.env.PORT;
app.get("/", (req, res) => {
  res.json({ value: "Hello World!" });
});

app.listen(port, () => {
  console.log(`Example app listening on url http://localhost:${port}`);
});
