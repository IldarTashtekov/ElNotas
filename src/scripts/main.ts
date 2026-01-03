// DOM references
const addNoteBtn: HTMLButtonElement = document.getElementById("add-note-btn") as HTMLButtonElement;
const notesList: HTMLUListElement = document.getElementById("notes-list") as HTMLUListElement;

  
addNoteBtn.addEventListener("click",() =>{

  // Ask new name to the user
  const noteText : string | null = prompt("Escribe tu nota:");

  // If the user write the new element name
  if(noteText && noteText.trim() != ""){

    const li: HTMLLIElement = document.createElement("li");
    li.textContent = noteText

    // Add element to the list
    notesList.appendChild(li);
  }
})