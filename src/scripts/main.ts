import { Note } from "./models/Note";

// DOM references
const addNoteBtn: HTMLButtonElement = document.getElementById("add-note-btn") as HTMLButtonElement;
const notesList: HTMLUListElement = document.getElementById("notes-list") as HTMLUListElement;
const noteDisplay: HTMLDivElement = document.getElementById("note-display")! as HTMLDivElement;
const noteTitleEl: HTMLHeadingElement = document.getElementById("note-title") as HTMLHeadingElement;
const noteContentEl: HTMLParagraphElement = document.getElementById("note-content") as HTMLParagraphElement;
  
// Array of Notes
const notes: Note[] = [];


// New note Button
addNoteBtn.addEventListener("click", () => {
  const title = prompt("Título de la nota:");
  if (!title || title.trim() === "") return;

  const content = prompt("Contenido de la nota:");
  if (!content || content.trim() === "") return;

  const newNote: Note = { title: title.trim(), content: content.trim() };
  notes.push(newNote);
  renderNotes();
});

// Render the notes List
function renderNotes() {
  notesList.innerHTML = "";
  notes.forEach((note, index) => {
    const li: HTMLLIElement = document.createElement("li");
    li.textContent = note.title;
    li.style.cursor = "pointer";

    // Cuando se hace click, mostrar la nota completa
    li.addEventListener("click", () => {
      noteTitleEl.textContent = note.title;
      noteContentEl.textContent = note.content;
      noteDisplay.style.display = "block";
    });

    notesList.appendChild(li);
  });
}