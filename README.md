# ♟ Chess — Web Game

A fully playable, browser-based chess game built with pure **HTML5, CSS3, and vanilla JavaScript** — no frameworks, no libraries, no backend required. Just open `chess-game.html` and play!

---

## 🎮 How to Play

1. Download `chess-game.html`
2. Open it in any modern browser (Chrome, Firefox, Safari, Edge)
3. Choose **Play vs Bot** or **Play vs Friend**
4. Click a piece to select it → green dots show legal moves → click a dot to move
5. Capture the opponent's King to win!

> **If you downloaded the 3-file version** (`index.html` + `style.css` + `script.js`), make sure all three files are in the **same folder**, then open `index.html`.

---

## ✨ Features

### 🕹 Game Modes
| Mode | Description |
|------|-------------|
| **Play vs Bot** | Face off against an AI opponent at 3 difficulty levels |
| **Play vs Friend** | Local 2-player mode — pass and play on the same device |

### 🤖 Bot AI Levels
| Level | Strategy |
|-------|----------|
| 😊 **Easy** | Plays completely random legal moves |
| 😠 **Normal** | Greedily captures pieces and avoids obvious blunders |
| 😈 **Hard** | Uses 2-ply Minimax with Alpha-Beta pruning + center control bonus |

### ♟ Full Chess Rules Implemented
- ✅ Legal move generation (all pieces)
- ✅ Check, Checkmate & Stalemate detection
- ✅ **Castling** (kingside & queenside)
- ✅ **En Passant**
- ✅ **Pawn Promotion** (choose Queen, Rook, Bishop or Knight)
- ✅ Move only out of check enforced
- ✅ Cannot move into check enforced

### 🔊 Sound Effects (Web Audio API)
| Action | Sound |
|--------|-------|
| Piece move | Soft tap tone |
| Capture | Impact thud |
| Check | Alarm chord |
| Castling | Rising fanfare |
| Bot move | Soft ping |
| Victory | Celebratory melody |
| Defeat | Descending tones |
| Button click | Quick tick |

> All sounds are generated in real-time using the **Web Audio API** — no sound files needed!

### 🎨 UI & Visual Features
- Dark space-themed design with glowing gold & teal accents
- Animated chess piece watermarks in the background
- Board coordinate labels (a–h, 1–8)
- **Last move highlight** — golden border on moved squares
- **Selected piece highlight** — yellow glow
- **Legal move dots** — subtle green circles
- **Capture highlights** — red overlay on capturable squares
- **Check highlight** — flashing red on the King in danger
- Pulsing gold ring around the active player's avatar
- Captured pieces displayed above/below the board
- Algebraic notation move history
- 🎉 Confetti explosion on victory
- 📖 **12-slide How to Play** tutorial with mini chessboards

---

## 📁 File Structure

### Single File Version
```
chess-game.html       ← Everything in one file — just open and play!
```

### Separated Version
```
index.html            ← Page structure & all HTML screens
style.css             ← All styles, themes, animations & responsive design
script.js             ← Game engine, AI, sounds & UI logic
```

---

## 🖥 Screens

```
Main Menu
   ├── How to Play  (12-slide tutorial carousel)
   ├── Play vs Bot  → Difficulty Selector (Easy / Normal / Hard)
   └── Play vs Friend → Game starts immediately
```

---

## 🛠 Technology Stack

| Technology | Usage |
|------------|-------|
| **HTML5** | Semantic structure, screen layout, overlays |
| **CSS3** | Custom properties, grid, animations, transitions, responsive design |
| **Vanilla JavaScript** | Full chess engine, AI, Web Audio sounds, DOM rendering |
| **Web Audio API** | Real-time procedural sound generation (no audio files) |
| **Google Fonts** | Fredoka One (headings) + Nunito (body text) |

---

## 🧠 Chess Engine Details

The engine uses a **2D array** (`8×8`) to represent the board. Each cell is either `null` (empty) or an object:

```js
{ t: 'Q', p: 0, moved: false }
//  type  player  hasMoved
// p=0 → White (You), p=1 → Black (Bot/P2)
```

### Move Generation
1. **Raw moves** — all geometrically possible squares for each piece type
2. **Legal moves** — raw moves filtered by simulating the board and rejecting any that leave the own King in check

### AI (Hard Mode — Minimax)
```
Depth 2 search with Alpha-Beta pruning
Evaluation = Σ(bot piece values) − Σ(your piece values) + center bonus
Piece values: Q=9, R=5, B=3.2, N=3, P=1, K=1000
```

---

## 📱 Responsive Design

The board scales to fit any screen size using `min(88vw, 440px)` — works great on both desktop browsers and mobile phones.

---

## 🚀 Getting Started (Quick)

```bash
# No installation needed!
# Just download the file and open it:
open chess-game.html
```

Or if you have a local server:
```bash
npx serve .
# then visit http://localhost:3000
```

---

## 🐛 Known Limitations

- Hard AI may take ~1 second to respond (minimax at depth 2)
- No online multiplayer (local only)
- No game save / load
- No time controls / chess clock

---

## 📸 Screenshots Preview

| Screen | Description |
|--------|-------------|
| Main Menu | Dark theme with floating chess piece watermarks |
| Difficulty | Emoji face + draggable slider (green → yellow → purple) |
| Tutorial | 12 interactive slides explaining every chess rule |
| Gameplay | Full board with highlights, captured pieces & move history |
| Victory | Confetti + crown animation overlay |

---

## 👩‍💻 Author

**Mansi Shekar Shetty**
B.Tech Computer Science Engineering — Semester II
ITM Skills University — School of Future Tech (2025–29)

---

## 📄 License

This project is created for educational purposes as part of a web development case study.
Free to use, modify and learn from.

---

> *"Chess is not just a game — it's a language of strategy, patience and creativity."*
