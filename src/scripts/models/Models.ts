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
interface Content {
    type: string
}

/*
    Checkbox element, supports nesting
*/
interface CheckBox extends Content {
    type : "checkbox",
    text : string,
    checked : boolean,
    children: CheckBox[]
}

/*
    Text element
*/
interface Text extends Content {
    type: "text",
    text: string
}

/*
    Note with a list of mixed content elements
*/
interface Note {
    id: string, 
    title: string,
    content : Content[]
}