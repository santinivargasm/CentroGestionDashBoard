import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';

const BASE_URL = 'http://127.0.0.1:5000/api';

type ColaboradorPayload = {
  id_empleado: number | null;
  nombre: string;
  apellido: string;
  fecha_nacimiento?: string | null;
  correo_electronico: string;
  puesto?: string | null;
  departamento?: string | null;
  estado_chapter?: string | null;
  automatizacion?: string | null;
  analitica_avanzada?: string | null;
  gerencia?: string | null;
  vicepresidencia?: string | null;
  jefe_directo?: string | null;
};

@Component({
  selector: 'app-formularios',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './formularios.html',
  styleUrls: ['./formularios.css'],
})
export class FormulariosComponent {
  private http = inject(HttpClient);

  model: ColaboradorPayload = {
    id_empleado: null,
    nombre: '',
    apellido: '',
    fecha_nacimiento: null,
    correo_electronico: '',
    puesto: '',
    departamento: '',
    estado_chapter: 'Activo',
    automatizacion: '',
    analitica_avanzada: '',
    gerencia: '',
    vicepresidencia: '',
    jefe_directo: ''
  };

  isSaving = false;
  message: { type: 'ok'|'error', text: string } | null = null;

  private trimOrNull(v: string | null | undefined): string | null {
    if (v == null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  }
  private toIntOrNull(v: any): number | null {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  submit() {
    this.message = null;

    if (!this.model.nombre.trim() || !this.model.apellido.trim() || !this.model.correo_electronico.trim()) {
      this.message = { type: 'error', text: 'Nombre, Apellido y Correo electrónico son obligatorios.' };
      return;
    }

    const payload: ColaboradorPayload = {
      id_empleado: this.toIntOrNull(this.model.id_empleado),
      nombre: this.model.nombre.trim(),
      apellido: this.model.apellido.trim(),
      fecha_nacimiento: this.trimOrNull(this.model.fecha_nacimiento || null),
      correo_electronico: this.model.correo_electronico.trim(),
      puesto: this.trimOrNull(this.model.puesto || null),
      departamento: this.trimOrNull(this.model.departamento || null),
      estado_chapter: this.trimOrNull(this.model.estado_chapter || null),
      automatizacion: this.trimOrNull(this.model.automatizacion || null),
      analitica_avanzada: this.trimOrNull(this.model.analitica_avanzada || null),
      gerencia: this.trimOrNull(this.model.gerencia || null),
      vicepresidencia: this.trimOrNull(this.model.vicepresidencia || null),
      jefe_directo: this.trimOrNull(this.model.jefe_directo || null),
    };

    this.isSaving = true;
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    this.http.post<{ok:boolean, id_empleado?: number, error?: string}>(`${BASE_URL}/colaboradores`, payload, { headers })
      .subscribe({
        next: (res) => {
          this.isSaving = false;
          if (res?.ok) {
            this.message = { type: 'ok', text: 'Colaborador creado correctamente.' };
            this.resetForm();
          } else {
            this.message = { type: 'error', text: res?.error || 'No se pudo crear el colaborador.' };
          }
        },
        error: (err) => {
          this.isSaving = false;
          const msg = err?.error?.error || 'Error inesperado al crear el colaborador.';
          this.message = { type: 'error', text: msg };
        }
      });
  }

  resetForm() {
    this.model = {
      id_empleado: null,
      nombre: '',
      apellido: '',
      fecha_nacimiento: null,
      correo_electronico: '',
      puesto: '',
      departamento: '',
      estado_chapter: 'Activo',
      automatizacion: '',
      analitica_avanzada: '',
      gerencia: '',
      vicepresidencia: '',
      jefe_directo: ''
    };
  }
}
