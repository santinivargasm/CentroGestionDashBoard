import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';

const BASE_URL = 'https://hubai.azurewebsites.net';

type ColaboradorPayload = {
  nombre: string;
  celular?: string | null;
  correo_electronico: string;
  vicepresidencia?: string | null;
  gerencia?: string | null;
  direccion_area?: string | null; // default 'Activo' en DB si viene null
  nombre_jefe_inmediato?: string | null;
  correo_jefe_inmediato?: string | null;
  nombre_jefe_inmediato_2?: string | null;
  correo_jefe_inmediato_2?: string | null;
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

  // ---------- Listas (tal cual las enviaste) ----------
  VICEPRESIDENCIAS: string[] = [
    'Cumplimiento',
    'Desarrollo de Soluciones',
    'Finanzas y Servicios Corporativos',
    'Negocio',
    'Open Business',
    'Presidencia',
    'Secretaría General',
    'Tecnología',
  ];

  GERENCIAS: string[] = [
    'Abastecimiento Estratégico',
    'Administrativa',
    'Arquitectura Empresarial',
    'Auditoría Interna',
    'Comercial',
    'Corporativo- Transporte',
    'Corporativo-Retail',
    'Corporativo-Servicios',
    'Cumplimiento',
    'Data Science',
    'Desarrollo de Soluciones',
    'Desarrollo y Expansión de Nuevos Negocios',
    'Empresarial',
    'Entidades financieras',
    'Gobierno en Tecnología',
    'Ingeniería de Software',
    'Mercadeo y Experiencia',
    'Open Business',
    'Open Finance y Data',
    'Pagos Inmediatos',
    'Planeación y Finanzas',
    'PMO',
    'Producto',
    'Procesamiento',
    'Producto Procesamiento Transaccional',
    'Productos de Desarrollo de Acceso',
    "Psp's Adquirentes",
    'Riesgos y Continuidad del Negocio',
    'Secretaría General',
    'Seguridad de la información',
    'Talento humano',
    'Transformación Digital',
  ];

  DIRECCIONES: string[] = [
    'Abastecimiento Estratégico',
    'Administrativa',
    'Aplicaciones Web',
    'Arquitectura Empresarial',
    'Auditoría Interna',
    'Bienestar y Salud Ocupacional',
    'Corporativo- Transporte',
    'Corporativo-Retail',
    'Corporativo-Servicios',
    'Data Science',
    'Desarrollo de Mercados',
    'Desarrollo Organizacional',
    'Desarrollo y Expansión de Nuevos Negocios',
    'Empresarial',
    'Empresarial 2',
    'Entidades financieras',
    'Finanzas',
    'Gobierno en Tecnología',
    'Mercadeo y Experiencia',
    'Open Business',
    'Open Finance y Data',
    'Pagos Inmediatos',
    'PMO Agile',
    'Procesos',
    'Producto de Procesamiento',
    "PSP's Adquirentes",
    'Producto Procesamiento 4',
    'Productos de Acceso Digital',
    'Productos de Desarrollo de Acceso',
    "Psp's Adquirentes",
    'Regional Centro',
    'Riesgos y Continuidad del Negocio',
    'Sarlaft',
    'Secretaría General 3',
    'Seguridad de la información',
    'Talento Humano',
    'Tesorería',
    'Transformación Digital',
    'Valoración y Selección',
  ];

  NOMBRES_JEFES: string[] = [
    'Alison Cortés Fonseca',
    'Andrea Milena Ticora Alturo',
    'Camilo Andrés Ocampo Restrepo',
    'César Armando Tenjo Urquijo',
    'Claudia Patricia Camacho Sánchez',
    'Claudia Patricia Jaimes Capacho',
    'Cristhian Yovany Almonacid Rojas',
    'Daniel Andrés Pulido Mora',
    'David Alejandro Triviño Rodríguez',
    'Derly Ceferino Jiménez',
    'Derly Yized Guayacundo Duarte',
    'Diego Andrés Esteban García',
    'Esteban Tequia Díaz',
    'Estefany Flórez Carreño',
    'Genny Carolina Monroy Peña',
    'Helmuth Silva Quintero',
    'Iván Danilo León Aldana',
    'Jeferson Smith Villalba Sierra',
    'Jeimy Viviana Preciado Orjuela',
    'Jennifer Tatiana León Peña',
    'Jenny Carolina Pabón Márquez',
    'Johana Leal Ussa',
    'Johanna Del Pilar Vallejo Junca',
    'Jorge Andrés Gómez Munar',
    'Juan Carlos Sandoval Garzón',
    'Juana Mariño Villegas',
    'Julie Andrea Martínez Blanco',
    'Leidy Carolina Fagua Galvis',
    'Leidy Jhoana Fernández Carranza',
    'Luz Stella Castillo Chaparro',
    'Margarita María Córdoba Jaimes',
    'Martha Liliana Rueda Beltrán',
    'Nadia Stefanny Vega Guerrero',
    'Nicolás Casallas López',
    'Rubén Darío Atara Piraquive',
    'Sandy Lorena Puentes Ruiz',
    'Verónica Nathalia González Velasco',
    'Walter Smith Casallas Osorio',
    'Yaqueline Astrid Díaz Rúa',
    'Yenny Raquel Sotelo Cortés',
    'Yeny Paola Giraldo Puentes',
  ];

  CORREOS_JEFES: string[] = [
    'alison.cortesf@credibanco.com',
    'andrea.ticora@credibanco.com',
    'camilo.ocampo@credibanco.com',
    'carolina.pabon@credibanco.com',
    'cesar.tenjo@credibanco.com',
    'claudia.camacho@credibanco.com',
    'claudia.jaimes@credibanco.com',
    'cristian.almonacid@credibanco.com',
    'daniel.pulido@credibanco.com',
    'david.trivino@credibanco.com',
    'derly.ceferino@credibanco.com',
    'derly.guayacundo@credibanco.com',
    'diego.esteban@credibanco.com',
    'esteban.tequia@credibanco.com',
    'estefany.florez@credibanco.com',
    'genny.monroy@credibanco.com',
    'helmuth.silva@credibanco.com',
    'ivan.leon@credibanco.com',
    'jeferson.villalba@credibanco.com',
    'jeimy.preciado@credibanco.com',
    'jenny.giraldo@credibanco.com',
    'johana.leal@credibanco.com',
    'johanna.vallejo@credibanco.com',
    'jorge.gomez@credibanco.com',
    'juan.sandoval@credibanco.com',
    'juana.marino@credibanco.com',
    'julie.martinez@credibanco.com',
    'leidy.fagua@credibanco.com',
    'leidy.fernandez@credibanco.com',
    'Luz.castillo@credibanco.com',
    'martha.rueda@credibanco.com',
    'nadia.vega@credibanco.com',
    'nicolas.casallas@credibanco.com',
    'ruben.atara@credibanco.com',
    'sandy.puentes@credibanco.com',
    'tatiana.leon@credibanco.com',
    'veronica.gonzalez@credibanco.com',
    'walter.casallas@credibanco.com',
    'yaqueline.diaz@credibanco.com',
    'yenny.sotelo@credibanco.com',
  ];

  // La lista 2 trae un pequeño cambio en cesar.tenjo (igual a la tuya)
  CORREOS_JEFES_2: string[] = [
    'alison.cortesf@credibanco.com',
    'andrea.ticora@credibanco.com',
    'camilo.ocampo@credibanco.com',
    'carolina.pabon@credibanco.com',
    'cesar.tenjo@credibanco.com',
    'claudia.camacho@credibanco.com',
    'claudia.jaimes@credibanco.com',
    'cristian.almonacid@credibanco.com',
    'daniel.pulido@credibanco.com',
    'david.trivino@credibanco.com',
    'derly.ceferino@credibanco.com',
    'derly.guayacundo@credibanco.com',
    'diego.esteban@credibanco.com',
    'esteban.tequia@credibanco.com',
    'estefany.florez@credibanco.com',
    'genny.monroy@credibanco.com',
    'helmuth.silva@credibanco.com',
    'ivan.leon@credibanco.com',
    'jeferson.villalba@credibanco.com',
    'jeimy.preciado@credibanco.com',
    'jenny.giraldo@credibanco.com',
    'johana.leal@credibanco.com',
    'johanna.vallejo@credibanco.com',
    'jorge.gomez@credibanco.com',
    'juan.sandoval@credibanco.com',
    'juana.marino@credibanco.com',
    'julie.martinez@credibanco.com',
    'leidy.fagua@credibanco.com',
    'leidy.fernandez@credibanco.com',
    'Luz.castillo@credibanco.com',
    'martha.rueda@credibanco.com',
    'nadia.vega@credibanco.com',
    'nicolas.casallas@credibanco.com',
    'ruben.atara@credibanco.com',
    'sandy.puentes@credibanco.com',
    'tatiana.leon@credibanco.com',
    'veronica.gonzalez@credibanco.com',
    'walter.casallas@credibanco.com',
    'yaqueline.diaz@credibanco.com',
    'yenny.sotelo@credibanco.com',
  ];

  // ---------- Modelo (solo columnas de la tabla colaborador) ----------
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

  private trimOrNull(v: string | null | undefined): string | null {
    if (v == null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  }

  submit() {
    this.message = null;

    if (!this.model.nombre.trim() || !this.model.correo_electronico.trim()) {
      this.message = { type: 'error', text: 'Nombre y Correo electrónico son obligatorios.' };
      return;
    }

    // Armamos payload limpio
    const payload: ColaboradorPayload = {
      nombre: this.model.nombre.trim(),
      celular: this.trimOrNull(this.model.celular || null),
      correo_electronico: this.model.correo_electronico.trim(),
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
