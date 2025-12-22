// src/app/core/email-session.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';

const STORAGE_KEY_EMAIL   = 'cg_user_email';
const STORAGE_KEY_USERID  = 'cg_user_id';
const STORAGE_KEY_NOMBRE  = 'cg_user_nombre';
const STORAGE_KEY_ROLE    = 'cg_user_rol';

// ⚠️ Ajusta si cambias de dominio:
const API = 'https://hubai.azurewebsites.net';

@Injectable({ providedIn: 'root' })
export class EmailSessionService {
  private email$  = new BehaviorSubject<string | null>(null);
  private userId$ = new BehaviorSubject<string | null>(null);
  private nombre$ = new BehaviorSubject<string | null>(null);
  private role$   = new BehaviorSubject<string | null>(null);

  constructor(private http: HttpClient) {
    try {
      const savedEmail  = (localStorage.getItem(STORAGE_KEY_EMAIL)  || '').trim();
      const savedUserId = (localStorage.getItem(STORAGE_KEY_USERID) || '').trim();
      const savedNombre = (localStorage.getItem(STORAGE_KEY_NOMBRE) || '').trim();
      const savedRole   = (localStorage.getItem(STORAGE_KEY_ROLE)   || '').trim();

      if (savedEmail)  this.email$.next(savedEmail);
      if (savedUserId) this.userId$.next(savedUserId);
      if (savedNombre) this.nombre$.next(savedNombre);
      if (savedRole)   this.role$.next(savedRole);
    } catch { /* ignore */ }
  }

  // ========== EMAIL ==========
  setEmail(correo: string | null) {
    const v = (correo || '').trim() || null;
    this.email$.next(v);
    try {
      if (v) localStorage.setItem(STORAGE_KEY_EMAIL, v);
      else   localStorage.removeItem(STORAGE_KEY_EMAIL);
    } catch { /* ignore */ }
  }
  getEmail(): string | null { return this.email$.value; }
  emailChanges() { return this.email$.asObservable(); }

  // ========== USER ID ==========
  setUserId(id: string | null) {
    const v = (id || '').trim() || null;
    this.userId$.next(v);
    try {
      if (v) localStorage.setItem(STORAGE_KEY_USERID, v);
      else   localStorage.removeItem(STORAGE_KEY_USERID);
    } catch { /* ignore */ }
  }
  getUserId(): string | null { return this.userId$.value; }
  userIdChanges() { return this.userId$.asObservable(); }

  // ========== NOMBRE ==========
  setNombre(nombre: string | null) {
    const v = (nombre || '').trim() || null;
    this.nombre$.next(v);
    try {
      if (v) localStorage.setItem(STORAGE_KEY_NOMBRE, v);
      else   localStorage.removeItem(STORAGE_KEY_NOMBRE);
    } catch { /* ignore */ }
  }
  getNombre(): string | null { return this.nombre$.value; }
  nombreChanges() { return this.nombre$.asObservable(); }

  // ========== ROL ==========
  setRole(role: string | null) {
    const v = (role || '').trim() || null;
    this.role$.next(v);
    try {
      if (v) localStorage.setItem(STORAGE_KEY_ROLE, v);
      else   localStorage.removeItem(STORAGE_KEY_ROLE);
    } catch { /* ignore */ }
  }
  getRole(): string | null { return this.role$.value; }
  roleChanges() { return this.role$.asObservable(); }

  // ========== Snapshot / Clear ==========
  getSnapshot() {
    return {
      email:  this.getEmail(),
      userId: this.getUserId(),
      nombre: this.getNombre(),
      rol:    this.getRole(),
    };
  }

  clear() {
    this.email$.next(null);
    this.userId$.next(null);
    this.nombre$.next(null);
    this.role$.next(null);
    try {
      localStorage.removeItem(STORAGE_KEY_EMAIL);
      localStorage.removeItem(STORAGE_KEY_USERID);
      localStorage.removeItem(STORAGE_KEY_NOMBRE);
      localStorage.removeItem(STORAGE_KEY_ROLE);
    } catch { /* ignore */ }
  }

}
