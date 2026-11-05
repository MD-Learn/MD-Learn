// Which note is active, and the note being written (not saved yet).
import { create } from 'zustand'
import type { NoteAnchor } from '../../shared/types'

export interface DraftNote { anchor: NoteAnchor; mode: 'note' | 'ask' | 'visual' | 'card' }
/** `edit`: a note whose text should open for writing (from the menu on a highlight). */
interface NotesUi { active: string | null; draft: DraftNote | null; edit: string | null; setActive(id: string | null): void; setDraft(d: DraftNote | null): void; setEdit(id: string | null): void }
export const useNotesUi = create<NotesUi>((set) => ({
  active: null, draft: null, edit: null,
  setActive: (active) => set({ active }),
  setEdit: (edit) => set(edit ? { edit, active: edit } : { edit }),
  setDraft: (draft) => set({ draft, active: draft ? 'draft' : null }),
}))
