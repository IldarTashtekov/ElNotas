import { Context, Note, DefaultView, } from "./models/Models";

// DOM references
const contextName: HTMLHeadingElement = document.getElementById("context-name") as HTMLHeadingElement
const addNoteBtn: HTMLButtonElement = document.getElementById("add-note-btn") as HTMLButtonElement;
const deleteNoteBtn: HTMLButtonElement = document.getElementById("delete-note-btn") as HTMLButtonElement
const notesList: HTMLUListElement = document.getElementById("notes-list") as HTMLUListElement;

// DOM Note
const noteDisplay: HTMLDivElement = document.getElementById("note-display")! as HTMLDivElement;
const noteTitleEl: HTMLHeadingElement = document.getElementById("note-title") as HTMLHeadingElement;
const noteCheckboxBtn: HTMLButtonElement = document.getElementById("add-checkbox-btn") as HTMLButtonElement;
const noteReturnBtn: HTMLButtonElement = document.getElementById("note-return-btn") as HTMLButtonElement;


// IMPORTANTE, en los array que sean let en vez de usar mutaciones del array como push, splice...
// usaremos transformaciones que crean arrays nuevos como filter, map , etc...

// Array of Notes
let notes: Note[] = [];

let defaultView: DefaultView = { type: "context" }

let context: Context = { id: crypto.randomUUID(), name: "Contexto prueba", defaultView, items: notes }

// Context name
contextName.textContent = context.name


// Borrado de nota
let selectedNotesId: string[] = [];

// New note Button
addNoteBtn.addEventListener("click", () => {
  const title = prompt("Título de la nota:");
  if (!title || title.trim() === "") return;


  const newNote: Note = { id: crypto.randomUUID(), name: title.trim(), content: [] };
  notes = [...notes, newNote];
  renderNotes();
});

deleteNoteBtn.addEventListener("click", () => {
  // Creamos un nuevo array de notas excluyendo las seleccionadas
  notes = notes.filter(n => !selectedNotesId.includes(n.id));
  // re-render
  renderNotes();
});

// Render the notes List
function renderNotes() {
  notesList.innerHTML = "";
  notes.forEach((note: Note) => {

    const li = document.createElement("li");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const span = document.createElement("span");
    span.textContent = note.name;
    li.appendChild(checkbox);
    li.appendChild(span);

    li.style.cursor = "pointer";

    // Aplicar estilo a los elementos si están seleccionados
    if (selectedNotesId.includes(note.id)) {
      li.classList.add("selected");
    }

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedNotesId = [...selectedNotesId, note.id];
      } else {
        selectedNotesId = selectedNotesId.filter(id => id !== note.id);
      }
    });

    // Cuando se hace click, mostrar la nota completa
    span.addEventListener("click", () => {
      hideContextDisplay();
      showNoteDisplay(note);
    });


    notesList.appendChild(li);
  });
}


// Retrun to context
noteReturnBtn.addEventListener("click", () => {

  hideNoteDisplay()
  showContextDisplay()
});

function showNoteDisplay(note: Note) {

  noteDisplay.style.display = "block";
  noteTitleEl.textContent = note.name;

}

function hideNoteDisplay() {

  noteDisplay.style.display = "none";
}

function showContextDisplay() {

  // Mostrar vista contexto
  notesList.style.display = "block";
  addNoteBtn.style.display = "block";
  deleteNoteBtn.style.display = "block";
}

function hideContextDisplay() {

  // Ocultar vista contexto
  notesList.style.display = "none";
  addNoteBtn.style.display = "none";
  deleteNoteBtn.style.display = "none";
}
