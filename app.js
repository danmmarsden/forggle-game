(function () {
  "use strict";

  const COLOURS = [
    { id: "ruby", name: "Ruby", hex: "#d63f56" },
    { id: "tangerine", name: "Tangerine", hex: "#ef7f31" },
    { id: "sun", name: "Sun", hex: "#f0c43b" },
    { id: "leaf", name: "Leaf", hex: "#49a65a" },
    { id: "aqua", name: "Aqua", hex: "#22a8b8" },
    { id: "blue", name: "Blue", hex: "#356fd0" },
    { id: "violet", name: "Violet", hex: "#7652c8" },
    { id: "pink", name: "Pink", hex: "#d8449d" }
  ];

  const CODE_LENGTH = 4;
  const STORAGE_KEY = "mastermind-best-score-v1";

  function createSecret(length = CODE_LENGTH) {
    return Array.from({ length }, () => {
      const index = Math.floor(Math.random() * COLOURS.length);
      return COLOURS[index].id;
    });
  }

  function scoreGuess(guess, secret) {
    const marks = Array(guess.length).fill("blank");
    const remaining = new Map();

    guess.forEach((colour, index) => {
      if (colour === secret[index]) {
        marks[index] = "check";
      } else {
        remaining.set(secret[index], (remaining.get(secret[index]) || 0) + 1);
      }
    });

    guess.forEach((colour, index) => {
      if (marks[index] !== "blank") {
        return;
      }

      const available = remaining.get(colour) || 0;
      if (available > 0) {
        marks[index] = "misplaced";
        remaining.set(colour, available - 1);
      }
    });

    return marks;
  }

  function colourById(id) {
    return COLOURS.find((colour) => colour.id === id);
  }

  function countMarks(marks, type) {
    return marks.filter((mark) => mark === type).length;
  }

  function plural(value, singular, pluralText) {
    return value === 1 ? singular : pluralText;
  }

  if (typeof module !== "undefined") {
    module.exports = { COLOURS, CODE_LENGTH, createSecret, scoreGuess };
  }

  if (typeof document === "undefined") {
    return;
  }

  const elements = {
    tray: document.querySelector("#colour-tray"),
    board: document.querySelector("#board"),
    secretPegs: document.querySelector("#secret-pegs"),
    turnCount: document.querySelector("#turn-count"),
    bestScore: document.querySelector("#best-score"),
    newGame: document.querySelector("#new-game")
  };

  const state = {
    secret: createSecret(),
    currentGuess: Array(CODE_LENGTH).fill(null),
    selectedColour: null,
    turns: [],
    solved: false
  };

  const dragState = {
    active: null,
    suppressNextClick: false
  };

  function init() {
    renderPalette();
    renderGame();
    elements.newGame.addEventListener("click", startNewGame);
  }

  function startNewGame() {
    state.secret = createSecret();
    state.currentGuess = Array(CODE_LENGTH).fill(null);
    state.selectedColour = null;
    state.turns = [];
    state.solved = false;
    renderGame();
  }

  function renderPalette() {
    elements.tray.innerHTML = "";

    COLOURS.forEach((colour) => {
      const token = document.createElement("button");
      token.className = "colour-token";
      token.type = "button";
      token.draggable = true;
      token.dataset.colour = colour.id;
      token.style.setProperty("--peg", colour.hex);
      token.setAttribute("aria-label", colour.name);
      token.title = colour.name;

      token.addEventListener("click", () => {
        if (dragState.suppressNextClick) {
          dragState.suppressNextClick = false;
          return;
        }

        state.selectedColour = state.selectedColour === colour.id ? null : colour.id;
        renderPaletteSelection();
      });

      token.addEventListener("pointerdown", (event) => startPointerDrag(event, colour.id, token));

      token.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", colour.id);
        event.dataTransfer.effectAllowed = "copy";
      });

      elements.tray.appendChild(token);
    });
  }

  function renderPaletteSelection() {
    elements.tray.querySelectorAll(".colour-token").forEach((token) => {
      token.classList.toggle("is-selected", token.dataset.colour === state.selectedColour);
      token.setAttribute("aria-pressed", String(token.dataset.colour === state.selectedColour));
    });
  }

  function renderGame() {
    renderPaletteSelection();
    renderSecret();
    renderBoard();
    elements.turnCount.textContent = String(state.turns.length + (state.solved ? 0 : 1));
    elements.bestScore.textContent = readBestScore();
  }

  function renderSecret() {
    elements.secretPegs.innerHTML = "";
    state.secret.forEach((colourId) => {
      const colour = colourById(colourId);
      const peg = document.createElement("span");

      if (state.solved) {
        peg.className = "peg";
        peg.style.setProperty("--peg", colour.hex);
        peg.setAttribute("aria-label", colour.name);
      } else {
        peg.className = "secret-cover";
        peg.textContent = "?";
        peg.setAttribute("aria-label", "Hidden colour");
      }

      elements.secretPegs.appendChild(peg);
    });
  }

  function renderBoard() {
    elements.board.innerHTML = "";

    state.turns.forEach((turn, index) => {
      elements.board.appendChild(createGuessRow({
        turnNumber: index + 1,
        guess: turn.guess,
        marks: turn.marks,
        active: false
      }));
    });

    if (!state.solved) {
      elements.board.appendChild(createGuessRow({
        turnNumber: state.turns.length + 1,
        guess: state.currentGuess,
        marks: Array(CODE_LENGTH).fill("blank"),
        active: true
      }));
    }
  }

  function createGuessRow({ turnNumber, guess, marks, active }) {
    const row = document.createElement("div");
    row.className = `guess-row${active ? " is-active" : " is-locked"}`;

    const index = document.createElement("span");
    index.className = "turn-index";
    index.textContent = turnNumber;
    row.appendChild(index);

    const slots = document.createElement("div");
    slots.className = "slots";

    guess.forEach((colourId, slotIndex) => {
      const slot = document.createElement("button");
      slot.className = `slot${colourId ? " is-filled" : ""}`;
      slot.type = "button";
      slot.disabled = !active;
      slot.dataset.slot = String(slotIndex);
      slot.setAttribute("aria-label", `Slot ${slotIndex + 1}`);

      if (colourId) {
        const colour = colourById(colourId);
        const peg = document.createElement("span");
        peg.className = "slot-peg";
        peg.style.setProperty("--peg", colour.hex);
        peg.setAttribute("aria-hidden", "true");
        slot.appendChild(peg);
        slot.setAttribute("aria-label", `Slot ${slotIndex + 1}, ${colour.name}`);
      }

      if (active) {
        slot.addEventListener("click", () => placeSelectedColour(slotIndex));
        slot.addEventListener("dragover", allowDrop);
        slot.addEventListener("dragleave", () => slot.classList.remove("is-over"));
        slot.addEventListener("drop", (event) => handleDrop(event, slotIndex));
      }

      slots.appendChild(slot);
    });

    row.appendChild(slots);
    row.appendChild(createFeedback(marks));

    if (!active) {
      return row;
    }

    const submit = document.createElement("button");
    submit.className = "icon-button submit-button";
    submit.type = "button";
    submit.innerHTML = '<span aria-hidden="true">&rarr;</span>';
    submit.title = "Submit guess";
    submit.setAttribute("aria-label", "Submit guess");
    submit.disabled = !active || !isCurrentGuessComplete();
    submit.addEventListener("click", submitGuess);
    row.appendChild(submit);

    const clear = document.createElement("button");
    clear.className = "icon-button clear-button";
    clear.type = "button";
    clear.innerHTML = '<span aria-hidden="true">&times;</span>';
    clear.title = "Clear row";
    clear.setAttribute("aria-label", "Clear row");
    clear.disabled = !active || state.currentGuess.every((colour) => !colour);
    clear.addEventListener("click", clearCurrentGuess);
    row.appendChild(clear);

    return row;
  }

  function createFeedback(marks) {
    const feedback = document.createElement("div");
    feedback.className = "feedback";
    feedback.setAttribute("aria-label", describeMarks(marks));

    visibleFeedbackMarks(marks).forEach((mark) => {
      feedback.appendChild(createMark(mark));
    });

    return feedback;
  }

  function createMark(mark) {
    const badge = document.createElement("span");
    badge.className = `mark ${mark}`;

    if (mark === "check") {
      badge.innerHTML = "&#10003;";
      badge.setAttribute("aria-label", "Correct colour and place");
    } else {
      badge.textContent = "X";
      badge.setAttribute("aria-label", "Correct colour, wrong place");
    }

    return badge;
  }

  function visibleFeedbackMarks(marks) {
    return [
      ...Array(countMarks(marks, "check")).fill("check"),
      ...Array(countMarks(marks, "misplaced")).fill("misplaced")
    ];
  }

  function describeMarks(marks) {
    const checks = countMarks(marks, "check");
    const misplaced = countMarks(marks, "misplaced");
    return `${checks} ${plural(checks, "check", "checks")}, ${misplaced} wrong place`;
  }

  function placeSelectedColour(slotIndex) {
    if (!state.selectedColour || state.solved) {
      return;
    }

    state.currentGuess[slotIndex] = state.selectedColour;
    renderGame();
  }

  function allowDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.add("is-over");
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(event, slotIndex) {
    event.preventDefault();
    event.currentTarget.classList.remove("is-over");

    const colourId = event.dataTransfer.getData("text/plain");
    if (!COLOURS.some((colour) => colour.id === colourId)) {
      return;
    }

    state.currentGuess[slotIndex] = colourId;
    state.selectedColour = colourId;
    renderGame();
  }

  function startPointerDrag(event, colourId, source) {
    if (event.button !== 0 || state.solved) {
      return;
    }

    dragState.active = {
      colourId,
      ghost: null,
      moved: false,
      overSlot: null,
      pointerId: event.pointerId,
      source,
      startX: event.clientX,
      startY: event.clientY
    };

    if (source.setPointerCapture) {
      source.setPointerCapture(event.pointerId);
    }

    source.addEventListener("pointermove", movePointerDrag);
    source.addEventListener("pointerup", finishPointerDrag);
    source.addEventListener("pointercancel", cancelPointerDrag);
  }

  function movePointerDrag(event) {
    const active = dragState.active;
    if (!active || active.pointerId !== event.pointerId) {
      return;
    }

    const distance = Math.hypot(event.clientX - active.startX, event.clientY - active.startY);
    if (!active.moved && distance < 7) {
      return;
    }

    event.preventDefault();
    active.moved = true;

    if (!active.ghost) {
      active.ghost = createDragGhost(active.colourId);
      document.body.classList.add("is-dragging-colour");
      active.source.classList.add("is-dragging");
    }

    active.ghost.style.transform = `translate(${event.clientX - 24}px, ${event.clientY - 24}px)`;
    updatePointerDropTarget(event.clientX, event.clientY);
  }

  function finishPointerDrag(event) {
    const active = dragState.active;
    if (!active || active.pointerId !== event.pointerId) {
      return;
    }

    dragState.suppressNextClick = true;

    if (active.moved && active.overSlot) {
      const slotIndex = Number(active.overSlot.dataset.slot);
      state.currentGuess[slotIndex] = active.colourId;
      state.selectedColour = active.colourId;
      cleanupPointerDrag();
      renderGame();
      return;
    }

    if (!active.moved) {
      state.selectedColour = state.selectedColour === active.colourId ? null : active.colourId;
      renderPaletteSelection();
    }

    cleanupPointerDrag();
  }

  function cancelPointerDrag(event) {
    if (!dragState.active || dragState.active.pointerId !== event.pointerId) {
      return;
    }

    cleanupPointerDrag();
  }

  function createDragGhost(colourId) {
    const colour = colourById(colourId);
    const ghost = document.createElement("span");
    ghost.className = "drag-ghost";
    ghost.style.setProperty("--peg", colour.hex);
    ghost.setAttribute("aria-hidden", "true");
    document.body.appendChild(ghost);
    return ghost;
  }

  function updatePointerDropTarget(x, y) {
    const active = dragState.active;
    const target = document.elementFromPoint(x, y);
    const slot = target ? target.closest(".guess-row.is-active .slot") : null;

    if (active.overSlot && active.overSlot !== slot) {
      active.overSlot.classList.remove("is-over");
    }

    active.overSlot = slot && !slot.disabled ? slot : null;

    if (active.overSlot) {
      active.overSlot.classList.add("is-over");
    }
  }

  function cleanupPointerDrag() {
    const active = dragState.active;
    if (!active) {
      return;
    }

    active.source.removeEventListener("pointermove", movePointerDrag);
    active.source.removeEventListener("pointerup", finishPointerDrag);
    active.source.removeEventListener("pointercancel", cancelPointerDrag);

    if (active.source.hasPointerCapture && active.source.hasPointerCapture(active.pointerId)) {
      active.source.releasePointerCapture(active.pointerId);
    }

    if (active.overSlot) {
      active.overSlot.classList.remove("is-over");
    }

    if (active.ghost) {
      active.ghost.remove();
    }

    active.source.classList.remove("is-dragging");
    document.body.classList.remove("is-dragging-colour");
    dragState.active = null;
  }

  function clearCurrentGuess() {
    state.currentGuess = Array(CODE_LENGTH).fill(null);
    renderGame();
  }

  function submitGuess() {
    if (state.solved) {
      return;
    }

    if (!isCurrentGuessComplete()) {
      return;
    }

    const guess = [...state.currentGuess];
    const marks = scoreGuess(guess, state.secret);
    state.turns.push({ guess, marks });
    state.currentGuess = Array(CODE_LENGTH).fill(null);

    if (marks.every((mark) => mark === "check")) {
      state.solved = true;
      saveBestScore(state.turns.length);
    }

    renderGame();
  }

  function isCurrentGuessComplete() {
    return state.currentGuess.every(Boolean);
  }

  function readBestScore() {
    try {
      const best = window.localStorage.getItem(STORAGE_KEY);
      return best ? best : "--";
    } catch (error) {
      return "--";
    }
  }

  function saveBestScore(turns) {
    try {
      const current = Number(window.localStorage.getItem(STORAGE_KEY));
      if (!current || turns < current) {
        window.localStorage.setItem(STORAGE_KEY, String(turns));
      }
    } catch (error) {
      // Private browsing modes can block storage; the game should still play.
    }
  }

  init();
})();
