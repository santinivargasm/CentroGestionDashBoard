import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { EmailSessionService } from '../../core/email-session.service';

type Iniciativa = {
  id_iniciativa: number;
  nombre_iniciativa: string;
  descripcion_iniciativa: string;
  estado_iniciativa: string;
  aprobacion?: string | null;
  avance: number;
  correo_electronico: string;
  tipo_actividad: string;
  periodicidad: string;
  carga_minutos: number;
  herramientas?: string | null;
};

type Subordinado = { nombre: string; correo_electronico: string };

type OpcionVer = { label: string; value: string };

type OpcionCorreo = { correo: string; etiqueta: string; rol: string };

type NuevaIniciativa = {
  nombre_iniciativa: string;
  descripcion_iniciativa: string;
  correo_electronico: string;
  tipo_actividad: string;
  periodicidad: string;
  carga_minutos: number | null;
  herramientas?: string | null;
};

type ColaboradorInfo = {
  correo_electronico: string;
  correo_jefe_inmediato?: string | null;
  correo_jefe_inmediato_2?: string | null;
};

// ADD: tipo mínimo para leer estados de historias
type HistoriaMin = { estado?: string | null };

@Component({
  selector: 'app-actividades',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './actividades.html'
})
export class ActividadesComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private session = inject(EmailSessionService);
  private subs: Subscription[] = [];
  private API = 'https://hubai.azurewebsites.net';

  // ✅ ADMIN (usa el mismo correo que en Flask: ADMIN_EMAIL)
  private ADMIN_EMAIL = 'admin@hubai.com';
  private isAdmin(): boolean {
    return (this.session.getEmail() || '').trim().toLowerCase() === this.ADMIN_EMAIL.toLowerCase();
  }

  // ======== Estado base ========
  emailActual: string = '';
  iniciativas: Iniciativa[] = [];

  // Ver: (Yo / Subordinados)
  opcionesVer: OpcionVer[] = [];
  verComo: string = '';

  // ======== Modal edición ========
  mostrarModalEdicion = false;
  editModel: Iniciativa | null = null;
  guardando = false;
  errorGuardar = '';
  puedeAprobarActual = false;

  // ======== Modal nueva iniciativa ========
  mostrarModalNueva = false;
  nuevaModel: NuevaIniciativa | null = null;
  creando = false;
  errorCrear = '';

  // ======== Selector de correo ========
  mostrarSelectorCorreo = false;
  correoSeleccionado = '';
  opcionesCorreo: OpcionCorreo[] = [];

  // ---- Control anti-race para el combo "Ver:"
  private verReqId = 0;

  // =========================================
  // AÑADIDOS: catálogos para selects (Edit/Nueva)
  // =========================================
  tipoActividadOpts: string[] = [
    '', 'Power BI', 'IA', 'Machine Learning', 'Python', 'Query', 'Dash', 'DPA',
    'Procesamiento Data', 'Workflow', 'Reunión', 'PPT',
    // Extras para detectar oportunidades de automatización
    'ETL/ELT', 'Data Cleaning', 'Scraping', 'Validación de Datos',
    'Carga de Reportes', 'Documentación', 'Soporte/Incidentes',
    'Integración de Sistemas', 'Testing', 'Automatización RPA'
  ];

  periodicidadOpts: string[] = [
    '', 'DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'A PEDIDO'
  ];

  herramientasOpts: string[] = [
    '', 'Power BI', 'Cloudera', 'Python', 'Excel', 'Postman', 'Outlook', 'Teams',
    'Copilot', 'Word', 'PowerPoint', 'SharePoint', 'Power Platform', 'Azure', 'SAP',
    // Data/BI/Analytics
    'Tableau', 'Qlik', 'Looker', 'Databricks', 'Snowflake', 'BigQuery', 'Redshift',
    'MySQL', 'PostgreSQL', 'SQL Server', 'Oracle', 'Teradata',
    // Ingeniería/Orquestación
    'Airflow', 'dbt', 'Fivetran', 'Kafka',
    // Dev/DevOps
    'GitHub', 'GitLab', 'Bitbucket', 'Jenkins', 'Azure DevOps', 'Docker', 'Kubernetes', 'Terraform',
    // RPA/Automation/Testing
    'UiPath', 'Automation Anywhere', 'Power Automate', 'Selenium',
    // Colaboración/Docs
    'Confluence', 'Jira', 'ServiceNow', 'Notion', 'Slack', 'Zoom',
    // M365
    'OneDrive', 'Power Apps'
  ];

  ngOnInit(): void {
    this.subs.push(
      this.session.emailChanges().subscribe(c => {
        this.emailActual = c || '';
        this.prepararOpcionesVer();             // <-- una sola función se encarga y deduplica
        this.cargarIniciativas(this.verComo || this.emailActual);
      })
    );

    // Primer render si ya hay sesión
    this.emailActual = this.session.getEmail() || '';
    this.prepararOpcionesVer();
    if (this.verComo) this.cargarIniciativas(this.verComo);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // ======== Helpers ========
  trackIni = (_: number, it: Iniciativa) => it?.id_iniciativa;

  isAprobada(it: Iniciativa): boolean {
    const a = (it?.aprobacion || '').trim().toLowerCase();
    return a === 'aprobado' || a === 'aprobada';
  }

  // ======== Select "Ver:" (con deduplicación y anti-race) ========
  private prepararOpcionesVer(): void {
    if (!this.emailActual) {
      this.abrirSelectorCorreo();
      return;
    }

    const yo: OpcionVer = { label: `Yo • ${this.emailActual}`, value: this.emailActual };

    // id de solicitud para ignorar respuestas viejas
    const myReq = ++this.verReqId;

    this.opcionesVer = [yo]; // arranca con "Yo" únicamente

    this.http
      .get<Subordinado[]>(`${this.API}/api/subordinados_de/${encodeURIComponent(this.emailActual)}`)
      .subscribe({
        next: (rows) => {
          // Si llegó una respuesta de una solicitud anterior, ignórala
          if (myReq !== this.verReqId) return;

          const seen = new Set<string>();
          const list: OpcionVer[] = [yo]; // "Yo" siempre primero

          (rows || []).forEach(s => {
            const correo = (s.correo_electronico || '').trim();
            const key = correo.toLowerCase();
            if (!correo || seen.has(key)) return; // dedup por correo
            seen.add(key);
            const label = `${s.nombre} • ${correo}`;
            list.push({ label, value: correo });
          });

          this.opcionesVer = list;

          // normaliza verComo
          const hasCurrent = this.opcionesVer.some(o => o.value.toLowerCase() === (this.verComo || '').toLowerCase());
          if (!hasCurrent) this.verComo = this.emailActual;

          this.cargarIniciativas(this.verComo);
        },
        error: () => {
          // En error, deja solo "Yo"
          this.opcionesVer = [yo];
          if (!this.verComo) this.verComo = this.emailActual;
          this.cargarIniciativas(this.verComo);
        }
      });
  }

  onChangeVerComo(): void {
    if (!this.verComo) this.verComo = this.emailActual;
    this.cargarIniciativas(this.verComo);
  }

  // ======== Cargas ========
  private cargarIniciativas(correo: string): void {
    if (!correo) return;
    this.http
      .get<Iniciativa[]>(`${this.API}/api/iniciativas_por_correo/${encodeURIComponent(correo)}`)
      .subscribe({
        next: (rows) => {
          this.iniciativas = rows || [];

          // ADD: completa/ajusta el avance con base en las historias reales
          this.actualizarAvanceLocal();
        },
        error: (err) => {
          console.error('Error iniciativas:', err);
          this.iniciativas = [];
        }
      });
  }

  // ======== Fila (abre modal edición) ========
  onRowClick(it: Iniciativa): void {
    this.mostrarModalNueva = false;
    this.editModel = JSON.parse(JSON.stringify(it));
    this.errorGuardar = '';
    this.puedeAprobarActual = false;

    this.mostrarModalEdicion = true;

    const owner = (it.correo_electronico || '').trim().toLowerCase();
    const me = (this.session.getEmail() || '').trim().toLowerCase();

    // ✅ Admin: puede aprobar siempre (no bloqueamos el select ni borramos 'aprobacion')
    if (this.isAdmin()) {
      this.puedeAprobarActual = true;
      return; // no necesitamos consultar jefes del owner
    }

    // Regla actual para jefe/dueño
    this.http
      .get<ColaboradorInfo[]>(`${this.API}/api/colaborador/${encodeURIComponent(owner)}`)
      .subscribe({
        next: rows => {
          const c = rows && rows[0];
          const jefe1 = (c?.correo_jefe_inmediato || '').trim().toLowerCase();
          const jefe2 = (c?.correo_jefe_inmediato_2 || '').trim().toLowerCase();
          const hasJefe = !!jefe1 || !!jefe2;
          this.puedeAprobarActual = (me === jefe1 || me === jefe2) || (!hasJefe && me === owner);
        },
        error: () => { this.puedeAprobarActual = false; }
      });
  }

  cerrarModalEdicion(): void {
    this.mostrarModalEdicion = false;
    this.editModel = null;
    this.errorGuardar = '';
    this.puedeAprobarActual = false;
  }

  // ======== Guardar / Eliminar ========
  guardarCambios(): void {
    if (!this.editModel) return;
    this.guardando = true;
    this.errorGuardar = '';

    const payload: any = { ...this.editModel, correo_solicitante: this.session.getEmail() || '' };
    if (!this.puedeAprobarActual) delete payload.aprobacion; // admin o jefe no pasan por aquí

    this.http
      .put(`${this.API}/api/iniciativas/${this.editModel.id_iniciativa}`, payload)
      .subscribe({
        next: () => {
          this.guardando = false;
          this.mostrarModalEdicion = false;
          this.cargarIniciativas(this.verComo || this.emailActual);
        },
        error: (err) => {
          this.guardando = false;
          console.error('Error update:', err);
          this.errorGuardar =
            err?.error?.error ||
            'Error al guardar cambios. Verifica permisos de aprobación o datos.';
        }
      });
  }

  eliminarIniciativa(): void {
    if (!this.editModel) return;
    if (!confirm('¿Eliminar esta iniciativa?')) return;
    this.http.delete(`${this.API}/api/iniciativas/${this.editModel.id_iniciativa}`).subscribe({
      next: () => {
        this.mostrarModalEdicion = false;
        this.cargarIniciativas(this.verComo || this.emailActual);
      },
      error: (err) => {
        console.error('Error delete:', err);
        alert('No se pudo eliminar la iniciativa.');
      }
    });
  }

  // ======== Historias ========
  onHistoriasClick(it: Iniciativa): void {
    if (!this.isAprobada(it)) {
      alert('Debes esperar la aprobación de tu jefe para acceder a Historias.');
      return;
    }
    this.router.navigate(
      ['/history-user', it.id_iniciativa],     // ← ruta solicitada
      { state: { iniciativa: it } }            // ← pasa toda la fila seleccionada
    );
  }

  // ======== NUEVA INICIATIVA ========
  abrirModalNuevaIniciativa(): void {
    // cierra el de edición si estuviera abierto (no cambio nada más)
    this.mostrarModalEdicion = false;

    const owner = this.verComo || this.emailActual;
    this.nuevaModel = {
      nombre_iniciativa: '',
      descripcion_iniciativa: '',
      correo_electronico: owner,
      tipo_actividad: '',
      periodicidad: '',
      carga_minutos: null,
      herramientas: ''
    };
    this.errorCrear = '';
    this.creando = false;

    // 🔧 clave: abre en el próximo tick para evitar solape con el overlay anterior
    setTimeout(() => {
      this.mostrarModalNueva = true;
    }, 0);
  }

  cerrarModalNueva(): void {
    this.mostrarModalNueva = false;
    this.nuevaModel = null;
    this.errorCrear = '';
  }

  crearIniciativa(): void {
    if (!this.nuevaModel) return;

    const f = this.nuevaModel;
    const faltan: string[] = [];
    if (!f.nombre_iniciativa?.trim()) faltan.push('Nombre');
    if (!f.descripcion_iniciativa?.trim()) faltan.push('Descripción');
    if (!f.correo_electronico?.trim()) faltan.push('Correo');
    if (!f.tipo_actividad?.trim()) faltan.push('Tipo actividad');
    if (!f.periodicidad?.trim()) faltan.push('Periodicidad');
    if (f.carga_minutos === null || isNaN(Number(f.carga_minutos))) faltan.push('Carga (min)');
    if (faltan.length) {
      this.errorCrear = 'Faltan: ' + faltan.join(', ');
      return;
    }

    this.creando = true;
    this.errorCrear = '';
    this.http.post(`${this.API}/api/iniciativas`, f).subscribe({
      next: () => {
        this.creando = false;
        this.mostrarModalNueva = false;
        this.cargarIniciativas(this.verComo || this.emailActual);
      },
      error: (err) => {
        this.creando = false;
        console.error('Error crear:', err);
        this.errorCrear = err?.error?.error || 'Error al crear la iniciativa.';
      }
    });
  }

  // ======== Cambiar correo (sesión) ========
  cambiarCorreo(): void {
    this.abrirSelectorCorreo();
  }
  abrirSelectorCorreo(): void {
    this.mostrarSelectorCorreo = true;
    this.correoSeleccionado = this.session.getEmail() || '';
    if (!this.opcionesCorreo.length) {
      this.http.get<OpcionCorreo[]>(`${this.API}/api/correos_select`).subscribe({
        next: rows => (this.opcionesCorreo = rows || []),
        error: err => console.error('Error correos_select:', err)
      });
    }
  }
  cancelarSelectorCorreo(): void {
    if (!this.session.getEmail()) return;
    this.mostrarSelectorCorreo = false;
  }
  confirmarSelectorCorreo(): void {
    const c = (this.correoSeleccionado || '').trim();
    if (!c) return;
    this.session.setEmail(c);
    this.mostrarSelectorCorreo = false;
  }

  // ADD: recalcula el avance de cada iniciativa leyendo sus historias (cliente)
  // Recalcula el avance por historias y ajusta el estado (Cerrada/Abierta)
  private actualizarAvanceLocal(): void {
    const cerrados = new Set(['cerrada', 'finalizada', 'completada', 'hecha']);

    this.iniciativas.forEach((it, i) => {
      const id = it?.id_iniciativa;
      if (!id) return;

      this.http.get<{ estado?: string | null }[]>(`${this.API}/api/historias_usuario/${id}`).subscribe({
        next: (hs) => {
          const total = hs?.length ?? 0;

          // Sin historias: dejamos el estado como está y sólo normalizamos avance
          if (!total) { this.iniciativas[i].avance = 0; return; }

          const nCerradas = (hs || []).filter(h =>
            cerrados.has((h?.estado || '').toLowerCase())
          ).length;

          const pct = Math.round((nCerradas * 100) / total);
          this.iniciativas[i].avance = pct;

          // Nuevo estado según avance
          const newState = pct >= 100 ? 'Cerrada' : 'Abierta';

          // Evita PUTs innecesarios si no hay cambios
          const changed =
            (this.iniciativas[i].estado_iniciativa || '').toLowerCase() !== newState.toLowerCase() ||
            (this.iniciativas[i].avance ?? 0) !== pct;

          // Refleja en UI de inmediato
          this.iniciativas[i].estado_iniciativa = newState;

          // Sincroniza con backend de forma silenciosa
          if (changed) {
            this.http.put(`${this.API}/api/iniciativas/${id}`, {
              estado_iniciativa: newState,
              avance: pct
            }).subscribe({ next: () => { }, error: () => { } });
          }
        },
        error: () => {
          // si falla, dejamos el valor que vino del backend
        }
      });
    });
  }
}
