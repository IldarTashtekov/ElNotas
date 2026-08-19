/**
 
Nota = donde tengo los apuntes y listas TODO. Las casillas TODO pueden tener casillas hijas, 
       siendo asi una entidad recursiva

Plan = Grafo de Nodos donde puedo crear esquemas de tareas de manera organizada 
    Nodo = Nodo para los esquemas de los planes
     NodoNota = Nodo que al pinchar en el entras en la Nota

Contexto = Lista de Planes y Notas 

ContextoCompuesto = Union de dos o mas Contextos para hacer planes compuestos con notas de varios contextos

ContextoGeneral = La lista de todos los planes y notas de todos los contextos

Ventanas = Las ventanas, como las del movil donde puedes cambiar de contexos, por defecto saldra el ContextoGeneral, 
la lista de todas las notas y planes del contexto, pero puedes hacer que salga un plan especifico o una nota en conreto 
como la primera vista del contexto

 */




/*
    Base type for note content elements
    @param type Parametro discriminador para castear los diferentes tipos de nota
*/
export interface Content {
    type: string
}

/*
    Checkbox element, supports nesting
*/
export interface CheckBox extends Content {
    type : "checkbox",
    text : string,
    checked : boolean,
    children: CheckBox[]
}

/*
    Text element
*/
export interface Text extends Content {
    type: "text",
    text: string
}

/*
    Note with a list of mixed content elements
*/
export interface Note {
    id: string,
    name: string,
    content : Content[]
}


/** Base type for plan graph nodes */
export interface PlanNode {
    type: string,
    id: string,
    positionX: number,
    positionY: number,
    /** IDs of parent nodes */
    parents: string[],
    /** IDs of child nodes */
    children: string[]
}

/** Basic node with a text label */
export interface SimpleNode extends PlanNode {
    type: "simple-node",
    text: string
}

/** Node linked to a note, opens it on click */
export interface NoteNode extends PlanNode {
    type: "note-node",
    /** ID of the referenced note */
    noteId: string
}

/** Plan represented as a graph of nodes */
export interface Plan {
    id: string,
    name: string,
    nodes: PlanNode[]
}


/**
 * Default view when opening a Context:
 * - "context": shows the full item list
 * - "note": opens a specific note by id
 * - "plan": opens a specific plan by id
 */
export type DefaultView =
    | { type: "context" }
    | { type: "note", id: string }
    | { type: "plan", id: string }

/** Groups a collection of notes and plans */
export interface Context {
    id: string,
    name: string,
    defaultView: DefaultView,
    /** Ordered list of notes and plans belonging to this context */
    items: (Note | Plan)[],
}


/**
 * Root state of the application.
 */
export interface AppState {
     contexts: Context[]
}



