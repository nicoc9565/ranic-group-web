import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export interface Task {
  id: string;
  title: string;
  note?: string;
  important: boolean;
  dueDate?: string; // yyyy-mm-dd
  done: boolean;
  createdBy: string; // displayName del usuario autenticado
  createdAt: string; // ISO timestamp
  doneAt?: string; // ISO timestamp, se setea al marcar done=true
}

export type TaskInput = Omit<Task, "id" | "done" | "createdAt" | "doneAt">;

const COL = "tasks";

export function subscribeTasks(cb: (tasks: Task[]) => void): () => void {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Task, "id">),
      })),
    );
  });
}

export async function addTask(input: TaskInput): Promise<void> {
  // Firestore (getFirestore por defecto) rechaza `undefined`: omitimos los opcionales vacíos.
  const data: Record<string, unknown> = {
    title: input.title,
    important: input.important,
    createdBy: input.createdBy,
    done: false,
    createdAt: new Date().toISOString(),
  };
  if (input.note !== undefined) data.note = input.note;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate;
  await addDoc(collection(db, COL), data);
}

export async function updateTask(
  id: string,
  patch: Partial<Task>,
): Promise<void> {
  // Firestore rechaza `undefined`; lo traducimos a deleteField() para borrar el campo
  // (ej. al desmarcar una tarea hecha, doneAt: undefined → se elimina el campo).
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    data[key] = value === undefined ? deleteField() : value;
  }
  await updateDoc(doc(db, COL, id), data);
}

export async function deleteTask(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
