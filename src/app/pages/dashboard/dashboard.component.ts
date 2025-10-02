import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ChangeDetectorRef, inject, viewChild } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { Chart } from 'chart.js/auto';
import type { Chart as ChartJS } from 'chart.js';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs/operators';

const BASE_URL = 'http://127.0.0.1:5000/api';

const APP_PIE_PALETTE = ['#00a1a1','#FFB600','#008f8f','#1d2530','#14b8a6','#0ea5e9','#64748b'];
function buildPalette(len: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < len; i++) out.push(APP_PIE_PALETTE[i % APP_PIE_PALETTE.length]);
  return out;
}

// ====== Tipos ======
export interface Colaborador {
  id_empleado: string | number;
  nombre: string;
  apellido: string;
  fecha_nacimiento: Date | string;
  correo_electronico: string;
  puesto: string;
  departamento: string;
  estado_chapter: string;
  automatizacion: string;
  analitica_avanzada: string;
  gerencia: string;
  vicepresidencia: string;
  jefe_directo: string;
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
interface DetalleUsuarioVM { colaborador: Colaborador; iniciativas: Iniciativa[]; }

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

export interface ActividadDiaria {
  id_actividad: number;
  fecha: Date | string | null;
  nombre_actividad: string;
  descripcion: string;
  tipo_actividad: string;
  periodicidad: string;
  carga_minutos: number;
  herramientas: string;
  id_historia: number | null;
  id_iniciativa: number | null;
  correo_electronico: string;
  correo_electronico_buckup: string;
  rol: 'titular' | 'backup' | 'otro';
}

type NuevaActividadPayload = {
  id_actividad?: number | null;
  fecha: string;
  nombre_actividad: string;
  descripcion?: string | null;
  tipo_actividad: string;
  periodicidad: string;
  carga_minutos: number;
  herramientas?: string | null;
  id_historia?: number | null;
  correo_electronico: string;
  correo_electronico_buckup?: string | null;
};

interface HistoriaLite { id_historia: number; nombre_historia: string; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class DashboardComponent {
  // Canvas refs
  public chart = viewChild<ElementRef<HTMLCanvasElement>>('chart');
  public circle = viewChild<ElementRef<HTMLCanvasElement>>('circle');
  public paretoCanvas = viewChild<ElementRef<HTMLCanvasElement>>('paretoCanvas');
  public pieTipoCanvas = viewChild<ElementRef<HTMLCanvasElement>>('pieTipoCanvas');
  public doughPeriodicidadCanvas = viewChild<ElementRef<HTMLCanvasElement>>('doughPeriodicidadCanvas');

  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  public userList: Colaborador[] = [];
  public selectedUser: Colaborador | null = null;

  public isModalOpen = false;
  public isLoadingDetail = false;
  public modalError: string | null = null;

  public detailVm: DetalleUsuarioVM | null = null;

  // INICIATIVAS
  public isCreating = false;
  public isSaving = false;
  public newIni: NuevaIniciativaPayload | null = null;
  public isNewIniModalOpen = false;

  // ACTIVIDADES
  public actividades: ActividadDiaria[] = [];
  public totalMinutosActividades = 0;
  private allActividades: ActividadDiaria[] = [];
  public dateFrom: string = '';
  public dateTo: string = '';

  private paretoChart?: ChartJS;
  private pieTipoChart?: ChartJS<'pie', number[], string>;
  private doughPeriodicidadChart?: ChartJS<'doughnut', number[], string>;

  // NUEVA ACTIVIDAD
  public isNewActModalOpen = false;
  public isSavingAct = false;
  public newAct: NuevaActividadPayload | null = null;
  public modalErrorAct: string | null = null;

  public showFullDetails = false;

  public HERRAMIENTAS_OPTS: string[] = [
    "", "Power BI", "Cloudera", "Python", "Excel", "Postman", "Outlook", "Teams",
    "Copilot", "Word", "PowerPoint", "SharePoint", "Power Platform", "Azure", "SAP",
    "Jira", "Confluence", "GitHub", "VS Code", "Notion", "Figma", "Tableau"
  ];
  public TIPOS_OPTS: string[] = [
    "", "Power BI", "IA", "Machine Learning", "Python", "Query", "Dash", "DPA",
    "Procesamiento de Datos", "Workflow", "Reunión", "Presentación", "Documentación",
    "Automatización", "Análisis", "Diseño", "Testing", "Scrum", "Soporte"
  ];
  public herramientaSel: string = '';

  public historiasOpts: HistoriaLite[] = [];
  public historiasLoading = false;

  // ---- Reapertura modal al volver ----
  private lastReopenKey = ''; // evita reabrir varias veces el mismo colaborador

  constructor() {
    // Si el componente sigue vivo (p.ej. volvemos a /dashboard y no se destruye),
    // escuchamos cada NavigationEnd para intentar reabrir el modal.
    this.router.events
      .pipe(filter(ev => ev instanceof NavigationEnd))
      .subscribe(() => this.maybeReopenFromState());
  }

  private getNavState(): any {
    // history.state funciona mejor al llegar al destino
    return history.state;
  }

  private maybeReopenFromState() {
    const st = this.getNavState();
    if (!st?.reopenModal || !st?.colaborador) return;

    const key = `${st.colaborador?.correo_electronico || ''}|${st.iniciativa?.id_iniciativa || ''}`;
    if (key && key === this.lastReopenKey) return; // ya lo abrimos para este state

    this.lastReopenKey = key;
    // Abrimos el modal con el colaborador que venía en el state
    setTimeout(() => this.verDetalle(st.colaborador), 0);
  }
  // ------------------------------------

  // ===== Ciclo de vida =====
  public ngOnInit() {
    this.getUsers();
    // Intento temprano (por si el componente fue recreado)
    this.maybeReopenFromState();
  }
  public ngAfterViewInit() { this.initCharts(); }

  // ===== Datos =====
  public getUsers() {
    this.http.get<Colaborador[]>(`${BASE_URL}/colaboradores`).subscribe({
      next: (result) => {
        this.userList = result ?? [];
        // Intento cuando ya hay datos
        this.maybeReopenFromState();
      },
      error: (err) => {
        console.error('Error cargando colaboradores:', err);
        this.userList = [];
        // Igual intentamos (si reabrir no depende de la lista)
        this.maybeReopenFromState();
      }
    });
  }

  public verDetalle(item: Colaborador) {
    this.selectedUser = item;
    this.isModalOpen = true;
    this.showFullDetails = false;
    this.cdr.detectChanges();

    this.getUserDetailYIniciativas(item.correo_electronico);
    this.loadActividadesFor(item.correo_electronico);
  }

  private getUserDetailYIniciativas(correo: string) {
    this.isLoadingDetail = true;
    this.modalError = null;
    this.detailVm = null;

    this.http.get<ColabIniRow[]>(`${BASE_URL}/colaborador/${encodeURIComponent(correo)}`)
      .pipe(finalize(() => { this.isLoadingDetail = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (rows) => {
          const base = this.selectedUser;

          if (!rows || rows.length === 0) {
            if (!base) { this.modalError = `No se encontró detalle para: ${correo}`; return; }
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
            departamento: base?.departamento ?? '',
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

  public goToHistoryUser(ini: Iniciativa) {
    this.router.navigate([`/history-user/${ini.id_iniciativa}`], {
      queryParams: { id: ini.id_iniciativa },
      state: { iniciativa: ini, colaborador: this.detailVm?.colaborador }
    });
  }

  // ===== Modal principal =====
  public closeModal() {
    this.isModalOpen = false;
    this.isCreating = false;
    this.showFullDetails = false;
    this.dateFrom = '';
    this.dateTo = '';
    if (!this.isNewIniModalOpen) this.newIni = null;
    if (!this.isNewActModalOpen) this.newAct = null;
    this.destroyChartsActividades();
  }
  public onBackdropClick(ev: MouseEvent) { if (ev.target === ev.currentTarget) this.closeModal(); }

  @HostListener('document:keydown.escape')
  public onEsc() {
    if (this.isNewActModalOpen) this.closeNewActModal();
    else if (this.isNewIniModalOpen) this.closeNewIniModal();
    else if (this.isModalOpen) this.closeModal();
  }

  public toggleUserDetails() { this.showFullDetails = !this.showFullDetails; }

  // ===== Charts pequeños (opcionales) =====
  public initCharts() {
    const chartEl = this.chart?.()?.nativeElement;
    const circleEl = this.circle?.()?.nativeElement;
    if (!chartEl || !circleEl) return;

    new Chart(chartEl, {
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

    new Chart(circleEl, {
      type: 'pie',
      data: {
        labels: ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],
        datasets: [{ label: 'Vistas', data: [10,20,30,40,50,60,70,80,90,100,110,120], backgroundColor: ['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899','#f97316','#14b8a6','#0ea5e9','#64748b','#84cc16','#eab308'], borderColor: 'white', hoverOffset: 4 }],
      },
      options: { maintainAspectRatio: false, plugins: { legend: { labels: { color: '#FFF' } } } },
    });
  }

  // ===== Nueva iniciativa =====
  public openNewIniModal(colab: Colaborador | null) {
    const who = colab ?? this.selectedUser ?? this.detailVm?.colaborador;
    if (!who) { this.modalError = 'No hay colaborador seleccionado.'; return; }

    this.newIni = {
      id_iniciativa: null, nombre: '', descripcion: '',
      fecha_inicio: '', fecha_fin_estimada: '', fecha_fin_real: '',
      estado_id: null, prioridad_id: null, tipo_iniciativa_id: null,
      bucket_id: null, avance: 0, comentario: '',
      sprint_id: null, talla_id: null, tipo_elemento_id: null,
      ruta_acceso: '', id_proyecto: null,
      id_empleado: String(who.id_empleado),
      correo_electronico: String(who.correo_electronico),
      id_modificador: String(who.id_empleado),
    };

    this.selectedUser = who;
    this.isNewIniModalOpen = true;
    this.isCreating = true;
    this.cdr.detectChanges();
  }
  public closeNewIniModal() { this.isNewIniModalOpen = false; this.isCreating = false; this.newIni = null; this.cdr.detectChanges(); }
  public onNewIniBackdropClick(ev: MouseEvent) { if (ev.target === ev.currentTarget) this.closeNewIniModal(); }

  public submitNewIni() {
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
          const correoEnv = this.newIni!.correo_electronico;
          this.newIni = null;
          this.isCreating = false;
          this.isNewIniModalOpen = false;
          this.getUserDetailYIniciativas(correoEnv);
        },
        error: (err) => {
          console.error('Error creando iniciativa:', err);
          this.modalError = (err?.error?.error) || 'No se pudo crear la iniciativa.';
        }
      });
  }

  // ===== ACTIVIDADES =====
  private normalizeFecha(rows: ActividadDiaria[]): ActividadDiaria[] {
    return (rows ?? []).map(r => {
      const f = (r as any).fecha;
      if (!f) return { ...r, fecha: null };
      const d = new Date(String(f));
      return { ...r, fecha: isNaN(d.getTime()) ? null : d };
    });
  }

  private loadActividadesFor(correo: string) {
    this.http.get<ActividadDiaria[]>(`${BASE_URL}/actividades_por_correo/${encodeURIComponent(correo)}`)
      .subscribe({
        next: rows => {
          const normalized = this.normalizeFecha(rows);

          // SOLO titular
          const delUsuario = normalized.filter(r =>
            (r.correo_electronico?.toLowerCase() === correo.toLowerCase())
          );

          this.allActividades = delUsuario;
          this.actividades = delUsuario.slice();

          this.applyActivityFilters(false);
          this.totalMinutosActividades = this.actividades.reduce((acc, r) => acc + (r.carga_minutos || 0), 0);

          this.cdr.detectChanges();
          const ok = this.renderChartsActividades();
          if (!ok) {
            setTimeout(() => {
              this.cdr.detectChanges();
              this.renderChartsActividades();
            }, 0);
          }
        },
        error: err => {
          console.error('[ACTIVIDADES] error', err);
          this.allActividades = [];
          this.actividades = [];
          this.totalMinutosActividades = 0;
          this.destroyChartsActividades();
        }
      });
  }

  private toEpochUTC(v: string | Date): number { const d = (v instanceof Date) ? v : new Date(v); return d.getTime(); }
  private ymdToEpochStart(ymd: string): number { const [y,m,d]=ymd.split('-').map(Number); return Date.UTC(y, m-1, d, 0,0,0,0); }
  private ymdToEpochEnd(ymd: string): number { const [y,m,d]=ymd.split('-').map(Number); return Date.UTC(y, m-1, d, 23,59,59,999); }

  public setDatePreset(preset: 'hoy' | '7d' | '30d' | 'todo') {
    const now = new Date();
    const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    if (preset === 'todo') { this.dateFrom = ''; this.dateTo = ''; }
    else if (preset === 'hoy') { const ymd = toYMD(now); this.dateFrom = ymd; this.dateTo = ymd; }
    else if (preset === '7d') { const from = new Date(now); from.setDate(from.getDate() - 6); this.dateFrom = toYMD(from); this.dateTo = toYMD(now); }
    else if (preset === '30d') { const from = new Date(now); from.setDate(from.getDate() - 29); this.dateFrom = toYMD(from); this.dateTo = toYMD(now); }
    this.applyActivityFilters(true);
  }

  public applyActivityFilters(repaint = false) {
    if (this.dateFrom && this.dateTo && this.dateFrom > this.dateTo) { const a=this.dateFrom; this.dateFrom=this.dateTo; this.dateTo=a; }

    let filtered = this.allActividades.length ? this.allActividades : this.actividades;

    if (this.dateFrom) {
      const fromEpoch = this.ymdToEpochStart(this.dateFrom);
      filtered = filtered.filter(r =>
        r.fecha instanceof Date && !isNaN(r.fecha.getTime()) && this.toEpochUTC(r.fecha) >= fromEpoch
      );
    }
    if (this.dateTo) {
      const toEpoch = this.ymdToEpochEnd(this.dateTo);
      filtered = filtered.filter(r =>
        r.fecha instanceof Date && !isNaN(r.fecha.getTime()) && this.toEpochUTC(r.fecha) <= toEpoch
      );
    }

    this.actividades = filtered;
    this.totalMinutosActividades = this.actividades.reduce((acc, r) => acc + (r.carga_minutos || 0), 0);

    if (repaint) {
      this.destroyChartsActividades();
      this.cdr.detectChanges();
      this.renderChartsActividades();
    }
  }

  public onDateInputsChanged() { this.applyActivityFilters(true); }
  public onApplyDateFilter() { this.applyActivityFilters(true); }

  private destroyChartsActividades() {
    this.paretoChart?.destroy(); this.paretoChart = undefined;
    this.pieTipoChart?.destroy(); this.pieTipoChart = undefined;
    this.doughPeriodicidadChart?.destroy(); this.doughPeriodicidadChart = undefined;
  }

  private groupSum<T extends Record<string, any>>(rows: T[], key: (r: T) => string, val: (r: T) => number) {
    const map = new Map<string, number>();
    rows.forEach(r => { const k=(key(r)||'(sin dato)').trim(); map.set(k,(map.get(k)||0)+(val(r)||0)); });
    return Array.from(map.entries()).map(([k,v])=>({key:k,value:v})).sort((a,b)=>b.value-a.value);
  }

  private renderChartsActividades(): boolean {
    const paretoEl = this.paretoCanvas()?.nativeElement;
    const pieTipoEl = this.pieTipoCanvas()?.nativeElement;
    const doughEl = this.doughPeriodicidadCanvas()?.nativeElement;
    if (!paretoEl || !pieTipoEl || !doughEl) return false;

    this.destroyChartsActividades();

    const byActividad = this.groupSum(this.actividades, r => r.nombre_actividad, r => r.carga_minutos);
    const labelsPareto = byActividad.map(x => x.key);
    const valores = byActividad.map(x => x.value);
    const total = valores.reduce((a,b)=>a+b,0);
    const acumuladoPct = valores.map((v,i)=>{ const sum = valores.slice(0,i+1).reduce((a,b)=>a+b,0); return total ? +(((sum/total)*100).toFixed(2)) : 0; });

    const UMBRAL_MINUTOS = 44 * 60;
    const maxBar = Math.max(...valores, 0);
    const yMax = Math.max(UMBRAL_MINUTOS, Math.ceil(maxBar * 1.2));

    this.paretoChart = new Chart(paretoEl, {
      type: 'bar',
      data: {
        labels: labelsPareto,
        datasets: [
          { type: 'bar', label: 'Minutos', data: valores, backgroundColor: 'rgba(13,148,136,0.65)', borderColor: '#0f766e', borderWidth: 1, yAxisID: 'y', order: 1 },
          { type: 'line', label: `Umbral 44h (${UMBRAL_MINUTOS} min)`, data: new Array(labelsPareto.length).fill(UMBRAL_MINUTOS), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.2)', borderDash: [6,6], pointRadius: 0, yAxisID: 'y', order: 3 },
          { type: 'line', label: 'Acumulado (%)', data: acumuladoPct, borderColor: '#FFB600', backgroundColor: 'rgba(255,182,0,0.2)', tension: 0.3, yAxisID: 'y1', order: 2 },
        ]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { color: '#111827' } }, tooltip: { mode: 'index', intersect: false } },
        scales: {
          x: { ticks: { autoSkip: true, maxRotation: 0, color: '#111827' } },
          y: { title: { display: true, text: 'Minutos' }, ticks: { color: '#111827' }, max: yMax },
          y1:{ position:'right', min:0, max:100, grid:{ drawOnChartArea:false }, title:{ display:true, text:'Acumulado %' }, ticks:{ color:'#111827' } }
        }
      }
    });

    const byTipo = this.groupSum(this.actividades, r => r.tipo_actividad, r => r.carga_minutos);
    const pieColors = buildPalette(byTipo.length);
    this.pieTipoChart = new Chart(pieTipoEl, {
      type: 'pie',
      data: { labels: byTipo.map(x=>x.key), datasets: [{ label:'Minutos', data: byTipo.map(x=>x.value), backgroundColor: pieColors, borderColor:'#ffffff', borderWidth:2, hoverOffset:10 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position:'bottom', labels:{ color:'#111827' } } } }
    });

    const byPer = this.groupSum(this.actividades, r => r.periodicidad, r => r.carga_minutos);
    const doughColors = buildPalette(byPer.length);
    this.doughPeriodicidadChart = new Chart(doughEl, {
      type: 'doughnut',
      data: { labels: byPer.map(x=>x.key), datasets: [{ label:'Minutos', data: byPer.map(x=>x.value), backgroundColor: doughColors, borderColor:'#ffffff', borderWidth:2, hoverOffset:10 }] },
      options: { maintainAspectRatio:false, cutout:'55%', plugins:{ legend:{ position:'bottom', labels:{ color:'#111827' } } } }
    });

    return true;
  }

  // ===== Nueva actividad =====
  public openNewActModal(colab: Colaborador | null) {
    const who = colab ?? this.selectedUser ?? this.detailVm?.colaborador;
    if (!who) { this.modalErrorAct = 'No hay colaborador seleccionado.'; return; }

    this.selectedUser = who;
    this.modalErrorAct = null;

    const today = new Date();
    const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    this.newAct = {
      id_actividad: null,
      fecha: toYMD(today),
      nombre_actividad: '',
      descripcion: '',
      tipo_actividad: '',
      periodicidad: 'Diaria',
      carga_minutos: 0,
      herramientas: '',
      id_historia: null,
      correo_electronico: String(who.correo_electronico),
      correo_electronico_buckup: ''
    };

    this.herramientaSel = '';

    this.historiasOpts = [];
    this.historiasLoading = true;
    this.http.get<HistoriaLite[]>(`${BASE_URL}/historias_por_correo/${encodeURIComponent(who.correo_electronico)}`)
      .pipe(finalize(() => { this.historiasLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: data => { this.historiasOpts = data || []; },
        error: err => { console.error('Error cargando historias por correo:', err); this.historiasOpts = []; }
      });

    this.isNewActModalOpen = true;
    this.cdr.detectChanges();
  }

  public closeNewActModal() {
    this.isNewActModalOpen = false;
    this.isSavingAct = false;
    this.newAct = null;
    this.herramientaSel = '';
    this.historiasOpts = [];
    this.cdr.detectChanges();
  }

  public onNewActBackdropClick(ev: MouseEvent) { if (ev.target === ev.currentTarget) this.closeNewActModal(); }

  public submitNewAct(): void {
    if (!this.newAct) return;

    const requiredFilled =
      this.newAct.fecha && this.newAct.nombre_actividad && this.newAct.tipo_actividad &&
      this.newAct.periodicidad && (this.newAct.carga_minutos ?? 0) >= 0 && this.newAct.correo_electronico;

    if (!requiredFilled) {
      this.modalErrorAct = 'Por favor completa los campos obligatorios (*).';
      return;
    }

    this.newAct.herramientas = this.herramientaSel || '';

    this.isSavingAct = true;
    this.modalErrorAct = null;

    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    this.http.post(`${BASE_URL}/actividades_diarias`, this.newAct, { headers })
      .pipe(finalize(() => { this.isSavingAct = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          const correo = this.newAct!.correo_electronico;
          this.closeNewActModal();
          if (correo) this.loadActividadesFor(correo);
        },
        error: (err) => {
          console.error('Error creando actividad:', err);
          this.modalErrorAct = (err?.error?.error) || 'No se pudo crear la actividad.';
        }
      });
  }
}
