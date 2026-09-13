/**
 * El adaptador de memoria, contra el contrato.
 *
 * Este fichero es corto a propósito: **no hay ni una prueba escrita para este
 * adaptador en concreto**. Todo lo que se le exige es lo que se le exige a
 * cualquier backend, y eso vive en un solo sitio. El de la Fase 3 tendrá un
 * fichero igual de corto.
 *
 * Si algún día hace falta probar algo que sólo vale para memoria, es la señal de
 * que se está apoyando en un detalle que los demás adaptadores no cumplen.
 */

import { runStorageContract } from "../contract-tests/storageContract"
import { createMemoryStorageAdapter } from "#storage/memory/MemoryStorageAdapter"

runStorageContract("MemoryStorageAdapter", createMemoryStorageAdapter)
