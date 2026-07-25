
const STORAGE_KEY = "family-card-table-v1";

const SUITS = [
  { key: "spades", label: "Pik", symbol: "♠", color: "black" },
  { key: "hearts", label: "Herz", symbol: "♥", color: "red" },
  { key: "diamonds", label: "Karo", symbol: "♦", color: "red" },
  { key: "clubs", label: "Kreuz", symbol: "♣", color: "black" },
];

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "B", "D", "K"];
const DEFAULT_SETTINGS = {
  playerCount: 4,
  handSize: 7,
  playerNames: [],
};

const el = {};
let state = loadState() ?? createFreshState();

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheElements();
  bindEvents();
  syncSettingsFromState();
  if (!state.game) {
    createNewGame("Start bereit. Ein neues Spiel wurde angelegt.");
  } else {
    normalizeLoadedState();
  }
  render();
}

function cacheElements() {
  el.playerCount = document.getElementById("playerCount");
  el.handSize = document.getElementById("handSize");
  el.playerCountLabel = document.getElementById("playerCountLabel");
  el.handSizeLabel = document.getElementById("handSizeLabel");
  el.playerNames = document.getElementById("playerNames");
  el.newGameBtn = document.getElementById("newGameBtn");
  el.saveBtn = document.getElementById("saveBtn");
  el.loadBtn = document.getElementById("loadBtn");
  el.clearBtn = document.getElementById("clearBtn");
  el.deckPile = document.getElementById("deckPile");
  el.deckCount = document.getElementById("deckCount");
  el.discardPile = document.getElementById("discardPile");
  el.turnName = document.getElementById("turnName");
  el.turnHint = document.getElementById("turnHint");
  el.gameStatus = document.getElementById("gameStatus");
  el.endTurnBtn = document.getElementById("endTurnBtn");
  el.reshuffleBtn = document.getElementById("reshuffleBtn");
  el.helpBtn = document.getElementById("helpBtn");
  el.players = document.getElementById("players");
  el.log = document.getElementById("log");
  el.rulesDialog = document.getElementById("rulesDialog");
}

function bindEvents() {
  el.playerCount.addEventListener("input", () => {
    state.settings.playerCount = clampInt(el.playerCount.value, 2, 8);
    ensurePlayerNamesLength();
    syncSettingsFromState();
    renderPlayerNameInputs();
    autosave();
  });

  el.handSize.addEventListener("input", () => {
    state.settings.handSize = clampInt(el.handSize.value, 3, 10);
    syncSettingsFromState();
    autosave();
  });

  el.newGameBtn.addEventListener("click", () => createNewGame("Neues Spiel gestartet."));
  el.saveBtn.addEventListener("click", () => {
    saveState();
    flashStatus("Gespeichert.");
  });
  el.loadBtn.addEventListener("click", () => {
    const loaded = loadState();
    if (loaded) {
      state = loaded;
      normalizeLoadedState();
      render();
      flashStatus("Gespeichert geladen.");
    } else {
      flashStatus("Kein Speicherstand gefunden.");
    }
  });
  el.clearBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    flashStatus("Speicher gelöscht.");
  });
  el.deckPile.addEventListener("click", () => drawCard());
  el.endTurnBtn.addEventListener("click", () => endTurn());
  el.reshuffleBtn.addEventListener("click", () => reshuffleDiscardIntoDeck());
  el.helpBtn.addEventListener("click", () => {
    if (typeof el.rulesDialog.showModal === "function") {
      el.rulesDialog.showModal();
    } else {
      alert("Regel: Gleiche Farbe oder gleicher Wert. Ziehe mit dem Stapel und beende danach den Zug.");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.target && ["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
    if (event.code === "Space") {
      event.preventDefault();
      drawCard();
    } else if (event.code === "Enter") {
      event.preventDefault();
      endTurn();
    }
  });
}

function createFreshState() {
  return {
    settings: {
      ...DEFAULT_SETTINGS,
      playerNames: defaultPlayerNames(DEFAULT_SETTINGS.playerCount),
    },
    game: null,
    log: [],
  };
}

function defaultPlayerNames(count) {
  return Array.from({ length: count }, (_, index) => `Spieler ${index + 1}`);
}

function ensurePlayerNamesLength() {
  const desired = state.settings.playerCount;
  const current = Array.isArray(state.settings.playerNames) ? state.settings.playerNames : [];
  const names = current.slice(0, desired);
  while (names.length < desired) {
    names.push(`Spieler ${names.length + 1}`);
  }
  state.settings.playerNames = names;
}

function syncSettingsFromState() {
  ensurePlayerNamesLength();
  el.playerCount.value = String(state.settings.playerCount);
  el.handSize.value = String(state.settings.handSize);
  el.playerCountLabel.textContent = `${state.settings.playerCount}`;
  el.handSizeLabel.textContent = `${state.settings.handSize}`;
  renderPlayerNameInputs();
}

function renderPlayerNameInputs() {
  el.playerNames.innerHTML = "";
  state.settings.playerNames.forEach((name, index) => {
    const row = document.createElement("label");
    row.className = "name-row";
    row.innerHTML = `
      <span class="tag">Spieler ${index + 1}</span>
      <input type="text" maxlength="24" value="${escapeHtml(name)}" data-player-name="${index}" />
      <span class="tag">Name</span>
    `;
    const input = row.querySelector("input");
    input.addEventListener("input", (event) => {
      state.settings.playerNames[index] = event.target.value.trim() || `Spieler ${index + 1}`;
      autosave();
    });
    el.playerNames.appendChild(row);
  });
}

function createNewGame(message) {
  ensurePlayerNamesLength();

  const deck = shuffle(createDeck());
  const playerCount = state.settings.playerCount;
  const handSize = state.settings.handSize;
  const players = Array.from({ length: playerCount }, (_, index) => ({
    id: index,
    name: state.settings.playerNames[index] || `Spieler ${index + 1}`,
    hand: [],
  }));

  for (let round = 0; round < handSize; round += 1) {
    for (const player of players) {
      const card = deck.pop();
      if (card) player.hand.push(card);
    }
  }

  const discard = [];
  const opening = deck.pop();
  if (opening) discard.push(opening);

  state.game = {
    players,
    deck,
    discard,
    currentPlayer: 0,
    over: false,
    winner: null,
    turnNumber: 1,
    lastAction: message,
    selectedCardId: null,
  };

  state.log = [
    logEntry("Neues Spiel", `Mit ${playerCount} Spielern gestartet.`),
    ...(opening ? [logEntry("Startkarte", formatCard(opening), true)] : []),
  ];

  saveState();
  render();
  flashStatus(message);
}

function createDeck() {
  const deck = [];
  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      deck.push({
        id: `${suit.key}-${rank}-${Math.random().toString(36).slice(2, 9)}`,
        suit: suit.key,
        suitLabel: suit.label,
        suitSymbol: suit.symbol,
        color: suit.color,
        rank,
      });
    });
  });
  return deck;
}

function shuffle(array) {
  const deck = [...array];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function drawCard() {
  if (!state.game || state.game.over) return;

  const player = getCurrentPlayer();
  if (!player) return;

  if (state.game.deck.length === 0) {
    reshuffleDiscardIntoDeck(false);
  }

  const card = state.game.deck.pop();
  if (!card) {
    addLog("Stapel leer", "Keine Karten mehr zum Ziehen.");
    saveState();
    render();
    return;
  }

  player.hand.push(card);
  state.game.selectedCardId = card.id;
  state.game.lastAction = `${player.name} zieht ${formatCard(card)}.`;

  addLog(player.name, `zieht ${formatCard(card)}.`);
  saveState();
  render();
}

function playCard(cardId) {
  if (!state.game || state.game.over) return;

  const player = getCurrentPlayer();
  if (!player) return;

  const cardIndex = player.hand.findIndex((card) => card.id === cardId);
  if (cardIndex === -1) return;

  const card = player.hand[cardIndex];
  const top = getTopDiscardCard();
  const openingMove = state.game.discard.length === 0;
  const playable = openingMove || isPlayable(card, top);

  if (!playable) {
    flashStatus("Diese Karte passt nicht auf den Ablagestapel.");
    return;
  }

  player.hand.splice(cardIndex, 1);
  state.game.discard.push(card);
  state.game.selectedCardId = null;
  state.game.lastAction = `${player.name} spielt ${formatCard(card)}.`;

  addLog(player.name, `spielt ${formatCard(card)}.`);
  if (player.hand.length === 0) {
    state.game.over = true;
    state.game.winner = player.name;
    addLog("Spielende", `${player.name} gewinnt!`, true);
    flashStatus(`${player.name} gewinnt!`);
  } else {
    endTurn(false);
  }

  saveState();
  render();
}

function endTurn(announce = true) {
  if (!state.game || state.game.over) return;

  state.game.currentPlayer = (state.game.currentPlayer + 1) % state.game.players.length;
  state.game.turnNumber += 1;
  state.game.selectedCardId = null;
  state.game.lastAction = `Nächster Zug: ${getCurrentPlayer()?.name ?? "—"}`;

  if (announce) {
    addLog("Zug beendet", `Jetzt ist ${getCurrentPlayer()?.name ?? "—"} am Zug.`);
  }

  saveState();
  render();
  if (announce) flashStatus(`Jetzt ist ${getCurrentPlayer()?.name ?? "—"} am Zug.`);
}

function reshuffleDiscardIntoDeck(announce = true) {
  if (!state.game || state.game.over) return;

  if (state.game.deck.length > 0) {
    if (announce) flashStatus("Der Nachziehstapel ist noch nicht leer.");
    return;
  }

  if (state.game.discard.length <= 1) {
    if (announce) flashStatus("Zu wenig Karten zum Mischen.");
    return;
  }

  const top = state.game.discard.pop();
  state.game.deck = shuffle(state.game.discard);
  state.game.discard = top ? [top] : [];

  addLog("Mischen", "Ablage zurück in den Nachziehstapel gemischt.", true);
  saveState();
  render();
  if (announce) flashStatus("Stapel neu gemischt.");
}

function isPlayable(card, top) {
  if (!card || !top) return true;
  return card.suit === top.suit || card.rank === top.rank;
}

function getCurrentPlayer() {
  if (!state.game) return null;
  return state.game.players[state.game.currentPlayer] ?? null;
}

function getTopDiscardCard() {
  if (!state.game || state.game.discard.length === 0) return null;
  return state.game.discard[state.game.discard.length - 1];
}

function render() {
  syncSettingsFromState();
  renderBoard();
  renderPlayers();
  renderLog();
  updateStatus();
  saveState();
}

function renderBoard() {
  if (!state.game) {
    el.deckCount.textContent = "0";
    el.discardPile.innerHTML = "";
    el.turnName.textContent = "—";
    el.turnHint.textContent = "Starte ein Spiel, um loszulegen.";
    el.endTurnBtn.disabled = true;
    el.reshuffleBtn.disabled = true;
    return;
  }

  const top = getTopDiscardCard();
  const current = getCurrentPlayer();

  el.deckCount.textContent = String(state.game.deck.length);
  el.turnName.textContent = current?.name ?? "—";
  el.turnHint.textContent = state.game.over
    ? `${state.game.winner ?? "Jemand"} hat gewonnen.`
    : `Top-Karte: ${top ? formatCard(top) : "keine"}`;
  el.endTurnBtn.disabled = state.game.over;
  el.reshuffleBtn.disabled = state.game.over;
  el.deckPile.disabled = state.game.over;

  if (top) {
    el.discardPile.innerHTML = cardTemplate(top, true, false);
  } else {
    el.discardPile.innerHTML = `
      <div class="card face-down card-enter" aria-hidden="true">
        <div class="back-pattern"></div>
      </div>
    `;
  }
}

function renderPlayers() {
  if (!state.game) {
    el.players.innerHTML = "";
    return;
  }

  el.players.innerHTML = state.game.players
    .map((player, index) => {
      const active = index === state.game.currentPlayer && !state.game.over;
      const cards = active
        ? player.hand.map((card) => {
            const playable = isPlayable(card, getTopDiscardCard()) || state.game.discard.length === 0;
            const selected = state.game.selectedCardId === card.id;
            return `
              <div class="hand-card-wrap">
                ${cardTemplate(card, true, playable, selected)}
              </div>
            `;
          }).join("")
        : player.hand
            .slice(0, 8)
            .map(() => `
              <div class="hand-card-wrap">
                <div class="card face-down card-enter">
                  <div class="back-pattern"></div>
                </div>
              </div>
            `).join("") + (player.hand.length > 8 ? `<div class="hand-count">+${player.hand.length - 8} weitere</div>` : "");

      return `
        <article class="player-board ${active ? "active" : ""}">
          <div class="player-head">
            <div>
              <div class="player-name">${escapeHtml(player.name)}</div>
              <div class="player-subtitle">${active ? "Am Zug" : "Wartet"}</div>
            </div>
            <div class="player-badge">${player.hand.length} Karte${player.hand.length === 1 ? "" : "n"}</div>
          </div>
          <div class="player-hand">${cards || `<div class="hand-count">Keine Karten mehr.</div>`}</div>
        </article>
      `;
    })
    .join("");

  el.players.querySelectorAll("[data-card-id]").forEach((button) => {
    button.addEventListener("click", () => playCard(button.dataset.cardId));
  });
}

function renderLog() {
  el.log.innerHTML = state.log
    .slice(0, 8)
    .map((entry) => `
      <div class="log-item">
        <strong>${escapeHtml(entry.title)}</strong>
        <small>${escapeHtml(entry.detail)}</small>
      </div>
    `)
    .join("");
}

function updateStatus() {
  if (!state.game) {
    el.gameStatus.textContent = "Bereit";
    return;
  }

  if (state.game.over) {
    el.gameStatus.textContent = `${state.game.winner ?? "Spiel"} beendet`;
    return;
  }

  const current = getCurrentPlayer();
  const top = getTopDiscardCard();
  el.gameStatus.textContent = current
    ? `${current.name} ist dran · ${top ? formatCard(top) : "Start"}`
    : "Spiel läuft";
}

function cardTemplate(card, faceUp, playable, selected) {
  const suit = getSuit(card.suit);
  const classes = [
    "card",
    faceUp ? "" : "face-down",
    suit.color,
    playable ? "playable" : "",
    selected ? "selected" : "",
    "card-enter",
  ]
    .filter(Boolean)
    .join(" ");

  if (!faceUp) {
    return `
      <div class="${classes}" aria-label="Verdeckte Karte">
        <div class="back-pattern"></div>
      </div>
    `;
  }

  return `
    <button
      class="${classes}"
      type="button"
      data-card-id="${card.id}"
      aria-label="${formatCard(card)}"
      ${playable ? "" : 'aria-disabled="true"'}
    >
      <div class="card-glow"></div>
      <div class="corner top-left">
        <div class="rank">${escapeHtml(card.rank)}</div>
        <div class="suit">${suit.symbol}</div>
      </div>
      <div class="corner bottom-right">
        <div class="rank">${escapeHtml(card.rank)}</div>
        <div class="suit">${suit.symbol}</div>
      </div>
      <div class="center-rank">
        <div class="suit-badge">${suit.symbol}</div>
        <div>${escapeHtml(card.rank)}</div>
      </div>
    </button>
  `;
}

function getSuit(key) {
  return SUITS.find((suit) => suit.key === key) ?? SUITS[0];
}

function formatCard(card) {
  const suit = getSuit(card.suit);
  return `${card.rank} ${suit.label}`;
}

function logEntry(title, detail, important = false) {
  return {
    title,
    detail,
    important,
    time: new Date().toISOString(),
  };
}

function addLog(title, detail, important = false) {
  state.log.unshift(logEntry(title, detail, important));
  state.log = state.log.slice(0, 20);
}

function flashStatus(message) {
  el.gameStatus.textContent = message;
  el.gameStatus.classList.remove("pulse");
  void el.gameStatus.offsetWidth;
  el.gameStatus.classList.add("pulse");
  window.setTimeout(() => {
    if (state.game) updateStatus();
  }, 900);
}

function autosave() {
  if (state.game) {
    saveState();
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Konnte Spielstand nicht speichern:", error);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.settings) parsed.settings = { ...DEFAULT_SETTINGS };
    if (!Array.isArray(parsed.settings.playerNames)) {
      parsed.settings.playerNames = defaultPlayerNames(clampInt(parsed.settings.playerCount ?? 4, 2, 8));
    }
    if (!Array.isArray(parsed.log)) parsed.log = [];
    return parsed;
  } catch (error) {
    console.warn("Konnte Spielstand nicht laden:", error);
    return null;
  }
}

function normalizeLoadedState() {
  state.settings.playerCount = clampInt(state.settings.playerCount ?? 4, 2, 8);
  state.settings.handSize = clampInt(state.settings.handSize ?? 7, 3, 10);
  ensurePlayerNamesLength();

  if (state.game) {
    state.game.players = Array.isArray(state.game.players) ? state.game.players : [];
    state.game.currentPlayer = clampInt(state.game.currentPlayer ?? 0, 0, Math.max(0, state.game.players.length - 1));
    state.game.deck = Array.isArray(state.game.deck) ? state.game.deck : [];
    state.game.discard = Array.isArray(state.game.discard) ? state.game.discard : [];
    state.game.over = Boolean(state.game.over);
    state.game.winner = state.game.winner ?? null;
    state.game.selectedCardId = state.game.selectedCardId ?? null;
    if (!state.game.players.length) {
      createNewGame("Gespeicherter Stand war leer. Neues Spiel erstellt.");
    }
  }
}

function clampInt(value, min, max) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
