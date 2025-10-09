import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const STORAGE_KEY_EMAIL = 'cg_user_email';

@Injectable({ providedIn: 'root' })
export class EmailSessionService {
  private email$ = new BehaviorSubject<string | null>(null);

  constructor() {
    try {
      const saved = (localStorage.getItem(STORAGE_KEY_EMAIL) || '').trim();
      if (saved) this.email$.next(saved);
    } catch {
      /* ignore */
    }
  }

  setEmail(correo: string | null) {
    const v = (correo || '').trim() || null;
    this.email$.next(v);
    try {
      if (v) {
        localStorage.setItem(STORAGE_KEY_EMAIL, v);
      } else {
        localStorage.removeItem(STORAGE_KEY_EMAIL);
      }
    } catch {
      /* ignore */
    }
  }

  getEmail(): string | null {
    return this.email$.value;
  }

  emailChanges() {
    return this.email$.asObservable();
  }
}