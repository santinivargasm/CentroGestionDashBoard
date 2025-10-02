import {
  Component,
  OnInit,
  AfterViewInit,
  TemplateRef,
  ElementRef,
  ChangeDetectorRef,
  ViewChild
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';

// Angular Material
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

// Forms para [(ngModel)]
import { FormsModule } from '@angular/forms';

// Chart.js
import { Chart } from 'chart.js/auto';
import type { Chart as ChartJS } from 'chart.js';

const BASE_URL = 'http://127.0.0.1:5000/api';

interface HistoriaDeUsuario {
  id_historia?: number;
  nombre_historia: string;
  descripcion: string;
  estado: string;
  fase: string;
  responsable?: string | null;
  fecha_inicio: string | Date | null;
  fecha_fin: string | Date | null;
  id_iniciativa: number | null;
  validacion_fase_1: string | boolean | null;
  validacion_fase_2: string | boolean | null;
  validacion_fase_n: string | boolean | null;
}

type ActividadAPI = {
  id_actividad: number;
  id_iniciativa: number | null;
  id_historia?: number | null;
  nombre_actividad: string;
  descripcion?: string | null;
  tipo_actividad: string;
  periodicidad: string;
  tiempo_empleado_minutos?: number;
  costo_operativo?: number | null;
  porcentaje_automatizacion?: number | null;
  herramienta?: string | null;
  ruta_acceso?: string | null;
  correo_responsable?: string | null;
  carga_minutos?: number;
  herramientas?: string | null;
  fecha?: string | Date | null;
  correo_electronico?: string | null;
};

type Actividad = {
  id_actividad: number;
  id_iniciativa: number | null;
  id_historia: number | null;
  nombre_actividad: string;
  descripcion: string;
  tipo_actividad: string;
  periodicidad: string;
  fecha: Date | null;
  carga_minutos: number;
  costo_operativo: number;
  porcentaje_automatizacion: number;
  herramientas: string;
  correo_electronico: string | null;
};

@Component({
  selector: 'app-history-user',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule, // <- NECESARIO para [(ngModel)]
    MatInputModule,
    MatButtonModule,
    MatTableModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
    MatDialogModule
  ],
  templateUrl: './history-user.component.html',
  styleUrls: ['./history-user.component.css']
})
export class HistoryUserComponent implements OnInit, AfterViewInit {
  historiaForm!: FormGroup;
  historias: HistoriaDeUsuario[] = [];
  cargando = false;
  error: string | null = null;
  idIniciativa: number | null = null;

  private dialogRef?: MatDialogRef<any>;
  private prevState: any;

  // ====== ANALÍTICA / ACTIVIDADES ======
  actividades: Actividad[] = [];
  actividadesFiltradas: Actividad[] = [];

  // KPIs visibles en el HTML
  totalMinutos = 0;
  totalCosto = 0;
  promedioAutomatizacion = 0;

  // Filtros fecha visibles en el HTML
  dateFrom = '';
  dateTo = '';

  // Charts
  private paretoChart?: ChartJS;
  private pieTipoChart?: ChartJS<'pie', number[], string>;
  private doughPeriodicidadChart?: ChartJS<'doughnut', number[], string>;
  private barHerramientaChart?: ChartJS<'bar', number[], string>;

  // Canvas refs (via @ViewChild)
  @ViewChild('paretoCanvas') paretoCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieTipoCanvas') pieTipoCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('doughPeriodicidadCanvas') doughPeriodicidadCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('barHerramientaCanvas') barHerramientaCanvas?: ElementRef<HTMLCanvasElement>;

  private chartsReady = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  // ===== Ciclo de vida =====
  ngOnInit(): void {
    this.prevState = history.state;
    this.initForm();

    const routeId = this.route.snapshot.paramMap.get('id');
    const queryId = this.route.snapshot.queryParamMap.get('id');
    const raw = routeId ?? queryId ?? this.prevState?.iniciativa?.id_iniciativa;
    this.idIniciativa = raw ? Number(raw) : null;

    if (this.idIniciativa && !Number.isNaN(this.idIniciativa)) {
      this.obtenerHistorias(this.idIniciativa);
      this.getActividadesByIniciativa(this.idIniciativa);
    }
  }

  ngAfterViewInit(): void {
    this.chartsReady = true;
    // Si ya cargamos actividades, renderizamos
    if (this.actividades.length) {
      this.destroyCharts();
      // Permite que los canvas se pinten correctamente
      setTimeout(() => this.renderCharts(), 0);
    }
  }

  // ===== Helpers =====
  private toISODate(value: string | Date | null | undefined): string | null {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    const s = String(value).trim();
    if (!s) return null;
    if (s.includes('T')) return s.split('T', 1)[0];
    if (s.includes(' ')) return s.split(' ', 1)[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return null;
  }
  private parseDateOrNull(v: any): Date | null {
    if (!v) return null;
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? null : d;
  }

  private normalizeActividad(r: ActividadAPI): Actividad {
    const minutos = (r.carga_minutos ?? r.tiempo_empleado_minutos ?? 0) || 0;
    const costo = (r.costo_operativo ?? 0) || 0;
    const pctAuto = (r.porcentaje_automatizacion ?? 0) || 0;
    const herramientas = (r.herramientas ?? r.herramienta ?? '') || '';
    const correo = (r.correo_electronico ?? r.correo_responsable ?? null);

    return {
      id_actividad: r.id_actividad,
      id_iniciativa: r.id_iniciativa ?? null,
      id_historia: (r.id_historia ?? null) as number | null,
      nombre_actividad: r.nombre_actividad,
      descripcion: (r.descripcion ?? '') || '',
      tipo_actividad: r.tipo_actividad,
      periodicidad: r.periodicidad,
      fecha: this.parseDateOrNull((r as any).fecha),
      carga_minutos: Number(minutos),
      costo_operativo: Number(costo),
      porcentaje_automatizacion: Number(pctAuto),
      herramientas: String(herramientas),
      correo_electronico: correo
    };
  }
  private normalizeRows(rows: ActividadAPI[]): Actividad[] {
    return (rows ?? []).map(this.normalizeActividad.bind(this));
  }

  // ===== Form historias =====
  initForm(): void {
    this.historiaForm = this.fb.group({
      nombre_historia: [''],
      descripcion: [''],
      estado: ['Pendiente'],
      fase: [''],
      responsable: [''],
      fecha_inicio: [''],
      fecha_fin: [''],
      id_iniciativa: [this.idIniciativa],
      validacion_fase_1: [false],
      validacion_fase_2: [false],
      validacion_fase_n: [false]
    });
  }

  // ---------- POPUP ----------
  openDialog(tpl: TemplateRef<any>): void {
    this.historiaForm.reset({
      id_iniciativa: this.idIniciativa,
      estado: 'Pendiente',
      validacion_fase_1: false,
      validacion_fase_2: false,
      validacion_fase_n: false
    });
    this.dialogRef = this.dialog.open(tpl, {
      width: '1100px',
      maxWidth: '96vw',
      autoFocus: false,
      restoreFocus: false
    });
  }
  closeDialog(): void { this.dialogRef?.close(); }

  // ---------- ATRÁS ----------
  volver(): void {
    this.router.navigate(['/dashboard'], {
      state: {
        reopenModal: true,
        colaborador: this.prevState?.colaborador || null,
        iniciativa: this.prevState?.iniciativa || (this.idIniciativa ? { id_iniciativa: this.idIniciativa } : null)
      }
    });
  }

  private normalizeRow(h: any): HistoriaDeUsuario {
    return {
      ...h,
      fecha_inicio: this.toISODate(h?.fecha_inicio),
      fecha_fin: this.toISODate(h?.fecha_fin),
      validacion_fase_1: h?.validacion_fase_1,
      validacion_fase_2: h?.validacion_fase_2,
      validacion_fase_n: h?.validacion_fase_n
    };
  }

  crearHistoria(): void {
    const raw = this.historiaForm.value as Partial<HistoriaDeUsuario>;
    const historia = {
      ...raw,
      estado: raw.estado && String(raw.estado).trim() ? raw.estado : 'Pendiente',
      fecha_inicio: this.toISODate(raw.fecha_inicio),
      fecha_fin: this.toISODate(raw.fecha_fin)
    };

    this.http.post(`${BASE_URL}/historias_usuario`, historia).subscribe({
      next: () => {
        if (historia.id_iniciativa) this.obtenerHistorias(Number(historia.id_iniciativa));
        this.closeDialog();
      },
      error: (err) => {
        console.error('Error al crear historia', err);
        this.error = err?.error?.error || 'No se pudo crear la historia.';
      }
    });
  }

  obtenerHistorias(id_iniciativa: number): void {
    this.cargando = true; this.error = null;
    this.http.get<HistoriaDeUsuario[]>(`${BASE_URL}/historias_usuario/${id_iniciativa}`)
      .subscribe({
        next: (rows) => {
          this.historias = (rows || []).map(r => this.normalizeRow(r));
          this.cargando = false;
        },
        error: (err) => {
          console.error('Error al obtener historias', err);
          this.error = err?.error?.error || 'No se pudo cargar historias.';
          this.historias = [];
          this.cargando = false;
        }
      });
  }

  // ================== ACTIVIDADES / ANÁLISIS ==================
  private getActividadesByIniciativa(id_iniciativa: number) {
    this.http.get<ActividadAPI[]>(`${BASE_URL}/actividades_por_iniciativa/${id_iniciativa}`)
      .subscribe({
        next: (rows) => {
          this.actividades = this.normalizeRows(rows);
          this.applyFiltersAndCompute(true);
        },
        error: (err) => {
          console.error('Error cargando actividades por iniciativa:', err);
          this.actividades = [];
          this.applyFiltersAndCompute(true);
        }
      });
  }

  // ==== Filtros por fecha ====
  private toEpochUTC(v: string | Date): number { const d = (v instanceof Date) ? v : new Date(v); return d.getTime(); }
  private ymdToEpochStart(ymd: string): number { const [y,m,d]=ymd.split('-').map(Number); return Date.UTC(y, m-1, d, 0,0,0,0); }
  private ymdToEpochEnd(ymd: string): number { const [y,m,d]=ymd.split('-').map(Number); return Date.UTC(y, m-1, d, 23,59,59,999); }

  setDatePreset(preset: 'hoy' | '7d' | '30d' | 'todo') {
    const now = new Date();
    const toYMD = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    if (preset === 'todo') { this.dateFrom = ''; this.dateTo = ''; }
    else if (preset === 'hoy') { const ymd = toYMD(now); this.dateFrom = ymd; this.dateTo = ymd; }
    else if (preset === '7d') { const from = new Date(now); from.setDate(from.getDate() - 6); this.dateFrom = toYMD(from); this.dateTo = toYMD(now); }
    else if (preset === '30d') { const from = new Date(now); from.setDate(from.getDate() - 29); this.dateFrom = toYMD(from); this.dateTo = toYMD(now); }

    this.applyFiltersAndCompute(true);
  }

  onDateInputsChanged() { this.applyFiltersAndCompute(true); }
  onApplyDateFilter() { this.applyFiltersAndCompute(true); }

  private applyFiltersAndCompute(repaint = false) {
    if (this.dateFrom && this.dateTo && this.dateFrom > this.dateTo) { const t=this.dateFrom; this.dateFrom=this.dateTo; this.dateTo=t; }

    let filtered = this.actividades.slice();

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

    this.actividadesFiltradas = filtered;

    // KPIs
    this.totalMinutos = filtered.reduce((a,b)=>a + (b.carga_minutos||0), 0);
    this.totalCosto   = filtered.reduce((a,b)=>a + (b.costo_operativo||0), 0);
    const validAuto   = filtered.filter(x => Number.isFinite(x.porcentaje_automatizacion));
    this.promedioAutomatizacion = validAuto.length
      ? +(validAuto.reduce((a,b)=>a+(b.porcentaje_automatizacion||0),0) / validAuto.length).toFixed(1)
      : 0;

    if (repaint && this.chartsReady) {
      this.destroyCharts();
      // Espera un tick por si los canvas aún no están en DOM
      setTimeout(() => this.renderCharts(), 0);
    }
  }

  // ======= Charts helpers =======
  private destroyCharts() {
    this.paretoChart?.destroy(); this.paretoChart = undefined;
    this.pieTipoChart?.destroy(); this.pieTipoChart = undefined;
    this.doughPeriodicidadChart?.destroy(); this.doughPeriodicidadChart = undefined;
    this.barHerramientaChart?.destroy(); this.barHerramientaChart = undefined;
  }

  private groupSum<T extends Record<string, any>>(rows: T[], key: (r: T) => string, val: (r: T) => number) {
    const map = new Map<string, number>();
    rows.forEach(r => {
      const k = (key(r) || '(sin dato)').trim();
      map.set(k, (map.get(k) || 0) + (val(r) || 0));
    });
    return Array.from(map.entries()).map(([k,v])=>({key:k,value:v})).sort((a,b)=>b.value-a.value);
  }
  private buildPalette(n: number): string[] {
    const PALETTE = ['#00a1a1','#FFB600','#008f8f','#1d2530','#14b8a6','#0ea5e9','#64748b','#ef4444','#84cc16','#a855f7','#ec4899','#f97316'];
    const out: string[] = [];
    for (let i=0;i<n;i++) out.push(PALETTE[i % PALETTE.length]);
    return out;
  }

  private renderCharts(): boolean {
    const paretoEl = this.paretoCanvas?.nativeElement;
    const pieTipoEl = this.pieTipoCanvas?.nativeElement;
    const doughEl = this.doughPeriodicidadCanvas?.nativeElement;
    const barHerrEl = this.barHerramientaCanvas?.nativeElement;
    if (!paretoEl || !pieTipoEl || !doughEl || !barHerrEl) return false;

    // PARETO
    const byAct = this.groupSum(this.actividadesFiltradas, x => x.nombre_actividad, x => x.carga_minutos);
    const labelsPareto = byAct.map(x=>x.key);
    const valores = byAct.map(x=>x.value);
    const total = valores.reduce((a,b)=>a+b,0);
    const acumuladoPct = valores.map((v,i)=> {
      const sum = valores.slice(0,i+1).reduce((a,b)=>a+b,0);
      return total ? +(((sum/total)*100).toFixed(2)) : 0;
    });

    const UMBRAL_MINUTOS = 44 * 60;
    const maxBar = Math.max(...valores, 0);
    const yMax = Math.max(UMBRAL_MINUTOS, Math.ceil(maxBar * 1.2));

    this.paretoChart = new Chart(paretoEl, {
      type: 'bar',
      data: {
        labels: labelsPareto,
        datasets: [
          { type: 'bar', label: 'Minutos', data: valores, backgroundColor: 'rgba(13,148,136,0.65)', borderColor: '#0f766e', borderWidth: 1, yAxisID: 'y', order: 1 },
          { type: 'line', label: `Umbral 44h (${UMBRAL_MINUTOS} min)`, data: new Array(labelsPareto.length).fill(UMBRAL_MINUTOS), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.15)', borderDash: [6,6], pointRadius: 0, yAxisID: 'y', order: 3 },
          { type: 'line', label: 'Acumulado (%)', data: acumuladoPct, borderColor: '#FFB600', backgroundColor: 'rgba(255,182,0,0.15)', tension: 0.3, yAxisID: 'y1', order: 2 },
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

    // PIE tipo
    const byTipo = this.groupSum(this.actividadesFiltradas, x => x.tipo_actividad, x => x.carga_minutos);
    this.pieTipoChart = new Chart(pieTipoEl, {
      type: 'pie',
      data: {
        labels: byTipo.map(x=>x.key),
        datasets: [{ label:'Minutos', data: byTipo.map(x=>x.value), backgroundColor: this.buildPalette(byTipo.length), borderColor:'#fff', borderWidth:2, hoverOffset:8 }]
      },
      options: { maintainAspectRatio: false, plugins: { legend: { position:'bottom', labels:{ color:'#111827' } } } }
    });

    // DOUGH periodicidad
    const byPer = this.groupSum(this.actividadesFiltradas, x => x.periodicidad, x => x.carga_minutos);
    this.doughPeriodicidadChart = new Chart(doughEl, {
      type: 'doughnut',
      data: {
        labels: byPer.map(x=>x.key),
        datasets: [{ label:'Minutos', data: byPer.map(x=>x.value), backgroundColor: this.buildPalette(byPer.length), borderColor:'#fff', borderWidth:2, hoverOffset:8 }]
      },
      options: { maintainAspectRatio:false, cutout:'55%', plugins:{ legend:{ position:'bottom', labels:{ color:'#111827' } } } }
    });

    // BARRAS herramienta (si vienen múltiples herramientas separadas por coma, tomamos la primera)
    const byHerr = this.groupSum(
      this.actividadesFiltradas,
      x => (x.herramientas || '').split(',')[0].trim() || '(sin herramienta)',
      x => x.carga_minutos
    );

    this.barHerramientaChart = new Chart(barHerrEl, {
      type: 'bar',
      data: {
        labels: byHerr.map(x=>x.key),
        datasets: [{ label:'Minutos', data: byHerr.map(x=>x.value), backgroundColor:'rgba(20,184,166,0.6)', borderColor:'#0f766e', borderWidth:1 }]
      },
      options: {
        maintainAspectRatio:false,
        plugins:{ legend:{ position:'top', labels:{ color:'#111827' } } },
        scales:{
          x:{ ticks:{ color:'#111827', autoSkip:true, maxRotation:0 }},
          y:{ ticks:{ color:'#111827' }, title:{ display:true, text:'Minutos' } }
        }
      }
    });

    return true;
  }
}
