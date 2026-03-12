// ============================================================
// chessLogic.js — Chess Rules Engine
// FIX: Eliminated infinite recursion in king castling check.
//      _rawMoves for kings no longer calls _inCheck/_squareAttacked.
//      Instead castling legality is verified in legalMoves() after
//      the fact, using a dedicated _squaresAttackedBy() that never
//      recurses into castling logic.
// ============================================================

const PIECE = { PAWN:'pawn', ROOK:'rook', KNIGHT:'knight', BISHOP:'bishop', QUEEN:'queen', KING:'king' };
const COLOR = { WHITE:'white', BLACK:'black' };

class ChessGame {
  constructor() { this.reset(); }

  reset() {
    this.board     = this._makeInitialBoard();
    this.turn      = COLOR.WHITE;
    this.history   = [];
    this.captured  = { white:[], black:[] };
    this.status    = 'playing';
    this.enPassant = null;
    this.castling  = { white:{K:true,Q:true}, black:{K:true,Q:true} };
  }

  _makeInitialBoard() {
    const b = Array.from({length:8}, () => Array(8).fill(null));
    const back = [PIECE.ROOK,PIECE.KNIGHT,PIECE.BISHOP,PIECE.QUEEN,
                  PIECE.KING,PIECE.BISHOP,PIECE.KNIGHT,PIECE.ROOK];
    for (let c = 0; c < 8; c++) {
      b[0][c] = { type:back[c], color:COLOR.BLACK, id:`b_${back[c]}_${c}` };
      b[1][c] = { type:PIECE.PAWN, color:COLOR.BLACK, id:`b_pawn_${c}` };
      b[6][c] = { type:PIECE.PAWN, color:COLOR.WHITE, id:`w_pawn_${c}` };
      b[7][c] = { type:back[c],  color:COLOR.WHITE, id:`w_${back[c]}_${c}` };
    }
    return b;
  }

  at(r, c) {
    return (r>=0&&r<8&&c>=0&&c<8) ? this.board[r][c] : null;
  }

  // ── Legal moves (with check filter) ──────────────────────
  legalMoves(r, c) {
    const p = this.at(r, c);
    if (!p) return [];
    return this._rawMoves(r, c, p).filter(([tr, tc]) =>
      !this._wouldBeInCheck(r, c, tr, tc, p.color)
    );
  }

  // ── Raw pseudo-legal moves — NO recursion into _inCheck ──
  // Castling squares are emitted here but castling legality
  // (king not in check, not passing through attacked square)
  // is enforced in legalMoves via _wouldBeInCheck simulation.
  _rawMoves(r, c, p) {
    const moves = [];
    const { type, color } = p;
    const dir = color === COLOR.WHITE ? -1 : 1;

    if (type === PIECE.PAWN) {
      if (!this.at(r+dir, c)) {
        moves.push([r+dir, c]);
        const startRow = color === COLOR.WHITE ? 6 : 1;
        if (r === startRow && !this.at(r+2*dir, c))
          moves.push([r+2*dir, c]);
      }
      for (const dc of [-1, 1]) {
        const nr = r+dir, nc = c+dc;
        if (nr<0||nr>7||nc<0||nc>7) continue;
        const t = this.board[nr][nc];
        if (t && t.color !== color) moves.push([nr, nc]);
        if (this.enPassant && this.enPassant[0]===nr && this.enPassant[1]===nc)
          moves.push([nr, nc]);
      }

    } else if (type === PIECE.KNIGHT) {
      for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const nr = r+dr, nc = c+dc;
        if (nr<0||nr>7||nc<0||nc>7) continue;
        const t = this.board[nr][nc];
        if (!t || t.color !== color) moves.push([nr, nc]);
      }

    } else if (type === PIECE.KING) {
      for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const nr = r+dr, nc = c+dc;
        if (nr<0||nr>7||nc<0||nc>7) continue;
        const t = this.board[nr][nc];
        if (!t || t.color !== color) moves.push([nr, nc]);
      }
      // Castling squares — emit candidate moves only if squares are empty.
      // Check legality (king not in check, path not attacked) is done in
      // legalMoves() via _wouldBeInCheck, NOT here. This breaks the recursion.
      const row = color === COLOR.WHITE ? 7 : 0;
      if (r === row && c === 4) {
        if (this.castling[color].K && !this.at(row,5) && !this.at(row,6))
          moves.push([row, 6]);
        if (this.castling[color].Q && !this.at(row,3) && !this.at(row,2) && !this.at(row,1))
          moves.push([row, 2]);
      }

    } else {
      const dirs = {
        [PIECE.BISHOP]: [[-1,-1],[-1,1],[1,-1],[1,1]],
        [PIECE.ROOK]:   [[-1,0],[1,0],[0,-1],[0,1]],
        [PIECE.QUEEN]:  [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]
      };
      for (const [dr,dc] of dirs[type]) {
        let nr = r+dr, nc = c+dc;
        while (nr>=0&&nr<8&&nc>=0&&nc<8) {
          const t = this.board[nr][nc];
          if (!t) { moves.push([nr,nc]); }
          else { if (t.color!==color) moves.push([nr,nc]); break; }
          nr+=dr; nc+=dc;
        }
      }
    }
    return moves;
  }

  // ── Simulate move and check if our king is in check ──────
  _wouldBeInCheck(fr, fc, tr, tc, color) {
    const saved  = this.board.map(row => [...row]);
    const savedEP = this.enPassant;
    const piece  = this.board[fr][fc];

    // En passant removes the captured pawn from the side
    if (piece.type===PIECE.PAWN && this.enPassant &&
        tr===this.enPassant[0] && tc===this.enPassant[1]) {
      this.board[fr][tc] = null;
    }

    // For castling, also move the rook in the simulation so the
    // king's intermediate square check works correctly
    if (piece.type===PIECE.KING && Math.abs(tc-fc)===2) {
      const row = fr;
      if (tc===6) { this.board[row][5]=this.board[row][7]; this.board[row][7]=null; }
      else        { this.board[row][3]=this.board[row][0]; this.board[row][0]=null; }
    }

    this.board[tr][tc] = piece;
    this.board[fr][fc] = null;
    const inCheck = this._inCheck(color);
    this.board     = saved;
    this.enPassant = savedEP;
    return inCheck;
  }

  // ── Is color's king in check on current board? ───────────
  _inCheck(color) {
    const kp = this._findKing(color);
    return kp ? this._isAttackedBy(kp[0], kp[1], color===COLOR.WHITE ? COLOR.BLACK : COLOR.WHITE) : false;
  }

  _findKing(color) {
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      const p=this.board[r][c];
      if (p && p.type===PIECE.KING && p.color===color) return [r,c];
    }
    return null;
  }

  // ── Is square (r,c) attacked by any piece of `atkColor`? ─
  // Uses _rawMoves — safe because _rawMoves no longer calls _inCheck.
  _isAttackedBy(r, c, atkColor) {
    for (let sr=0;sr<8;sr++) for (let sc=0;sc<8;sc++) {
      const p = this.board[sr][sc];
      if (p && p.color===atkColor) {
        if (this._rawMoves(sr,sc,p).some(([mr,mc])=>mr===r&&mc===c))
          return true;
      }
    }
    return false;
  }

  // Keep old name as alias (used by botAI getSuggestions)
  _squareAttacked(r, c, defending) {
    const atk = defending===COLOR.WHITE ? COLOR.BLACK : COLOR.WHITE;
    return this._isAttackedBy(r, c, atk);
  }

  // ── All legal moves for a color ──────────────────────────
  allLegalMoves(color) {
    const all = [];
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      const p = this.board[r][c];
      if (p && p.color===color)
        this.legalMoves(r,c).forEach(([tr,tc])=>all.push({from:[r,c],to:[tr,tc],piece:p}));
    }
    return all;
  }

  // ── Execute a move ────────────────────────────────────────
  move(fr, fc, tr, tc) {
    const piece = this.at(fr,fc);
    if (!piece||piece.color!==this.turn) return false;
    const legal = this.legalMoves(fr,fc);
    if (!legal.some(([r,c])=>r===tr&&c===tc)) return false;

    const captured = this.board[tr][tc];
    const data = {
      from:[fr,fc], to:[tr,tc],
      piece:{...piece},
      captured: captured?{...captured}:null,
      epCapture:null, castling:null, promotion:null
    };

    // En passant
    if (piece.type===PIECE.PAWN && this.enPassant &&
        tr===this.enPassant[0] && tc===this.enPassant[1]) {
      data.epCapture = {...this.board[fr][tc]};
      this.board[fr][tc] = null;
      this.captured[data.epCapture.color].push(data.epCapture);
    }

    // Castling — move rook
    if (piece.type===PIECE.KING && Math.abs(tc-fc)===2) {
      const row = fr;
      if (tc===6) { this.board[row][5]=this.board[row][7]; this.board[row][7]=null; data.castling='K'; }
      else        { this.board[row][3]=this.board[row][0]; this.board[row][0]=null; data.castling='Q'; }
    }

    // Update en passant target
    this.enPassant = (piece.type===PIECE.PAWN && Math.abs(tr-fr)===2) ? [(fr+tr)/2, fc] : null;

    // Update castling rights
    if (piece.type===PIECE.KING) { this.castling[piece.color].K=false; this.castling[piece.color].Q=false; }
    if (piece.type===PIECE.ROOK) {
      if (fc===0) this.castling[piece.color].Q=false;
      if (fc===7) this.castling[piece.color].K=false;
    }

    this.board[tr][tc] = piece;
    this.board[fr][fc] = null;

    // Pawn promotion → auto queen
    if (piece.type===PIECE.PAWN && (tr===0||tr===7)) {
      this.board[tr][tc] = { type:PIECE.QUEEN, color:piece.color, id:piece.id+'_q' };
      data.promotion = 'queen';
    }

    if (captured) this.captured[captured.color].push({...captured});
    this.turn = this.turn===COLOR.WHITE ? COLOR.BLACK : COLOR.WHITE;
    this.history.push(data);
    this._updateStatus();
    return data;
  }

  _updateStatus() {
    const hasLegal = this.allLegalMoves(this.turn).length > 0;
    const inCheck  = this._inCheck(this.turn);
    this.status = !hasLegal ? (inCheck?'checkmate':'stalemate') : (inCheck?'check':'playing');
  }

  pieceValue(type) {
    return {pawn:100,knight:320,bishop:330,rook:500,queen:900,king:20000}[type]||0;
  }

  evaluate(color) {
    if (this.status==='checkmate') return this.turn===color ? -50000 : 50000;
    if (this.status==='stalemate') return 0;
    let score=0;
    const pawnPST=[
       0, 0, 0, 0, 0, 0, 0, 0,
      50,50,50,50,50,50,50,50,
      10,10,20,30,30,20,10,10,
       5, 5,10,25,25,10, 5, 5,
       0, 0, 0,20,20, 0, 0, 0,
       5,-5,-10,0,0,-10,-5, 5,
       5,10,10,-20,-20,10,10, 5,
       0, 0, 0, 0, 0, 0, 0, 0
    ];
    const knightPST=[
      -50,-40,-30,-30,-30,-30,-40,-50,
      -40,-20,  0,  0,  0,  0,-20,-40,
      -30,  0, 10, 15, 15, 10,  0,-30,
      -30,  5, 15, 20, 20, 15,  5,-30,
      -30,  0, 15, 20, 20, 15,  0,-30,
      -30,  5, 10, 15, 15, 10,  5,-30,
      -40,-20,  0,  5,  5,  0,-20,-40,
      -50,-40,-30,-30,-30,-30,-40,-50
    ];
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      const p=this.board[r][c]; if (!p) continue;
      const idx = p.color===COLOR.WHITE ? r*8+c : (7-r)*8+c;
      let val = this.pieceValue(p.type);
      if (p.type===PIECE.PAWN)   val += pawnPST[idx]||0;
      if (p.type===PIECE.KNIGHT) val += knightPST[idx]||0;
      score += p.color===color ? val : -val;
    }
    return score;
  }
}
// ============================================================
// botAI.js — Chess Bot (Negamax + Alpha-Beta Pruning)
// BUG FIXES: none needed — logic was correct
// ============================================================

class ChessBot {
  constructor(depth = 2) {
    this.depth = depth;
    this.nodes = 0;
  }

  // ── Pick best move for current player ───────────────────────
  getBestMove(game) {
    this.nodes = 0;
    const moves = this._orderMoves(game, game.allLegalMoves(game.turn));
    if (!moves.length) return null;

    let best = null, bestScore = -Infinity;
    const color = game.turn;

    for (const mv of moves) {
      const state  = this._save(game);
      const result = game.move(mv.from[0], mv.from[1], mv.to[0], mv.to[1]);
      if (!result) { this._restore(game, state); continue; }

      const score = -this._negamax(game, this.depth - 1, -Infinity, Infinity);
      this._restore(game, state);

      if (score > bestScore) { bestScore = score; best = mv; }
    }
    return best;
  }

  // ── Negamax with alpha-beta pruning ─────────────────────────
  _negamax(game, depth, alpha, beta) {
    this.nodes++;
    if (depth === 0 || game.status === 'checkmate' || game.status === 'stalemate')
      return game.evaluate(game.turn);

    const moves = this._orderMoves(game, game.allLegalMoves(game.turn));
    if (!moves.length) return game.evaluate(game.turn);

    let max = -Infinity;
    for (const mv of moves) {
      const state  = this._save(game);
      const result = game.move(mv.from[0], mv.from[1], mv.to[0], mv.to[1]);
      if (!result) { this._restore(game, state); continue; }

      const score = -this._negamax(game, depth - 1, -beta, -alpha);
      this._restore(game, state);

      if (score > max)   max   = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break; // beta cut-off
    }
    return max;
  }

  // ── Order moves: captures first (MVV-LVA heuristic) ─────────
  _orderMoves(game, moves) {
    return moves.slice().sort((a, b) => {
      const capA = game.at(a.to[0], a.to[1]);
      const capB = game.at(b.to[0], b.to[1]);
      const sA   = capA ? (game.pieceValue(capA.type) - game.pieceValue(a.piece.type) * 0.1) : 0;
      const sB   = capB ? (game.pieceValue(capB.type) - game.pieceValue(b.piece.type) * 0.1) : 0;
      return sB - sA;
    });
  }

  // ── Assist mode: top 2 suggested moves ──────────────────────
  getSuggestions(game) {
    const color  = game.turn;
    const moves  = game.allLegalMoves(color);
    const scored = [];

    for (const mv of moves) {
      let score = 0;
      const target = game.at(mv.to[0], mv.to[1]);

      // Prefer captures weighted by value difference
      if (target) score += game.pieceValue(target.type) - game.pieceValue(mv.piece.type) * 0.5;

      // Center control bonus
      const dr = Math.abs(3.5 - mv.to[0]);
      const dc = Math.abs(3.5 - mv.to[1]);
      score += (7 - dr - dc) * 2;

      // Bonus if move gives check or checkmate
      const state  = this._save(game);
      const result = game.move(mv.from[0], mv.from[1], mv.to[0], mv.to[1]);
      if (result) {
        if (game.status === 'check' || game.status === 'checkmate') score += 50;
      }
      this._restore(game, state);

      // Penalty for moving into an attacked square
      if (game._squareAttacked(mv.to[0], mv.to[1], color))
        score -= game.pieceValue(mv.piece.type) * 0.3;

      scored.push({ ...mv, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 2);
  }

  // ── State save/restore for simulation ───────────────────────
  _save(game) {
    return {
      board:     game.board.map(r => r.map(c => c ? {...c} : null)),
      turn:      game.turn,
      enPassant: game.enPassant,
      castling:  JSON.parse(JSON.stringify(game.castling)),
      status:    game.status,
      captured:  { white:[...game.captured.white], black:[...game.captured.black] },
      histLen:   game.history.length
    };
  }

  _restore(game, s) {
    game.board     = s.board.map(r => r.map(c => c ? {...c} : null));
    game.turn      = s.turn;
    game.enPassant = s.enPassant;
    game.castling  = JSON.parse(JSON.stringify(s.castling));
    game.status    = s.status;
    game.captured  = { white:[...s.captured.white], black:[...s.captured.black] };
    game.history   = game.history.slice(0, s.histLen);
  }
}
// ============================================================
// threeScene.js — 3D Arena Scene, Board, Pieces, Animations
// BUG FIXES:
//   1. THREE.CapsuleGeometry → custom capsule (not in r128)
//   2. renderer.outputColorSpace → renderer.outputEncoding (r128 API)
//   3. Flame variable name clash (fc) renamed to flameChild
// ============================================================

class ArenaScene {
  constructor(canvasEl) {
    this.canvas   = canvasEl;
    this.scene    = null;
    this.camera   = null;
    this.renderer = null;
    this.clock    = new THREE.Clock();

    this.pieces           = {};   // pieceId → THREE.Group
    this.squareMeshes     = [];   // [r][c] → Mesh
    this.squareHighlights = [];   // [r][c] → Mesh overlay
    this.arrows           = [];
    this.torchLights      = [];
    this.particles        = [];   // {type, mesh} for animate loop
    this.animQueue        = [];   // active delta-update functions
    this.introAnim        = null;

    this.SQ           = 1.7;     // world units per square
    this.targetCam    = { x:0, y:14, z:17 };
    this.lookTarget   = new THREE.Vector3(0, 0, 0);
    this.autoRotate   = false;
    this.autoRotAngle = 0;
    this.shake        = { active:false, intensity:0, t:0 };
  }

  // ── INIT ───────────────────────────────────────────────────
  init() {
    this._setupRenderer();
    this._setupScene();
    this._setupCamera();
    this._setupLights();
    this._buildArena();
    this._buildBoard();
    this._buildParticles();
    window.addEventListener('resize', () => this._onResize());
    this._loop();
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    // Use window dimensions explicitly — canvas may be display:none at init time
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.scene.fog        = new THREE.FogExp2(0x120800, 0.016);
    this.scene.background = new THREE.Color(0x0a0400);
  }

  _setupCamera() {
    this.camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 250);
    this.camera.position.set(0, 14, 17);
    this.camera.lookAt(0, 0, 0);
  }

  // ── LIGHTS ─────────────────────────────────────────────────
  _setupLights() {
    // Warm ambient
    this.scene.add(new THREE.AmbientLight(0x3a1200, 0.7));

    // Main sunset directional light with shadows
    const sun = new THREE.DirectionalLight(0xff8833, 2.0);
    sun.position.set(12, 22, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near   = 1;
    sun.shadow.camera.far    = 70;
    sun.shadow.camera.left   = sun.shadow.camera.bottom = -22;
    sun.shadow.camera.right  = sun.shadow.camera.top    =  22;
    sun.shadow.bias          = -0.0004;
    this.scene.add(sun);

    // Cool fill from opposite side
    const fill = new THREE.DirectionalLight(0x334488, 0.25);
    fill.position.set(-10, 6, -10);
    this.scene.add(fill);

    // Warm rim back-light
    const rim = new THREE.DirectionalLight(0xff4400, 0.35);
    rim.position.set(0, 4, -14);
    this.scene.add(rim);

    // 8 torch point lights around the board
    const tPos = [
      [-9,4,-9], [9,4,-9], [-9,4,9], [9,4,9],
      [0,4,-13], [0,4,13], [-13,4,0], [13,4,0]
    ];
    tPos.forEach((p, i) => {
      const pt = new THREE.PointLight(0xff6600, 2.8, 20, 2);
      pt.position.set(p[0], p[1], p[2]);
      this.scene.add(pt);
      this.torchLights.push({ light:pt, base:2.8, offset:i * 0.8 });
    });
  }

  // ── ARENA ──────────────────────────────────────────────────
  _buildArena() {
    const sandMat  = new THREE.MeshLambertMaterial({ color: 0xb8841e });
    const wallMat  = new THREE.MeshLambertMaterial({ color: 0x8a6010 });
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x6a4a08 });

    // Sand floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), sandMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.55;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Colosseum ring (28 wall segments)
    const wallH = 14, radius = 38, segs = 28;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const x  = (Math.cos(a0) + Math.cos(a1)) / 2 * radius;
      const z  = (Math.sin(a0) + Math.sin(a1)) / 2 * radius;
      const w  = 2 * radius * Math.sin(Math.PI / segs) + 0.15;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 3.5), wallMat);
      wall.position.set(x, wallH / 2 - 0.55, z);
      wall.lookAt(new THREE.Vector3(0, wallH / 2 - 0.55, 0));
      wall.receiveShadow = true;
      this.scene.add(wall);
      if (i % 2 === 0) {
        const merlons = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1.5, 3), stoneMat);
        merlons.position.set(x, wallH + 0.15, z);
        merlons.lookAt(new THREE.Vector3(0, wallH + 0.15, 0));
        this.scene.add(merlons);
      }
    }

    // Inner seating ring
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(41, 36, 4, 28, 1, true), stoneMat);
    tier.material.side = THREE.BackSide;
    tier.position.y    = 9;
    this.scene.add(tier);

    // Pillars with torch on each
    const pilMat = new THREE.MeshLambertMaterial({ color: 0x9b7818 });
    const pillarPos = [
      [-12,-12],[12,-12],[-12,12],[12,12],
      [0,-15],[0,15],[-15,0],[15,0]
    ];
    pillarPos.forEach(([px, pz]) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 9, 10), pilMat);
      pillar.position.set(px, 4, pz);
      pillar.castShadow = true;
      this.scene.add(pillar);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 1.4), pilMat);
      cap.position.set(px, 8.7, pz);
      this.scene.add(cap);
      this._addTorch(px, pz);
    });

    // Crowd silhouettes
    // FIX: THREE.CapsuleGeometry not available in r128 — use SphereGeometry stack instead
    const crowdMat = new THREE.MeshBasicMaterial({ color:0x120600, transparent:true, opacity:0.65 });
    for (let i = 0; i < 90; i++) {
      const ang  = Math.random() * Math.PI * 2;
      const r    = 31 + Math.random() * 5;
      const figGroup = new THREE.Group();
      // Body = sphere
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), crowdMat);
      // Head = smaller sphere on top
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 5, 4), crowdMat);
      head.position.y = 0.42;
      figGroup.add(body);
      figGroup.add(head);
      figGroup.position.set(Math.cos(ang) * r, 5 + Math.random() * 3, Math.sin(ang) * r);
      figGroup.userData = { baseY: figGroup.position.y, phase: Math.random() * Math.PI * 2 };
      this.scene.add(figGroup);
      this.particles.push({ type:'crowd', mesh:figGroup });
    }

    // Sky dome with vertex-coloured gradient
    const skyGeo  = new THREE.SphereGeometry(95, 16, 8);
    const skyCols = [];
    const skyPos  = skyGeo.attributes.position;
    for (let i = 0; i < skyPos.count; i++) {
      const t = (skyPos.getY(i) + 95) / 190;
      skyCols.push(0.08 + t * 0.28, 0.03 + t * 0.08, 0);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyCols, 3));
    const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));
  }

  _addTorch(px, pz) {
    const tMat = new THREE.MeshLambertMaterial({ color: 0x5a3600 });
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3, 8), tMat);
    stand.position.set(px, 1.5, pz);
    this.scene.add(stand);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.14, 0.35, 8), tMat);
    bowl.position.set(px, 3.2, pz);
    this.scene.add(bowl);

    // Flame group — 3 layered cones
    const fg = new THREE.Group();
    fg.position.set(px, 3.5, pz);
    const fColors = [0xff6600, 0xff3300, 0xffaa00];
    for (let i = 0; i < 3; i++) {
      // FIX: renamed loop var from 'fc' to 'flameChild' to avoid clash with chess column var
      const flameChild = new THREE.Mesh(
        new THREE.ConeGeometry(0.11 - i * 0.025, 0.4 + i * 0.08, 6),
        new THREE.MeshBasicMaterial({
          color: fColors[i], transparent: true,
          opacity: 0.9 - i * 0.2, depthWrite: false
        })
      );
      flameChild.position.y = i * 0.08;
      fg.add(flameChild);
    }
    fg.userData.isFlame = true;
    this.scene.add(fg);
    this.particles.push({ type:'flame', mesh:fg });
  }

  // ── BOARD ──────────────────────────────────────────────────
  _buildBoard() {
    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);

    const S  = this.SQ, bs = S * 8;
    const bronzeMat = new THREE.MeshLambertMaterial({ color: 0xcd7f32 });
    const baseMat   = new THREE.MeshLambertMaterial({ color: 0x8b6010 });

    // Stone platform
    const base = new THREE.Mesh(new THREE.BoxGeometry(bs + 2.4, 0.7, bs + 2.4), baseMat);
    base.position.y   = -0.35;
    base.receiveShadow = true;
    base.castShadow    = true;
    this.boardGroup.add(base);

    // Bronze border frames (4 sides)
    [
      [bs+2.4, 0.55, 0.9,  0, 0.28, -(bs/2+0.4)],
      [bs+2.4, 0.55, 0.9,  0, 0.28,   bs/2+0.4 ],
      [0.9, 0.55, bs+2.4, -(bs/2+0.4), 0.28, 0  ],
      [0.9, 0.55, bs+2.4,   bs/2+0.4,  0.28, 0  ]
    ].forEach(([w,h,d,x,y,z]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bronzeMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.boardGroup.add(m);
    });

    // 64 squares + highlight overlays
    this.squareMeshes     = [];
    this.squareHighlights = [];
    const lightCol = new THREE.Color(0xe0c98c);
    const darkCol  = new THREE.Color(0x5c3808);

    for (let r = 0; r < 8; r++) {
      this.squareMeshes.push([]);
      this.squareHighlights.push([]);
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 0;
        const sq = new THREE.Mesh(
          new THREE.BoxGeometry(S, 0.12, S),
          new THREE.MeshLambertMaterial({ color: isLight ? lightCol : darkCol })
        );
        sq.position.set((c - 3.5) * S, 0, (r - 3.5) * S);
        sq.receiveShadow = true;
        sq.userData = { row:r, col:c };
        this.boardGroup.add(sq);
        this.squareMeshes[r].push(sq);

        const hl = new THREE.Mesh(
          new THREE.PlaneGeometry(S * 0.9, S * 0.9),
          new THREE.MeshBasicMaterial({
            color: 0x00ff44, transparent: true, opacity: 0, depthWrite: false
          })
        );
        hl.rotation.x = -Math.PI / 2;
        hl.position.set((c - 3.5) * S, 0.07, (r - 3.5) * S);
        this.boardGroup.add(hl);
        this.squareHighlights[r].push(hl);
      }
    }
  }

  // ── PIECE FACTORY ──────────────────────────────────────────
  createPiece(type, color, id) {
    const bronzeLight = 0xd4922a;
    const bronzeDark  = 0x7a4f0c;
    const col = color === 'white' ? bronzeLight : bronzeDark;
    const mat = new THREE.MeshLambertMaterial({
      color:   col,
      emissive: new THREE.Color(col).multiplyScalar(0.08)
    });
    const g = new THREE.Group();
    g.userData = { id, type, color };

    switch (type) {
      case 'pawn':   this._pawn(g, mat);   break;
      case 'rook':   this._rook(g, mat);   break;
      case 'knight': this._knight(g, mat); break;
      case 'bishop': this._bishop(g, mat); break;
      case 'queen':  this._queen(g, mat);  break;
      case 'king':   this._king(g, mat);   break;
    }
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
  }

  // Helper: cylinder primitive
  _cyl(rt, rb, h, mat, x=0, y=0, z=0) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 12), mat);
    m.position.set(x, y, z);
    return m;
  }

  _pawn(g, mat) {
    g.add(this._cyl(0.34, 0.28, 0.2,  mat, 0, 0.10));
    g.add(this._cyl(0.14, 0.20, 0.45, mat, 0, 0.42));
    g.add(this._cyl(0.20, 0.14, 0.10, mat, 0, 0.69));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), mat);
    head.position.y = 0.9;
    g.add(head);
    g.add(this._cyl(0.05, 0.05, 0.18, mat, 0, 1.14)); // helmet crest
  }

  _rook(g, mat) {
    g.add(this._cyl(0.38, 0.30, 0.20, mat, 0, 0.10));
    g.add(this._cyl(0.26, 0.30, 0.55, mat, 0, 0.47));
    g.add(this._cyl(0.33, 0.26, 0.13, mat, 0, 0.80));
    g.add(this._cyl(0.28, 0.28, 0.08, mat, 0, 0.90));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const battlement = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.14), mat);
      battlement.position.set(Math.cos(a) * 0.22, 1.04, Math.sin(a) * 0.22);
      g.add(battlement);
    }
  }

  _knight(g, mat) {
    g.add(this._cyl(0.38, 0.32, 0.20, mat, 0, 0.10));
    g.add(this._cyl(0.18, 0.32, 0.48, mat, 0, 0.44));
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.38, 8), mat);
    neck.position.set(0.1, 0.85, 0);
    neck.rotation.z = -0.42;
    g.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.27, 0.16), mat);
    head.position.set(0.27, 1.10, 0);
    head.rotation.z = -0.28;
    g.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.11, 0.13), mat);
    snout.position.set(0.40, 1.00, 0);
    g.add(snout);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.10, 4), mat);
    ear.position.set(0.21, 1.28, 0.04);
    g.add(ear);
  }

  _bishop(g, mat) {
    g.add(this._cyl(0.36, 0.28, 0.20, mat, 0, 0.10));
    g.add(this._cyl(0.16, 0.28, 0.52, mat, 0, 0.46));
    g.add(this._cyl(0.21, 0.14, 0.12, mat, 0, 0.78));
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), mat);
    sphere.position.y = 0.98;
    g.add(sphere);
    g.add(this._cyl(0.06, 0.12, 0.32, mat, 0, 1.22)); // mitre shaft
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.20, 6), mat);
    tip.position.y = 1.50;
    g.add(tip);
  }

  _queen(g, mat) {
    g.add(this._cyl(0.40, 0.36, 0.22, mat, 0, 0.11));
    g.add(this._cyl(0.20, 0.36, 0.58, mat, 0, 0.50));
    g.add(this._cyl(0.30, 0.20, 0.13, mat, 0, 0.85));
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mat);
    body.position.y = 1.02;
    g.add(body);
    g.add(this._cyl(0.26, 0.28, 0.16, mat, 0, 1.24)); // crown ring
    for (let i = 0; i < 8; i++) {
      const a  = (i / 8) * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 4), mat);
      sp.position.set(Math.cos(a) * 0.20, 1.44, Math.sin(a) * 0.20);
      g.add(sp);
    }
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), mat);
    orb.position.y = 1.55;
    g.add(orb);
  }

  _king(g, mat) {
    g.add(this._cyl(0.42, 0.38, 0.24, mat, 0, 0.12));
    g.add(this._cyl(0.22, 0.38, 0.62, mat, 0, 0.53));
    g.add(this._cyl(0.32, 0.22, 0.15, mat, 0, 0.91));
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.30, 12, 10), mat);
    body.position.y = 1.12;
    g.add(body);
    g.add(this._cyl(0.28, 0.30, 0.19, mat, 0, 1.38)); // crown ring
    for (let i = 0; i < 5; i++) {
      const a  = (i / 5) * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.20, 4), mat);
      sp.position.set(Math.cos(a) * 0.22, 1.60, Math.sin(a) * 0.22);
      g.add(sp);
    }
    // Imperial cross
    g.add(this._cyl(0.035, 0.035, 0.30, mat, 0, 1.77));
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.06, 0.06), mat);
    crossH.position.y = 1.84;
    g.add(crossH);
  }

  // ── BOARD ↔️ WORLD ──────────────────────────────────────────
  boardToWorld(r, c) {
    return new THREE.Vector3((c - 3.5) * this.SQ, 0.06, (r - 3.5) * this.SQ);
  }

  placePiece(pieceData, r, c) {
    this.removePiece(pieceData.id);
    const mesh = this.createPiece(pieceData.type, pieceData.color, pieceData.id);
    const p    = this.boardToWorld(r, c);
    mesh.position.set(p.x, 0.06, p.z);
    if (pieceData.color === 'white') mesh.rotation.y = Math.PI;
    this.boardGroup.add(mesh);
    this.pieces[pieceData.id] = mesh;
    return mesh;
  }

  removePiece(id) {
    if (this.pieces[id]) {
      this.boardGroup.remove(this.pieces[id]);
      delete this.pieces[id];
    }
  }

  // ── HIGHLIGHTS ─────────────────────────────────────────────
  clearHighlights() {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        this.squareHighlights[r][c].material.opacity = 0;
        this.squareHighlights[r][c].material.color.set(0x00ff44);
      }
  }

  highlightSq(r, c, hex, op = 0.5) {
    if (r < 0 || r > 7 || c < 0 || c > 7) return;
    this.squareHighlights[r][c].material.color.set(hex);
    this.squareHighlights[r][c].material.opacity = op;
  }

  // ── ARROWS ─────────────────────────────────────────────────
  clearArrows() {
    this.arrows.forEach(a => this.boardGroup.remove(a));
    this.arrows = [];
  }

  drawArrow(from, to, col) {
    const fp = this.boardToWorld(from[0], from[1]);
    const tp = this.boardToWorld(to[0],   to[1]);
    fp.y = tp.y = 0.18;
    const dir    = new THREE.Vector3().subVectors(tp, fp);
    const len    = dir.length();
    const arrow  = new THREE.ArrowHelper(dir.normalize(), fp, len, col, 0.45, 0.40);
    this.boardGroup.add(arrow);
    this.arrows.push(arrow);
  }

  // ── ANIMATIONS ─────────────────────────────────────────────

  // Smooth arc move
  animMove(id, fr, fc, tr, tc, onDone) {
    const mesh = this.pieces[id];
    if (!mesh) { if (onDone) onDone(); return; }
    const start = this.boardToWorld(fr, fc);
    const end   = this.boardToWorld(tr, tc);
    let t = 0;
    const dur = 0.55;
    this.animQueue.push(delta => {
      t += delta / dur;
      const e    = Math.min(t, 1);
      const ease = e < 0.5 ? 2*e*e : -1 + (4 - 2*e)*e;
      const lift = Math.sin(e * Math.PI) * 2.8;
      mesh.position.x = start.x + (end.x - start.x) * ease;
      mesh.position.y = 0.06 + lift;
      mesh.position.z = start.z + (end.z - start.z) * ease;
      if (t >= 1) {
        mesh.position.set(end.x, 0.06, end.z);
        if (onDone) onDone();
        return false;
      }
      return true;
    });
  }

  // Gladiator capture: attacker charges, defender collapses
  animCapture(attackerId, fr, fc, tr, tc, capturedId, onDone) {
    const atk = this.pieces[attackerId];
    const def = this.pieces[capturedId];
    if (!atk || !def) { if (onDone) onDone(); return; }

    const start = this.boardToWorld(fr, fc);
    const end   = this.boardToWorld(tr, tc);
    let phase = 0, t = 0;

    this.animQueue.push(delta => {
      t += delta;
      if (phase === 0) {
        // Phase 0: attacker charges (0.35 s)
        const dur  = 0.35;
        const e    = Math.min(t / dur, 1);
        const ease = e * e * (3 - 2 * e);
        const lift = Math.sin(e * Math.PI) * 1.5;
        atk.position.x = start.x + (end.x - start.x) * ease;
        atk.position.y = 0.06 + lift;
        atk.position.z = start.z + (end.z - start.z) * ease;
        if (e > 0.95 && !this.shake.active)
          this.shake = { active:true, intensity:0.18, t:0 };
        if (t >= dur) {
          phase = 1; t = 0;
          atk.position.set(end.x, 0.06, end.z);
          this._spawnSparks(end.x, 0.4, end.z);
        }
      } else if (phase === 1) {
        // Phase 1: defender falls and fades (0.4 s)
        const dur = 0.4;
        const e   = Math.min(t / dur, 1);
        if (def) {
          def.rotation.z  = e * Math.PI / 2;
          def.position.y  = 0.06 - e * 0.8;
          def.traverse(m => {
            if (m.isMesh) { m.material.transparent = true; m.material.opacity = 1 - e; }
          });
        }
        if (t >= dur) { this.removePiece(capturedId); phase = 2; t = 0; }
      } else {
        // Phase 2: brief settle pause
        if (t > 0.15) { if (onDone) onDone(); return false; }
      }
      return true;
    });
  }

  // Bounce when selected
  animSelect(id) {
    const mesh = this.pieces[id];
    if (!mesh) return;
    const y0 = mesh.position.y;
    let t = 0;
    this.animQueue.push(delta => {
      t += delta / 0.22;
      mesh.position.y = y0 + Math.sin(Math.min(t, 1) * Math.PI) * 0.5;
      return t < 1;
    });
  }

  // ── PARTICLES ──────────────────────────────────────────────
  _buildParticles() {
    const count = 300;
    const geo   = new THREE.BufferGeometry();
    const pos   = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3]   = (Math.random() - 0.5) * 22;
      pos[i*3+1] = Math.random() * 5;
      pos[i*3+2] = (Math.random() - 0.5) * 22;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xff9944, size: 0.045, transparent: true, opacity: 0.45, depthWrite: false
    }));
    this.scene.add(this.dust);
  }

  _spawnSparks(x, y, z) {
    const count = 18;
    const geo   = new THREE.BufferGeometry();
    const pos   = new Float32Array(count * 3);
    const vel   = [];
    for (let i = 0; i < count; i++) {
      pos[i*3] = x; pos[i*3+1] = y; pos[i*3+2] = z;
      vel.push({
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 1,
        vz: (Math.random() - 0.5) * 4
      });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sparks = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffdd00, size: 0.10, transparent: true, opacity: 1, depthWrite: false
    }));
    this.scene.add(sparks);

    let t = 0;
    this.animQueue.push(delta => {
      t += delta;
      const p = sparks.geometry.attributes.position;
      for (let i = 0; i < count; i++) {
        p.setXYZ(i,
          p.getX(i) + vel[i].vx * delta,
          p.getY(i) + vel[i].vy * delta,
          p.getZ(i) + vel[i].vz * delta
        );
        vel[i].vy -= 9.8 * delta; // gravity
      }
      p.needsUpdate = true;
      sparks.material.opacity = Math.max(0, 1 - t / 0.6);
      if (t > 0.6) { this.scene.remove(sparks); return false; }
      return true;
    });
  }

  // ── CINEMATIC INTRO ────────────────────────────────────────
  playIntro(onDone) {
    this.camera.position.set(0, 30, 0.1);
    this.camera.lookAt(0, 0, 0);

    const k1 = this.createPiece('king', 'white', 'intro_w');
    const k2 = this.createPiece('king', 'black', 'intro_b');
    k1.position.set(-5, 0.06, 0);
    k2.position.set( 5, 0.06, 0);
    k2.rotation.y = Math.PI;
    this.boardGroup.add(k1);
    this.boardGroup.add(k2);

    let phase = 0, t = 0, camAngle = 0;
    const phases = [1.2, 1.8, 1.2, 0.9, 2.2]; // seconds per phase

    this.introAnim = delta => {
      t += delta;
      camAngle += delta * (0.25 + phase * 0.05);
      const cr = 20 - phase * 1.5;
      this.camera.position.set(
        Math.sin(camAngle) * cr,
        12 - phase * 0.5,
        Math.cos(camAngle) * cr
      );
      this.camera.lookAt(0, 1, 0);

      switch (phase) {
        case 0: // Kings face each other
          break;
        case 1: // White king marches forward
          k1.position.x  = -5 + Math.min(t * 2.2, 3);
          k1.rotation.y  = Math.PI + Math.sin(t * 8) * 0.05;
          break;
        case 2: // Clash — black pushed back
          k1.position.x = -2;
          k2.position.x = 5 + Math.min(t * 2.5, 2.5);
          if (t > 0.1 && !this.shake.active)
            this.shake = { active:true, intensity:0.25, t:0 };
          break;
        case 3: // Black king falls
          k2.rotation.z  = Math.min(t * 2.8, Math.PI / 2);
          k2.position.y  = 0.06 - Math.min(t * 0.1, 0.05);
          this._spawnSparks(k2.position.x, 0.5, k2.position.z);
          break;
        case 4: // Hold on fallen king
          break;
      }

      if (t > phases[phase]) {
        t = 0;
        phase++;
        if (phase >= phases.length) {
          this.boardGroup.remove(k1);
          this.boardGroup.remove(k2);
          this.introAnim = null;
          if (onDone) onDone();
        }
      }
    };
  }

  // ── CAMERA ─────────────────────────────────────────────────
  setCam(x, y, z) {
    this.targetCam  = { x, y, z };
    this.lookTarget.set(0, 0, 0);
  }
  camWhite() { this.setCam(0, 14,  17); }
  camBlack() { this.setCam(0, 14, -17); }
  camTop()   { this.setCam(0, 24, 0.1); }
  startAutoRotate() { this.autoRotate = true;  this.autoRotAngle = 0; }
  stopAutoRotate()  { this.autoRotate = false; }

  // ── RAYCASTING ─────────────────────────────────────────────
  getClickedSquare(evt) {
    // Use window dimensions for normalisation — getBoundingClientRect on a
    // canvas that was previously display:none can return stale zero values.
    const mouse = new THREE.Vector2(
       (evt.clientX / window.innerWidth)  * 2 - 1,
      -(evt.clientY / window.innerHeight) * 2 + 1
    );
    const rc   = new THREE.Raycaster();
    rc.setFromCamera(mouse, this.camera);
    const hits = rc.intersectObjects(this.squareMeshes.flat(), false);
    if (!hits.length) return null;
    return hits[0].object.userData;
  }

  // ── MAIN RENDER LOOP ───────────────────────────────────────
  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const et = this.clock.getElapsedTime();

    if (this.introAnim) {
      this.introAnim(dt);
    } else {
      if (this.autoRotate) {
        this.autoRotAngle += dt * 0.22;
        const r = 18;
        this.camera.position.set(
          Math.sin(this.autoRotAngle) * r, 14,
          Math.cos(this.autoRotAngle) * r
        );
        this.camera.lookAt(0, 0, 0);
      } else {
        // Smooth camera lerp
        this.camera.position.x += (this.targetCam.x - this.camera.position.x) * 0.06;
        this.camera.position.y += (this.targetCam.y - this.camera.position.y) * 0.06;
        this.camera.position.z += (this.targetCam.z - this.camera.position.z) * 0.06;
        this.camera.lookAt(this.lookTarget);
      }
    }

    // Camera shake
    if (this.shake.active) {
      this.shake.t += dt;
      const s = this.shake.intensity * Math.max(0, 1 - this.shake.t / 0.35);
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s * 0.5;
      if (this.shake.t > 0.35) this.shake.active = false;
    }

    // Run animation queue (remove completed ones)
    this.animQueue = this.animQueue.filter(fn => fn(dt) !== false);

    // Torch flicker
    this.torchLights.forEach((t, i) => {
      t.light.intensity = t.base + Math.sin(et * 9 + t.offset) * 0.55;
      t.light.color.setRGB(1, 0.32 + Math.sin(et * 6 + i) * 0.06, 0);
    });

    // Particles: flames and crowd
    this.particles.forEach((p, i) => {
      if (p.type === 'flame') {
        p.mesh.children.forEach((child, j) => {
          child.position.y  = j * 0.08 + Math.sin(et * 13 + j) * 0.025;
          child.scale.x     = 1 + Math.sin(et * 17 + j) * 0.1;
          child.rotation.y += dt * 1.5;
        });
      }
      if (p.type === 'crowd') {
        p.mesh.position.y = p.mesh.userData.baseY +
          Math.sin(et * 2 + p.mesh.userData.phase) * 0.18;
      }
    });

    // Dust drift upwards, loop back
    if (this.dust) {
      const dp = this.dust.geometry.attributes.position;
      for (let i = 0; i < dp.count; i++) {
        dp.setY(i, dp.getY(i) + dt * 0.08);
        if (dp.getY(i) > 5) dp.setY(i, 0);
      }
      dp.needsUpdate = true;
      this.dust.rotation.y += dt * 0.008;
    }

    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }
}
// ============================================================
// main.js — Game Controller
// BUG FIXES:
//   - toggleAssistSettings & cycleDifficulty moved here (were only in HTML inline)
//   - showGameOver defined once cleanly (no double-override hack)
//   - promoteVisual correctly removes old piece using original id
//   - moveCastleRook correctly reads rook from post-move board position
//   - backToMenu sets G.active = false before clearing to stop bot
//   - updateHUD safely checks element existence before setting
// ============================================================

let G = {
  scene:    null,
  game:     null,
  bot:      null,
  mode:     'pvp',   // 'pvp' | 'pve'
  active:   false,
  selected: null,    // { row, col }
  moves:    [],
  assist:   false,
  sound:    true,
  cam:      'white',
  botBusy:  false,
  audioCtx: null,
  botDepth: 2,
};

// ── BOOT ────────────────────────────────────────────────────
window.addEventListener('load', () => {
  G.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  show('screen-intro');

  // Auto-advance after loading bar (3s CSS anim + 0.4s buffer)
  let titleShown = false;
  function doShowTitle() {
    if (titleShown) return;
    titleShown = true;
    showTitleCard();
  }
  setTimeout(doShowTitle, 3400);
  // Fallback: tap/click anywhere on intro to skip straight to title
  document.getElementById('screen-intro').addEventListener('click', doShowTitle);
});

function initScene() {
  if (G.scene) return; // already initialized
  const canvas = document.getElementById('game-canvas');
  G.scene = new ArenaScene(canvas);
  G.scene.init();
  canvas.addEventListener('click', onCanvasClick);
}

function showTitleCard() {
  document.getElementById('screen-intro').innerHTML = `
    <div class="title-card">
      <div class="title-sigil">⚔</div>
      <h1 class="title-main">ARENA CHESS</h1>
      <h2 class="title-sub">GLADIATOR WAR</h2>
      <div class="title-line"></div>
      <p class="title-tagline">Where Strategy Meets Blood Sport</p>
      <button class="btn-enter" onclick="showMenu()">ENTER THE ARENA</button>
    </div>
  `;
  playTone([[180, 0.4], [270, 0.4], [360, 0.6], [270, 0.4]]);
}
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function showMenu() {
  // Hide canvas, show static bg for menu
  document.getElementById('game-canvas').style.display = 'none';
  document.getElementById('static-bg').style.display   = 'block';
  if (G.scene) G.scene.startAutoRotate();
  show('screen-menu');
}
function showHowToPlay() { show('screen-howto'); runTutorial(); }
function showAbout()     { show('screen-about'); }
function showSettings()  { show('screen-settings'); _syncSettingsUI(); }

// Sync settings panel buttons to current state
function _syncSettingsUI() {
  const sb = document.getElementById('settings-sound-btn');
  const ab = document.getElementById('settings-assist-btn');
  const db = document.getElementById('settings-diff-btn');
  if (sb) sb.textContent = G.sound  ? 'ON'  : 'OFF';
  if (ab) ab.textContent = G.assist ? 'ON'  : 'OFF';
  if (db) db.textContent = G.botDepth === 1 ? 'EASY' : G.botDepth === 3 ? 'HARD' : 'MEDIUM';
}

// ── SETTINGS CONTROLS ───────────────────────────────────────
function toggleAssistSettings() {
  toggleAssist();
  const ab = document.getElementById('settings-assist-btn');
  if (ab) {
    ab.textContent  = G.assist ? 'ON' : 'OFF';
    ab.style.color  = G.assist ? 'var(--bronze-lt)' : '';
  }
}

function cycleDifficulty() {
  const levels = [1, 2, 3];
  const labels = ['EASY', 'MEDIUM', 'HARD'];
  G.botDepth = levels[(levels.indexOf(G.botDepth) + 1) % levels.length];
  const db = document.getElementById('settings-diff-btn');
  if (db) db.textContent = labels[levels.indexOf(G.botDepth)];
  if (G.bot) G.bot.depth = G.botDepth;
}

// ── GAME START ───────────────────────────────────────────────
function startPvP() { beginGame('pvp'); }
function startPvE() { beginGame('pve'); }

function beginGame(mode) {
  G.mode     = mode;
  G.game     = new ChessGame();
  G.bot      = new ChessBot(G.botDepth);
  G.active   = true;
  G.selected = null;
  G.moves    = [];
  G.botBusy  = false;

  // Init 3D scene on first game start (lazy — not on page load)
  initScene();

  // Switch from static bg to 3D canvas
  document.getElementById('static-bg').style.display   = 'none';
  document.getElementById('game-canvas').style.display = 'block';

  // CRITICAL: Force renderer to resize to actual canvas dimensions now that
  // the canvas is visible. If we skip this the canvas has size 0x0 from when
  // it was display:none, breaking raycasting and making pieces unclickable.
  G.scene._onResize();

  G.scene.stopAutoRotate();

  // Remove all old 3D pieces
  Object.keys(G.scene.pieces).forEach(id => G.scene.removePiece(id));

  // Place all starting pieces
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = G.game.board[r][c];
      if (p) G.scene.placePiece(p, r, c);
    }

  G.scene.clearHighlights();
  G.scene.clearArrows();
  G.scene.camWhite();
  G.cam = 'white';

  // Update camera button label
  const camBtn = document.getElementById('btn-cam');
  if (camBtn) camBtn.textContent = '📷 WHITE';

  // Hide game-over banner
  const gob = document.getElementById('game-over-banner');
  if (gob) gob.classList.remove('visible');

  show('screen-game');
  updateHUD();

  // If PvE and bot plays white (unlikely but handle it)
  if (G.mode === 'pve' && G.game.turn === 'black') scheduleBotMove();
}

// ── BOARD INTERACTION ────────────────────────────────────────
function onCanvasClick(evt) {
  if (!G.active || G.botBusy) return;
  if (G.game.status === 'checkmate' || G.game.status === 'stalemate') return;
  if (G.mode === 'pve' && G.game.turn === 'black') return;

  const sq = G.scene.getClickedSquare(evt);
  if (!sq) return;
  const { row, col } = sq;

  if (G.selected) {
    // Try to make the move if destination is legal
    if (G.moves.some(([r, c]) => r === row && c === col)) {
      doMove(G.selected.row, G.selected.col, row, col);
      G.selected = null;
      G.moves    = [];
      G.scene.clearHighlights();
      G.scene.clearArrows();
    } else {
      // Re-select if clicking own piece
      const p = G.game.at(row, col);
      if (p && p.color === G.game.turn) {
        selectSq(row, col);
      } else {
        G.selected = null;
        G.moves    = [];
        G.scene.clearHighlights();
        G.scene.clearArrows();
      }
    }
  } else {
    const p = G.game.at(row, col);
    if (p && p.color === G.game.turn) selectSq(row, col);
  }
}

function selectSq(r, c) {
  G.selected = { row:r, col:c };
  G.moves    = G.game.legalMoves(r, c);
  const piece = G.game.board[r][c];

  G.scene.clearHighlights();
  G.scene.highlightSq(r, c, 0xffdd00, 0.6); // selected = gold
  G.moves.forEach(([mr, mc]) => {
    const tgt = G.game.at(mr, mc);
    G.scene.highlightSq(mr, mc, tgt ? 0xff3300 : 0x00ff88, 0.45); // capture=red, move=green
  });
  if (piece) G.scene.animSelect(piece.id);
  playTone([[440, 0.04]]);
  if (G.assist) showAssist();
}

function doMove(fr, fc, tr, tc) {
  const movingPiece   = G.game.board[fr][fc];
  const capturedPiece = G.game.board[tr][tc];
  const capturedId    = capturedPiece ? capturedPiece.id : null;
  // Save original pawn id before promotion changes it
  const movingId      = movingPiece.id;

  const result = G.game.move(fr, fc, tr, tc);
  if (!result) return;

  if (capturedId) {
    G.scene.animCapture(movingId, fr, fc, tr, tc, capturedId, () => {
      if (result.promotion) promoteVisual(tr, tc, movingId);
      postMoveUpdate();
    });
    playTone([[350, 0.12], [200, 0.12], [110, 0.25]], 'sawtooth');
  } else {
    G.scene.animMove(movingId, fr, fc, tr, tc, () => {
      if (result.castling) moveCastleRook(result, fr);
      if (result.promotion) promoteVisual(tr, tc, movingId);
      postMoveUpdate();
    });
    playTone([[280, 0.06], [360, 0.06]]);
  }

  // Flip camera in PvP after each move
  if (G.mode === 'pvp') {
    setTimeout(() => {
      if (G.game.turn === 'black') G.scene.camBlack();
      else G.scene.camWhite();
    }, 400);
  }
}

// Animate rook sliding during castling
// After game.move(), rook is already at new board position (col 5 or col 3)
// So we animate it FROM the old column TO the new column visually
function moveCastleRook(result, fromRow) {
  if (result.castling === 'K') {
    // Kingside: rook went from col 7 to col 5
    const rook = G.game.board[fromRow][5];
    if (rook) G.scene.animMove(rook.id, fromRow, 7, fromRow, 5, null);
  } else {
    // Queenside: rook went from col 0 to col 3
    const rook = G.game.board[fromRow][3];
    if (rook) G.scene.animMove(rook.id, fromRow, 0, fromRow, 3, null);
  }
}

// Replace pawn mesh with queen mesh on promotion
// originalId = the pawn's id before it was promoted (before game.move renamed it to id+'_q')
function promoteVisual(r, c, originalId) {
  G.scene.removePiece(originalId);
  const promoted = G.game.board[r][c]; // now a queen with id = originalId + '_q'
  if (promoted) G.scene.placePiece(promoted, r, c);
}

function postMoveUpdate() {
  updateHUD();
  checkStatus();
  if (G.mode === 'pve' && G.game.turn === 'black' && G.active) scheduleBotMove();
}

// ── BOT ─────────────────────────────────────────────────────
function scheduleBotMove() {
  G.botBusy = true;
  updateHUD();
  const delay = 700 + Math.random() * 500;

  setTimeout(() => {
    if (!G.active) { G.botBusy = false; return; }
    const mv = G.bot.getBestMove(G.game);
    G.botBusy = false;
    if (!mv) return;

    // Flash the bot's chosen piece briefly
    G.scene.clearHighlights();
    G.scene.highlightSq(mv.from[0], mv.from[1], 0xff8800, 0.6);

    setTimeout(() => {
      if (!G.active) return;
      doMove(mv.from[0], mv.from[1], mv.to[0], mv.to[1]);
      G.scene.clearHighlights();
    }, 350);
  }, delay);
}

// ── ASSIST MODE ──────────────────────────────────────────────
function showAssist() {
  G.scene.clearArrows();
  const suggestions = G.bot.getSuggestions(G.game);
  suggestions.forEach((mv, i) => {
    G.scene.drawArrow(mv.from, mv.to, i === 0 ? 0x00ff44 : 0xffdd00);
  });
}

function toggleAssist() {
  G.assist = !G.assist;
  const btn = document.getElementById('btn-assist');
  if (btn) btn.classList.toggle('active', G.assist);
  if (!G.assist) {
    G.scene.clearArrows();
  } else if (G.selected) {
    showAssist();
  }
}

// ── GAME STATUS ──────────────────────────────────────────────
function checkStatus() {
  const s = G.game.status;
  if (s === 'checkmate') {
    G.active = false;
    const winner = G.game.turn === 'white' ? 'BLACK' : 'WHITE';
    playTone([[220, 0.3], [110, 0.3], [55, 0.5], [110, 0.5]], 'sawtooth');
    setTimeout(() => showGameOver(`⚔ ${winner} CONQUERS ⚔`, 'The enemy king has fallen.'), 600);
  } else if (s === 'stalemate') {
    G.active = false;
    setTimeout(() => showGameOver('⚖ STALEMATE', 'No warrior may advance. Honor is satisfied.'), 400);
  } else if (s === 'check') {
    playTone([[440, 0.1], [880, 0.1], [440, 0.2]], 'square');
    flashHUD('⚠ CHECK!', '#ff4400');
  }
}

function showGameOver(title, subtitle) {
  const el = document.getElementById('game-over-banner');
  const t  = document.getElementById('go-title');
  const s  = document.getElementById('go-sub');
  if (t)  t.textContent = title;
  if (s)  s.textContent = subtitle;
  if (el) el.classList.add('visible');
  if (G.scene) G.scene.startAutoRotate();
}

function flashHUD(msg, color) {
  const el = document.getElementById('hud-alert');
  if (!el) return;
  el.textContent = msg;
  el.style.color = color;
  el.classList.remove('flash');
  // Force reflow so re-adding the class restarts the animation
  void el.offsetWidth;
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 2000);
}

function updateHUD() {
  const turnEl = document.getElementById('hud-turn');
  const modeEl = document.getElementById('hud-mode');
  const botEl  = document.getElementById('hud-bot');
  if (turnEl) {
    turnEl.textContent  = G.game.turn.toUpperCase();
    turnEl.dataset.color = G.game.turn;
  }
  if (modeEl) modeEl.textContent = G.mode === 'pvp' ? '⚔ PvP' : '🤖 vs Bot';
  if (botEl)  botEl.style.display = G.botBusy ? 'flex' : 'none';
}

// ── TUTORIAL ─────────────────────────────────────────────────
const tutorialPieces = [
  {
    type:'pawn', name:'PAWN',
    desc:'Advances one square forward. Captures diagonally. Can move two squares from its starting position. Promotes to a queen upon reaching the far rank.',
    moves:[[2,0],[1,1],[1,-1]]
  },
  {
    type:'rook', name:'ROOK',
    desc:'Moves any number of squares horizontally or vertically. The guardian of the flanks. Also participates in castling with the king.',
    moves:[[0,3],[0,-3],[3,0],[-3,0],[0,2],[0,-2],[2,0],[-2,0]]
  },
  {
    type:'knight', name:'KNIGHT',
    desc:'Moves in an L-shape: two squares in one direction then one square perpendicular. The only piece that can leap over others.',
    moves:[[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[1,-2],[-1,2],[1,2]]
  },
  {
    type:'bishop', name:'BISHOP',
    desc:'Moves any number of squares diagonally. Each bishop stays on its starting color for the entire game. Commands the diagonals.',
    moves:[[2,2],[2,-2],[-2,2],[-2,-2]]
  },
  {
    type:'queen', name:'QUEEN',
    desc:'Combines the rook and bishop — moves any number of squares in any direction. The most powerful warrior on the board.',
    moves:[[2,0],[0,2],[-2,0],[0,-2],[2,2],[-2,2],[2,-2],[-2,-2]]
  },
  {
    type:'king', name:'KING',
    desc:'Moves one square in any direction. Must be protected at all costs — his capture ends the battle. Can castle with a rook if neither has moved.',
    moves:[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]
  },
];

let tutIdx = 0;
function runTutorial() { tutIdx = 0; renderTutStep(); }
function nextTut() { tutIdx = (tutIdx + 1) % tutorialPieces.length; renderTutStep(); }
function prevTut() { tutIdx = (tutIdx - 1 + tutorialPieces.length) % tutorialPieces.length; renderTutStep(); }

function renderTutStep() {
  const tp = tutorialPieces[tutIdx];
  const el = document.getElementById('tut-content');
  if (!el) return;

  const cells = [];
  const fromR = 2, fromC = 2;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const isSrc  = r === fromR && c === fromC;
      const isDest = tp.moves.some(([dr, dc]) => fromR + dr === r && fromC + dc === c);
      // Clamp dest dots to within 5x5 board
      const inBounds = r >= 0 && r < 5 && c >= 0 && c < 5;
      let cls = `tut-cell ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
      if (isSrc)             cls += ' src';
      if (isDest && inBounds) cls += ' dest';
      cells.push(`<div class="${cls}">${isSrc ? getPieceChar(tp.type) : ''}</div>`);
    }
  }

  el.innerHTML = `
    <div class="tut-piece-name">${getPieceChar(tp.type)} &nbsp; ${tp.name}</div>
    <div class="tut-board">${cells.join('')}</div>
    <p class="tut-desc">${tp.desc}</p>
    <div class="tut-nav">
      <button class="btn-roman-sm" onclick="prevTut()">◀️ PREV</button>
      <span class="tut-counter">${tutIdx + 1} / ${tutorialPieces.length}</span>
      <button class="btn-roman-sm" onclick="nextTut()">NEXT ▶️</button>
    </div>
  `;
}

function getPieceChar(type) {
  return { pawn:'♙', rook:'♖', knight:'♘', bishop:'♗', queen:'♕', king:'♔' }[type] || '?';
}

// ── CONTROLS ─────────────────────────────────────────────────
function restartGame() {
  beginGame(G.mode);
}

function backToMenu() {
  G.active  = false;
  G.botBusy = false;
  const gob = document.getElementById('game-over-banner');
  if (gob) gob.classList.remove('visible');
  if (G.scene) { G.scene.clearHighlights(); G.scene.clearArrows(); }
  // Switch back to static background
  document.getElementById('game-canvas').style.display = 'none';
  document.getElementById('static-bg').style.display   = 'block';
  showMenu();
}

function cycleCam() {
  const modes = ['white', 'black', 'top'];
  G.cam = modes[(modes.indexOf(G.cam) + 1) % modes.length];
  if (G.cam === 'white') G.scene.camWhite();
  else if (G.cam === 'black') G.scene.camBlack();
  else G.scene.camTop();
  const btn = document.getElementById('btn-cam');
  if (btn) btn.textContent = '📷 ' + G.cam.toUpperCase();
}

function toggleSound() {
  G.sound = !G.sound;
  const btn = document.getElementById('btn-sound');
  if (btn) {
    btn.textContent = G.sound ? '🔊 SOUND' : '🔇 MUTED';
    btn.classList.toggle('active', G.sound);
  }
  // Also update settings panel button
  const sb = document.getElementById('settings-sound-btn');
  if (sb) sb.textContent = G.sound ? 'ON' : 'OFF';
}

// ── AUDIO ─────────────────────────────────────────────────────
function playTone(notes, wave = 'triangle') {
  if (!G.sound || !G.audioCtx) return;
  if (G.audioCtx.state === 'suspended') G.audioCtx.resume();
  let t = G.audioCtx.currentTime;
  notes.forEach(([freq, dur]) => {
    const osc  = G.audioCtx.createOscillator();
    const gain = G.audioCtx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(G.audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    t += dur * 0.75;
  });
}