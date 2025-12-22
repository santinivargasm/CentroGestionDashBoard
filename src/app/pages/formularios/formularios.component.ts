import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';

const BASE_URL = 'https://hubai.azurewebsites.net';

type ColaboradorPayload = {
  nombre: string;
  celular?: string | null;
  correo_electronico: string;
  vicepresidencia?: string | null;
  gerencia?: string | null;
  direccion_area?: string | null;
  nombre_jefe_inmediato?: string | null;
  correo_jefe_inmediato?: string | null;
  nombre_jefe_inmediato_2?: string | null;
  correo_jefe_inmediato_2?: string | null;
};

type JefeDTO = {
  nombre: string;
  correo: string;
};

@Component({
  selector: 'app-formularios',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './formularios.html',
  styleUrls: ['./formularios.css'],
})
export class FormulariosComponent implements OnInit {
  private http = inject(HttpClient);

  // ---------- Listas dinámicas ----------
  VICEPRESIDENCIAS: string[] = [];
  GERENCIAS: string[] = [];
  DIRECCIONES: string[] = [];
  JEFES: JefeDTO[] = [];

  // ---------- Modelo ----------
  model: ColaboradorPayload = {
    nombre: '',
    celular: '',
    correo_electronico: '',
    vicepresidencia: null,
    gerencia: null,
    direccion_area: 'Activo',
    nombre_jefe_inmediato: null,
    correo_jefe_inmediato: null,
    nombre_jefe_inmediato_2: null,
    correo_jefe_inmediato_2: null,
  };

  isSaving = false;
  message: { type: 'ok' | 'error'; text: string } | null = null;

  // =========================
  // Ciclo de vida
  // =========================
  ngOnInit(): void {
    this.cargarCatalogos();
  }

  private cargarCatalogos(): void {
    // Vicepresidencias
    this.http
      .get<string[]>(`${BASE_URL}/api/catalogos_colaborador/vicepresidencia`)
      .subscribe({
        next: (data) => (this.VICEPRESIDENCIAS = data || []),
        error: () => (this.VICEPRESIDENCIAS = []),
      });

    // Gerencias
    this.http
      .get<string[]>(`${BASE_URL}/api/catalogos_colaborador/gerencia`)
      .subscribe({
        next: (data) => (this.GERENCIAS = data || []),
        error: () => (this.GERENCIAS = []),
      });

    // Direcciones / Áreas
    this.http
      .get<string[]>(`${BASE_URL}/api/catalogos_colaborador/direccion_area`)
      .subscribe({
        next: (data) => (this.DIRECCIONES = data || []),
        error: () => (this.DIRECCIONES = []),
      });

    // Jefes (nombre + correo)
    this.http.get<JefeDTO[]>(`${BASE_URL}/api/jefes`).subscribe({
      next: (data) => (this.JEFES = data || []),
      error: () => (this.JEFES = []),
    });
  }

  // =========================
  // Utils
  // =========================
  private trimOrNull(v: string | null | undefined): string | null {
    if (v == null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  }

  // Cuando el usuario selecciona / escribe un nombre de jefe,
  // intentamos completar el correo automáticamente.
  onChangeNombreJefe1(): void {
    const nombre = (this.model.nombre_jefe_inmediato || '').trim();
    const jefe = this.JEFES.find((j) => j.nombre === nombre);
    if (jefe) {
      this.model.correo_jefe_inmediato = jefe.correo;
    }
  }

  onChangeCorreoJefe1(): void {
    const correo = (this.model.correo_jefe_inmediato || '').trim().toLowerCase();
    const jefe = this.JEFES.find((j) => j.correo.toLowerCase() === correo);
    if (jefe) {
      this.model.nombre_jefe_inmediato = jefe.nombre;
    }
  }

  onChangeNombreJefe2(): void {
    const nombre = (this.model.nombre_jefe_inmediato_2 || '').trim();
    const jefe = this.JEFES.find((j) => j.nombre === nombre);
    if (jefe) {
      this.model.correo_jefe_inmediato_2 = jefe.correo;
    }
  }

  onChangeCorreoJefe2(): void {
    const correo = (this.model.correo_jefe_inmediato_2 || '').trim().toLowerCase();
    const jefe = this.JEFES.find((j) => j.correo.toLowerCase() === correo);
    if (jefe) {
      this.model.nombre_jefe_inmediato_2 = jefe.nombre;
    }
  }

  // =========================
  // Submit
  // =========================
  submit() {
    this.message = null;

    // Validación de campos obligatorios
    if (!this.model.nombre.trim() || !this.model.correo_electronico.trim()) {
      this.message = { type: 'error', text: 'Nombre y Correo electrónico son obligatorios.' };
      return;
    }

    // Validación de correo electrónico (dominio @credibanco.com)
    const correoValido = this.model.correo_electronico.trim().toLowerCase();
    const dominioPermitido = '@credibanco.com';

    if (!correoValido.endsWith(dominioPermitido)) {
      this.message = { type: 'error', text: 'El correo electrónico debe ser del dominio @credibanco.com.' };
      return;
    }

    const payload: ColaboradorPayload = {
      nombre: this.model.nombre.trim(),
      celular: this.trimOrNull(this.model.celular || null),
      correo_electronico: correoValido,
      vicepresidencia: this.trimOrNull(this.model.vicepresidencia || null),
      gerencia: this.trimOrNull(this.model.gerencia || null),
      direccion_area: this.trimOrNull(this.model.direccion_area || 'Activo') || 'Activo',
      nombre_jefe_inmediato: this.trimOrNull(this.model.nombre_jefe_inmediato || null),
      correo_jefe_inmediato: this.trimOrNull(this.model.correo_jefe_inmediato || null),
      nombre_jefe_inmediato_2: this.trimOrNull(this.model.nombre_jefe_inmediato_2 || null),
      correo_jefe_inmediato_2: this.trimOrNull(this.model.correo_jefe_inmediato_2 || null),
    };

    this.isSaving = true;
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    this.http
      .post<{ ok: boolean; error?: string }>(`${BASE_URL}/api/colaborador`, payload, { headers })
      .subscribe({
        next: (res) => {
          this.isSaving = false;
          if (res?.ok) {
            this.message = { type: 'ok', text: 'Colaborador creado correctamente.' };
            this.resetForm();
            // Recarga catálogos por si se añadió algo nuevo
            this.cargarCatalogos();
          } else {
            this.message = { type: 'error', text: res?.error || 'No se pudo crear el colaborador.' };
          }
        },
        error: (err) => {
          this.isSaving = false;
          const msg = err?.error?.error || 'Error inesperado al crear el colaborador.';
          this.message = { type: 'error', text: msg };
        },
      });
  }

  resetForm() {
    this.model = {
      nombre: '',
      celular: '',
      correo_electronico: '',
      vicepresidencia: null,
      gerencia: null,
      direccion_area: 'Activo',
      nombre_jefe_inmediato: null,
      correo_jefe_inmediato: null,
      nombre_jefe_inmediato_2: null,
      correo_jefe_inmediato_2: null,
    };
  }
}
