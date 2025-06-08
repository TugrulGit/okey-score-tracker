// Simple Express backend for Okey Score Tracker
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// In-memory store for demonstration
let games = [];

app.get("/", (req, res) => {
  res.json({ message: "Okey backend (Node.js) is running!" });
});

// Example: Get all games
app.get("/api/games", (req, res) => {
  res.json(games);
});

// Example: Add a new game
app.post("/api/games", (req, res) => {
  const game = req.body;
  games.push(game);
  res.status(201).json(game);
});

// Example: Reset all games
app.delete("/api/games", (req, res) => {
  games = [];
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Okey backend (Node.js) listening on port ${PORT}`);
});
