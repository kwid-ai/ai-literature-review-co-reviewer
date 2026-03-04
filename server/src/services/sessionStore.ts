import { ReviewSession } from '../types/index.js';

type EventListener = (event: string, data: unknown) => void;

class SessionStore {
  private sessions = new Map<string, ReviewSession>();
  private listeners = new Map<string, Set<EventListener>>();

  get(id: string): ReviewSession | undefined {
    return this.sessions.get(id);
  }

  set(session: ReviewSession): void {
    this.sessions.set(session.id, session);
  }

  update(id: string, updates: Partial<ReviewSession>): ReviewSession | null {
    const session = this.sessions.get(id);
    if (!session) return null;
    const updated = { ...session, ...updates };
    this.sessions.set(id, updated);
    return updated;
  }

  addListener(id: string, listener: EventListener): void {
    if (!this.listeners.has(id)) this.listeners.set(id, new Set());
    this.listeners.get(id)!.add(listener);
  }

  removeListener(id: string, listener: EventListener): void {
    this.listeners.get(id)?.delete(listener);
  }

  emit(id: string, event: string, data: unknown): void {
    this.listeners.get(id)?.forEach(cb => {
      try { cb(event, data); } catch { /* ignore */ }
    });
  }

  delete(id: string): void {
    this.sessions.delete(id);
    this.listeners.delete(id);
  }
}

export const sessionStore = new SessionStore();
