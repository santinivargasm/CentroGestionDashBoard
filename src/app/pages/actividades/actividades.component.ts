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
  private ADMIN_EMAIL = 'santiago.vargas@credibanco.com';
  private isAdmin(): boolean {
    return (this.session.getEmail() || '').trim().toLowerCase() === this.ADMIN_EMAIL.toLowerCase();
  }

  // ======== Estado base ========
  emailActual: string = '';
  userIdActual: string = '';
  nombreActual: string = '';
  iniciativas: Iniciativa[] = [];

  // Ver: (Yo / Subordinados) — dejamos el mecanismo para no romper nada,
  // pero ya no habrá selector visual; cargamos “Yo” por defecto.
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

  // ======== Selector de correo (ELIMINADO DEL UI) ========
  // ❌ Quitamos estas banderas/estado para no exponer selector al usuario.
  // (Se dejan comentadas por si los quieres reactivar en el futuro)
  // mostrarSelectorCorreo = false;
  // correoSeleccionado = '';
  // opcionesCorreo: OpcionCorreo[] = [];

  // ---- Control anti-race para el combo "Ver:"
  private verReqId = 0;

  // =========================================
  // Catálogos para selects (Edit/Nueva)
  // =========================================
  tipoActividadOpts: string[] = [
    '', 'Power BI', 'IA', 'Machine Learning', 'Python', 'Query', 'Dash', 'DPA',
    'Procesamiento Data', 'Workflow', 'Reunión', 'PPT',
    'ETL/ELT', 'Data Cleaning', 'Scraping', 'Validación de Datos',
    'Carga de Reportes', 'Documentación', 'Soporte/Incidentes',
    'Integración de Sistemas', 'Testing', 'Automatización RPA', 'GoAnywhere', 'Automate',
  ];

  periodicidadOpts: string[] = [
    '', 'DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'A PEDIDO'
  ];

  herramientasOpts: string[] = [
    '', 'Power BI', 'Cloudera', 'Python', 'GoAnywhere', 'Excel', 'Postman', 'Outlook', 'Teams',
    'Copilot', 'Word', 'PowerPoint', 'SharePoint', 'Power Platform', 'Azure', 'SAP',
    'Tableau', 'Qlik', 'Looker', 'Databricks', 'Snowflake', 'BigQuery', 'Redshift',
    'MySQL', 'PostgreSQL', 'SQL Server', 'Oracle', 'Teradata',
    'Airflow', 'dbt', 'Fivetran', 'Kafka',
    'GitHub', 'GitLab', 'Bitbucket', 'Jenkins', 'Azure DevOps', 'Docker', 'Kubernetes', 'Terraform',
    'UiPath', 'Automation Anywhere', 'Power Automate', 'Selenium', 'Automate',
    'Confluence', 'Jira', 'ServiceNow', 'Notion', 'Slack', 'Zoom',
    'OneDrive', 'Power Apps'
  ];

private hydrateFromWhoAmI(): Promise<{ email?: string | null, name?: string | null, role?: string | null }> {
    return new Promise((resolve) => {
        // Obtener el correo electrónico desde el servicio de sesión o desde el flujo actual
        const email = (this.session.getEmail() || '').trim().toLowerCase();
        
        if (email) {
            // Llamamos al endpoint para obtener el rol del usuario
            this.http.get<{ ok: boolean; rol?: string | null }>(`${this.API}/api/rol/${encodeURIComponent(email)}`)

                .subscribe({
                    next: (rolResponse) => {
                        const role = rolResponse?.rol || null; // Obtenemos el rol
                        // Guardamos el rol en el servicio de sesión
                        this.session.setRole(role);
                        
                        resolve({ email, role });
                    },
                    error: () => resolve({ email, role: null }) // Si falla, retornamos solo el correo
                });
        } else {
            resolve({ email: null, role: null });
        }
    });
}



  ngOnInit(): void {
    // 1) Mantén la suscripción existente (no tocar)
    this.subs.push(
      this.session.emailChanges().subscribe(c => {
        this.emailActual = c || '';
        this.prepararOpcionesVer();
        this.cargarIniciativas(this.verComo || this.emailActual);
      })
    );

    // 2) Snapshot rápido (por si ya hubiera algo guardado)
    const snap = this.session.getSnapshot();
    this.userIdActual = snap.userId || '';
    this.nombreActual = snap.nombre || '';

    // 3) Hidrata SIEMPRE desde EasyAuth (source of truth) y luego continúa
    this.hydrateFromWhoAmI().then(({ email, name, role }) => {
      const effective = (email || this.userIdActual || snap.email || '').trim().toLowerCase();
      if (effective) {
        // fuerza el canal único de correo para toda la lógica existente
        this.session.setEmail(effective);
        this.emailActual = effective;
        this.verComo = effective;
        if (name && !this.nombreActual) this.nombreActual = name;
        if (role) this.session.setRole(role);  // Asegúrate de que el rol también se esté guardando correctamente
      }
      // prepara y carga (si ya no se disparó por la suscripción)
      this.prepararOpcionesVer();
      if (this.verComo) this.cargarIniciativas(this.verComo);
    });
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

  // ======== Select "Ver:" (anti-race) ========
  private prepararOpcionesVer(): void {
    // ✅ Ya NO abrimos selector. Si no hay email, salimos silenciosamente.
    if (!this.emailActual) return;

    const yo: OpcionVer = { label: `Yo • ${this.emailActual}`, value: this.emailActual };

    const myReq = ++this.verReqId;
    this.opcionesVer = [yo];

    this.http
      .get<Subordinado[]>(`${this.API}/api/subordinados_de/${encodeURIComponent(this.emailActual)}`)
      .subscribe({
        next: (rows) => {
          if (myReq !== this.verReqId) return;

          const seen = new Set<string>();
          const list: OpcionVer[] = [yo];

          (rows || []).forEach(s => {
            const correo = (s.correo_electronico || '').trim();
            const key = correo.toLowerCase();
            if (!correo || seen.has(key)) return;
            seen.add(key);
            const label = `${s.nombre} • ${correo}`;
            list.push({ label, value: correo });
          });

          this.opcionesVer = list;

          const hasCurrent = this.opcionesVer.some(o => o.value.toLowerCase() === (this.verComo || '').toLowerCase());
          if (!hasCurrent) this.verComo = this.emailActual;

          this.cargarIniciativas(this.verComo);
        },
        error: () => {
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
          this.actualizarAvanceLocal();
        },
        error: (err) => {
          console.error('Error iniciativas:', err);
          this.iniciativas = [];
        }
      });
  }

  // ======== Fila (modal edición) ========
  onRowClick(it: Iniciativa): void {
    this.mostrarModalNueva = false;
    this.editModel = JSON.parse(JSON.stringify(it));
    this.errorGuardar = '';
    this.puedeAprobarActual = false;

    this.mostrarModalEdicion = true;

    const owner = (it.correo_electronico || '').trim().toLowerCase();
    const me = (this.session.getEmail() || '').trim().toLowerCase();

    // Verificar si el usuario tiene el rol de "administrador"
    if (this.isAdministrador()) {
      this.puedeAprobarActual = true;
      return;
    }

    // Si no es "administrador", verificamos si es un jefe inmediato
    this.http
      .get<ColaboradorInfo[]>(`${this.API}/api/colaborador/${encodeURIComponent(owner)}`)
      .subscribe({
        next: rows => {
          const c = rows && rows[0];
          const jefe1 = (c?.correo_jefe_inmediato || '').trim().toLowerCase();
          const jefe2 = (c?.correo_jefe_inmediato_2 || '').trim().toLowerCase();
          const hasJefe = !!jefe1 || !!jefe2;

          // El usuario puede aprobar si es uno de los jefes o el responsable de la iniciativa si no tiene jefes asignados
          this.puedeAprobarActual = (me === jefe1 || me === jefe2) || (!hasJefe && me === owner);
        },
        error: () => { this.puedeAprobarActual = false; }
      });
  }

  // Método para verificar si el usuario es un "administrador"
  isAdministrador(): boolean {
    const rol = this.session.getRole() || '';  // Suponiendo que tienes el rol guardado en la sesión
    return rol.toLowerCase() === 'administrador';
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
    if (!this.puedeAprobarActual) delete payload.aprobacion;

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
      ['/history-user', it.id_iniciativa],
      { state: { iniciativa: it } }
    );
  }

  // ======== NUEVA INICIATIVA ========
  abrirModalNuevaIniciativa(): void {
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

  // ======== AVANCE LOCAL (sin cambios de lógica) ========
  private actualizarAvanceLocal(): void {
    const cerrados = new Set(['cerrada', 'finalizada', 'completada', 'hecha']);

    this.iniciativas.forEach((it, i) => {
      const id = it?.id_iniciativa;
      if (!id) return;

      this.http.get<{ estado?: string | null }[]>(`${this.API}/api/historias_usuario/${id}`).subscribe({
        next: (hs) => {
          const total = hs?.length ?? 0;

          if (!total) { this.iniciativas[i].avance = 0; return; }

          const nCerradas = (hs || []).filter(h =>
            cerrados.has((h?.estado || '').toLowerCase())
          ).length;

          const pct = Math.round((nCerradas * 100) / total);
          this.iniciativas[i].avance = pct;

          const newState = pct >= 100 ? 'Cerrada' : 'Abierta';

          const changed =
            (this.iniciativas[i].estado_iniciativa || '').toLowerCase() !== newState.toLowerCase() ||
            (this.iniciativas[i].avance ?? 0) !== pct;

          this.iniciativas[i].estado_iniciativa = newState;

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


