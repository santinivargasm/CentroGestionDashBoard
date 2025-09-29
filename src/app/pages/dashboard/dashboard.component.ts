import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ChangeDetectorRef, inject, viewChild } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { Chart } from 'chart.js/auto';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

// ================== Constantes ==================
const BASE_URL = 'http://127.0.0.1:5000/api';

// ================== Interfaces ==================
export interface Colaborador {
  id_empleado: string | number;
  nombre: string;
  apellido: string;
  fecha_nacimiento: Date | string;
  correo_electronico: string;
  puesto: string;
  area: string;
  estado_chapter: string;
  automatizacion: string;
  analitica_avanzada: string;
  gerencia: string;
  vicepresidencia: string;
  jefe_directo: string;
}

export interface Comment {
  user: string;
  text: string;
  date: Date;
}

export interface Iniciativa {
  apellido: string;
  avance: number;
  correo_electronico: string;
  descripcion: string;
  estado_id: number;
  fecha_fin_estimada: string;
  fecha_fin_real: string;
  fecha_inicio: string;
  id_iniciativa: number;
  nombre_colaborador: string;
  nombre_iniciativa: string;
  prioridad_id: number;
}

type ColabIniRow = {
  id_iniciativa: number;
  nombre_iniciativa: string;
  descripcion: string;
  fecha_inicio: string;
  fecha_fin_estimada: string;
  fecha_fin_real: string;
  nombre_colaborador: string;
  apellido: string;
  correo_electronico: string;
  estado_id: number;
  prioridad_id: number;
  avance: number;
};

interface DetalleUsuarioVM {
  colaborador: Colaborador;
  iniciativas: Iniciativa[];
}

type NuevaIniciativaPayload = {
  id_iniciativa?: number | null;
  nombre: string;
  descripcion: string;
  fecha_inicio: string;
  fecha_fin_estimada: string;
  fecha_fin_real: string;
  estado_id: number | null;
  prioridad_id: number | null;
  tipo_iniciativa_id: number | null;
  bucket_id: number | null;
  avance: number | null;
  comentario: string;
  sprint_id: number | null;
  talla_id: number | null;
  tipo_elemento_id: number | null;
  ruta_acceso: string;
  id_proyecto: number | null;
  id_empleado: string;
  correo_electronico: string;
  id_modificador: string;
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class DashboardComponent {
  public chart = viewChild.required<ElementRef<HTMLCanvasElement>>('chart');
  public circle = viewChild.required<ElementRef<HTMLCanvasElement>>('circle');

  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  public userList: Colaborador[] = [];
  public selectedUser: Colaborador | null = null;

  public isModalOpen = false;
  public isLoadingDetail = false;
  public modalError: string | null = null;

  public detailVm: DetalleUsuarioVM | null = null;

  public comments: Comment[] = [
    { user: 'Usuario 1', text: 'Este es un comentario de ejemplo', date: new Date() },
    { user: 'Usuario 2', text: 'Otro comentario interesante', date: new Date() },
  ];

  public isCreating = false;
  public isSaving = false;
  public newIni: NuevaIniciativaPayload | null = null;

  public isNewIniModalOpen = false;

  // ================== Ciclo de vida ==================
  public ngOnInit() { this.getUsers(); }
  public ngAfterViewInit() { this.initCharts(); }

  // ================== Datos principales ==================
  public getUsers() {
    this.http.get<Colaborador[]>(`${BASE_URL}/colaboradores`).subscribe({
      next: (result) => this.userList = result ?? [],
      error: (err) => { console.error('Error cargando colaboradores:', err); this.userList = []; }
    });
  }

  public onVerClick(item: Colaborador, ev: MouseEvent) { ev.stopPropagation(); this.verDetalle(item); }

  public verDetalle(item: Colaborador) {
    this.selectedUser = item;
    this.isModalOpen = true;
    this.cdr.detectChanges();
    this.getUserDetailYIniciativas(item.correo_electronico);
  }

  private getUserDetailYIniciativas(correo_electronico: string) {
    this.isLoadingDetail = true;
    this.modalError = null;
    this.detailVm = null;

    const correoPath = encodeURIComponent(correo_electronico);

    this.http.get<ColabIniRow[]>(`${BASE_URL}/colaborador/${correoPath}`)
      .pipe(finalize(() => { this.isLoadingDetail = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (rows) => {
          const base = this.selectedUser;

          if (!rows || rows.length === 0) {
            if (!base) { this.modalError = `No se encontró detalle para: ${correo_electronico}`; return; }
            this.detailVm = { colaborador: { ...base }, iniciativas: [] };
            return;
          }

          const r0 = rows[0];
          const colaborador: Colaborador = {
            id_empleado: base?.id_empleado ?? '',
            nombre: r0.nombre_colaborador ?? base?.nombre ?? '',
            apellido: r0.apellido ?? base?.apellido ?? '',
            fecha_nacimiento: base?.fecha_nacimiento ?? '',
            correo_electronico: r0.correo_electronico ?? base?.correo_electronico ?? '',
            puesto: base?.puesto ?? '',
            area: base?.area ?? '',
            estado_chapter: base?.estado_chapter ?? '',
            automatizacion: base?.automatizacion ?? '',
            analitica_avanzada: base?.analitica_avanzada ?? '',
            gerencia: base?.gerencia ?? '',
            vicepresidencia: base?.vicepresidencia ?? '',
            jefe_directo: base?.jefe_directo ?? '',
          };

          const iniciativas: Iniciativa[] = rows.map((r) => ({
            id_iniciativa: r.id_iniciativa,
            nombre_iniciativa: r.nombre_iniciativa,
            descripcion: r.descripcion,
            fecha_inicio: r.fecha_inicio,
            fecha_fin_estimada: r.fecha_fin_estimada,
            fecha_fin_real: r.fecha_fin_real,
            nombre_colaborador: r.nombre_colaborador,
            apellido: r.apellido,
            correo_electronico: r.correo_electronico,
            estado_id: r.estado_id,
            prioridad_id: r.prioridad_id,
            avance: r.avance,
          }));

          this.detailVm = { colaborador, iniciativas };
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error obteniendo detalle/iniciativas:', err);
          this.modalError = 'Ocurrió un error obteniendo la información.';
          this.cdr.detectChanges();
        }
      });
  }

  // ================== Navegación ==================
  public goToGetApi(ini: Iniciativa, correo: string) {
    this.router.navigate(['/get-api'], {
      queryParams: { id: ini.id_iniciativa, correo },
      state: { iniciativa: ini, colaborador: this.detailVm?.colaborador }
    });
  }

  // ✅ Agregado desde el primer .ts (sin romper nada):
  public goToHistoryUser(ini: Iniciativa, ) {
    this.router.navigate([`/history-user/${ini.id_iniciativa}`], {
      queryParams: { id: ini.id_iniciativa, },
      // opcional: pasamos el objeto completo por history.state para usarlo en GetApi
      state: { iniciativa: ini, colaborador: this.detailVm?.colaborador }
    });
  }

  // ================== Modales ==================
  public openModal() { this.isModalOpen = true; }
  public closeModal() {
    this.isModalOpen = false;
    this.isCreating = false;
    if (!this.isNewIniModalOpen) this.newIni = null;
  }
  public onBackdropClick(ev: MouseEvent) { if (ev.target === ev.currentTarget) this.closeModal(); }

  @HostListener('document:keydown.escape')
  public onEsc() { if (this.isNewIniModalOpen) this.closeNewIniModal(); else if (this.isModalOpen) this.closeModal(); }

  // ================== Charts ==================
  public initCharts() {
    new Chart(this.chart().nativeElement, {
      type: 'line',
      data: {
        labels: ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],
        datasets: [{ label: 'Vistas', data: [10,20,30,25,40,55,65,75,85,95,105,115], borderColor: '#FFFFFF', backgroundColor: 'rgba(0, 0, 192, 0.25)', fill: 'start' }],
      },
      options: {
        maintainAspectRatio: false,
        elements: { line: { tension: 0.4 } },
        scales: {
          x: { ticks: { color: '#FFF' }, grid: { color: '#FFFFFF50' } },
          y: { ticks: { color: '#FFF' }, grid: { color: '#FFFFFF30' } },
        },
        plugins: { legend: { labels: { color: '#FFF' } } },
      },
    });

    new Chart(this.circle().nativeElement, {
      type: 'pie',
      data: {
        labels: ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],
        datasets: [{ label: 'Vistas', data: [10,20,30,40,50,60,70,80,90,100,110,120], backgroundColor: ['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899','#f97316','#14b8a6','#0ea5e9','#64748b','#84cc16','#eab308'], borderColor: 'white', hoverOffset: 4 }],
      },
      options: { maintainAspectRatio: false, plugins: { legend: { labels: { color: '#FFF' } } } },
    });
  }

  // Compat con flujo viejo
  public startNewIni(colab: Colaborador) { this.openNewIniModal(colab); }
  public cancelNewIni() { this.closeNewIniModal(); }

  // ===== Modal secundario "Nueva iniciativa" =====
  public openNewIniModal(colab: Colaborador | null) {
    const who = colab ?? this.selectedUser ?? this.detailVm?.colaborador;
    if (!who) { this.modalError = 'No hay colaborador seleccionado.'; return; }

    this.newIni = {
      id_iniciativa: null,
      nombre: '',
      descripcion: '',
      fecha_inicio: '',
      fecha_fin_estimada: '',
      fecha_fin_real: '',
      estado_id: null,
      prioridad_id: null,
      tipo_iniciativa_id: null,
      bucket_id: null,
      avance: 0,
      comentario: '',
      sprint_id: null,
      talla_id: null,
      tipo_elemento_id: null,
      ruta_acceso: '',
      id_proyecto: null,
      id_empleado: String(who.id_empleado),
      correo_electronico: String(who.correo_electronico),
      id_modificador: String(who.id_empleado),
    };

    this.selectedUser = who;
    this.isNewIniModalOpen = true;
    this.isCreating = true;
    this.cdr.detectChanges();
  }

  public closeNewIniModal() {
    this.isNewIniModalOpen = false;
    this.isCreating = false;
    this.newIni = null;
    this.cdr.detectChanges();
  }

  public onNewIniBackdropClick(ev: MouseEvent) { if (ev.target === ev.currentTarget) this.closeNewIniModal(); }

  // ================== Enviar ==================
  public submitNewIni() {
    console.log('submitNewIni() disparado. Payload =>', this.newIni);

    if (!this.newIni) return;

    const nombre = String(this.newIni.nombre ?? '');
    const descripcion = String(this.newIni.descripcion ?? '');
    const id_empleado = String(this.newIni.id_empleado ?? '');
    const correo = String(this.newIni.correo_electronico ?? '');

    if (!nombre.trim() || !descripcion.trim() || !id_empleado.trim() || !correo.trim()) {
      this.modalError = 'Nombre, descripción, id_empleado y correo_electronico son obligatorios.';
      return;
    }

    this.isSaving = true;
    this.modalError = null;

    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    this.http.post(`${BASE_URL}/iniciativas`, this.newIni, { headers })
      .pipe(finalize(() => { this.isSaving = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          const correo = this.newIni!.correo_electronico;
          this.newIni = null;
          this.isCreating = false;
          this.isNewIniModalOpen = false;
          this.getUserDetailYIniciativas(correo);
        },
        error: (err) => {
          console.error('Error creando iniciativa:', err);
          this.modalError = (err?.error?.error) || 'No se pudo crear la iniciativa.';
        }
      });
  }
}
