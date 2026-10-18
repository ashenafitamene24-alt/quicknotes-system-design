// QuickNotes API Client - Task 1: Load Notes (GET)

const API_URL = "https://jsonplaceholder.typicode.com/posts";

// DOM Elements
const loadBtn = document.getElementById("load-btn");
const statusEl = document.getElementById("status");
const noteForm = document.getElementById("note-form");
const titleInput = document.getElementById("title-input");
const bodyInput = document.getElementById("body-input");
const submitBtn = document.getElementById("submit-btn");
const notesList = document.getElementById("notes-list");

// Helper function to update status banner with appropriate state styling
function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = "status-msg active";
  if (type) {
    statusEl.classList.add(type); // 'loading', 'success', or 'error'
  }
}

function clearStatus() {
  statusEl.textContent = "";
  statusEl.className = "status-msg";
}

// Reusable async request wrapper
async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Server responded with HTTP status ${response.status} (${response.statusText || "Error"})`);
  }
  return response;
}

// Renders an array of notes to the #notes-list using textContent only
function renderNotes(notes) {
  notesList.innerHTML = "";

  if (!notes || notes.length === 0) {
    const emptyLi = document.createElement("li");
    emptyLi.className = "empty-state";
    emptyLi.textContent = "No notes available. Click 'Load notes' or create one above.";
    notesList.appendChild(emptyLi);
    return;
  }

  notes.forEach((note) => {
    const li = createNoteElement(note);
    notesList.appendChild(li);
  });
}

// Creates an individual note list item element
function createNoteElement(note) {
  const li = document.createElement("li");
  li.className = "note-item";
  li.dataset.id = note.id;

  const contentDiv = document.createElement("div");
  contentDiv.className = "note-content";

  const titleEl = document.createElement("h3");
  titleEl.className = "note-title";
  titleEl.textContent = note.title;

  const bodyEl = document.createElement("p");
  bodyEl.className = "note-body";
  bodyEl.textContent = note.body || "";

  contentDiv.appendChild(titleEl);
  contentDiv.appendChild(bodyEl);
  li.appendChild(contentDiv);

  return li;
}

// Task 1: Load 10 notes via GET request
async function loadNotes() {
  loadBtn.disabled = true;
  setStatus("Loading notes...", "loading");

  try {
    const response = await request(`${API_URL}?_limit=10`);
    const notes = await response.json();

    renderNotes(notes);

    if (notes.length === 0) {
      setStatus("No notes found on the server.", "success");
    } else {
      setStatus(`Loaded ${notes.length} notes from the server.`, "success");
    }
  } catch (error) {
    setStatus(`Failed to load notes: ${error.message}. Please check your connection.`, "error");
    renderNotes([]);
  } finally {
    loadBtn.disabled = false;
  }
}

// Event Listeners
loadBtn.addEventListener("click", loadNotes);
