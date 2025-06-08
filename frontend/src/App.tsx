import { useState } from "react";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";

interface Player {
  name: string;
  scores: number[];
}

function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [roundScores, setRoundScores] = useState<string[]>([]);
  const [round, setRound] = useState(0);

  const handleAddPlayer = () => {
    if (
      playerName.trim() &&
      !players.find((p) => p.name === playerName.trim())
    ) {
      setPlayers([...players, { name: playerName.trim(), scores: [] }]);
      setPlayerName("");
      setRoundScores([...roundScores, ""]);
    }
  };

  const handleScoreChange = (idx: number, value: string) => {
    const newScores = [...roundScores];
    newScores[idx] = value;
    setRoundScores(newScores);
  };

  const handleAddRound = () => {
    setPlayers(
      players.map((p, idx) => ({
        ...p,
        scores: [...p.scores, Number(roundScores[idx]) || 0],
      }))
    );
    setRoundScores(players.map(() => ""));
    setRound(round + 1);
  };

  const handleReset = () => {
    setPlayers([]);
    setPlayerName("");
    setRoundScores([]);
    setRound(0);
  };

  const handleRemovePlayer = (idx: number) => {
    setPlayers(players.filter((_, i) => i !== idx));
    setRoundScores(roundScores.filter((_, i) => i !== idx));
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" align="center" gutterBottom>
        Okey Score Tracker
      </Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2}>
          <TextField
            label="Add Player"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
            fullWidth
          />
          <Button variant="contained" onClick={handleAddPlayer}>
            Add
          </Button>
        </Box>
        <List>
          {players.map((p, idx) => (
            <ListItem
              key={p.name}
              secondaryAction={
                <IconButton edge="end" onClick={() => handleRemovePlayer(idx)}>
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemText primary={p.name} />
            </ListItem>
          ))}
        </List>
      </Paper>
      {players.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6">Round {round + 1}</Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            {players.map((p, idx) => (
              <TextField
                key={p.name}
                label={`Score for ${p.name}`}
                value={roundScores[idx] || ""}
                onChange={(e) => handleScoreChange(idx, e.target.value)}
                type="number"
                fullWidth
              />
            ))}
            <Button variant="contained" onClick={handleAddRound}>
              Add Round
            </Button>
          </Box>
        </Paper>
      )}
      {players.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6">Scoreboard</Typography>
          <Box component="table" width="100%" sx={{ mt: 2 }}>
            <Box component="thead">
              <Box component="tr">
                <Box component="th" sx={{ textAlign: "left" }}>
                  Player
                </Box>
                {Array.from({ length: round }, (_, i) => (
                  <Box component="th" key={i} sx={{ textAlign: "center" }}>
                    R{i + 1}
                  </Box>
                ))}
                <Box component="th" sx={{ textAlign: "center" }}>
                  Total
                </Box>
              </Box>
            </Box>
            <Box component="tbody">
              {players.map((p) => (
                <Box component="tr" key={p.name}>
                  <Box component="td" sx={{ textAlign: "left" }}>
                    {p.name}
                  </Box>
                  {Array.from({ length: round }, (_, r) => (
                    <Box component="td" key={r} sx={{ textAlign: "center" }}>
                      {p.scores[r] ?? "-"}
                    </Box>
                  ))}
                  <Box
                    component="td"
                    sx={{ textAlign: "center", fontWeight: "bold" }}
                  >
                    {p.scores.reduce((a, b) => a + b, 0)}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Paper>
      )}
      <Button variant="outlined" color="error" onClick={handleReset} fullWidth>
        Reset Game
      </Button>
    </Container>
  );
}

export default App;
