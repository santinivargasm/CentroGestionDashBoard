import { Component, OnDestroy, OnInit, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { EmailSessionService } from '../../core/email-session.service';

type Colaborador = {
  nombre: string;
  celular: string;
  correo_electronico: string;
  vicepresidencia: string;
  gerencia: string;
  direccion_area: string;
  nombre_jefe_inmediato: string;
  correo_jefe_inmediato: string;
  nombre_jefe_inmediato_2: string;
  correo_jefe_inmediato_2: string;
};

type Iniciativa = {
  id_iniciativa: number;
  nombre_iniciativa: string;
  descripcion_iniciativa: string;
  estado_iniciativa: string;
  avance: number;
  correo_electronico: string;
  tipo_actividad: string;
  periodicidad: string;
  carga_minutos: number;
  herramientas?: string;
};

type Actividad = {
  id_actividad: number;
  fecha: string;
  nombre_actividad: string;
  descripcion?: string;
  tipo_actividad: string;
  periodicidad: string;
  carga_minutos: number;
  herramientas?: string;
  id_historia?: number;
  id_iniciativa?: number;
  correo_electronico: string;
  correo_electronico_buckup?: string;
};

type OpcionCorreo = {
  correo: string;
  etiqueta: string;
  rol: string; // 'colaborador' | 'jefe1' | 'jefe2'
};

// ==== EasyAuth (/._auth/me) ====
type EasyAuthClaim = { typ: string; val: string };
type EasyAuthEntry = {
  user_id: string;
  provider_name: string;
  user_claims: EasyAuthClaim[];
  access_token?: string;
  id_token?: string;
  expires_on?: string;
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './dashboard.html'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private session = inject(EmailSessionService);

  private API = 'https://hubai.azurewebsites.net';
  private subs: Subscription[] = [];

  // Orquestación (modal)
  mostrarSelectorCorreo = false;
  correoSeleccionado = '';

  // actor vs viewer
  private get actorCorreo(): string {
    return (this.session.getEmail() || '').trim().toLowerCase();
  }
  viewerCorreo = '';

  // Datos
  opcionesColaborador: OpcionCorreo[] = [];
  colaborador: Colaborador | null = null;
  iniciativas: Iniciativa[] = [];
  actividades: Actividad[] = [];
  subordinados: Array<{ nombre: string; correo_electronico: string }> = [];

  // === Nuevo: user_id y nombre expuestos desde /.auth/me ===
  public userId: string = '';
  public nombreUsuario: string = '';
  public rolUsuario: string = '';

  // Negocio
  private WORKDAYS_PER_WEEK = 5;
  private WEEKS_PER_MONTH = 4.33;
  thresholdHoras = 44;
  get thresholdMinutos(): number { return this.thresholdHoras * 60; }
  get thresholdMensualMin(): number { return Math.round(this.thresholdMinutos * this.WEEKS_PER_MONTH); }

  // KPIs
  totalMinutos = 0;
  totalMinutosMensual = 0;

  // Datasets
  paretoLabels: string[] = [];
  paretoMinutos: number[] = [];
  tipoLabels: string[] = [];
  tipoMinutos: number[] = [];
  perLabels: string[] = [];
  perMinutos: number[] = [];
  herrLabels: string[] = [];
  herrMinutos: number[] = [];
  distSemLabels: string[] = [];
  distSemValues: number[] = [];
  distMesLabels: string[] = [];
  distMesValues: number[] = [];
  topCandidatos: Array<{ nombre: string; minutos: number; score: number; impacto: number }> = [];

  // Chart.js
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ChartLib: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private chartRefs: Record<string, any> = {};

  // Paleta
  private PALETTE = { teal: '#0D9488', tealDark: '#0F766E', tealLight: '#5EEAD4', amber: '#F59E0B', gray900: '#111827', grid: '#E5E7EB' };
  private colorList(n: number): string[] {
    const base = [this.PALETTE.teal, this.PALETTE.amber, this.PALETTE.tealDark, '#10B981', '#14B8A6', '#0EA5E9', '#F59E0B'];
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(base[i % base.length]);
    return out;
  }

  async ngOnInit(): Promise<void> {
    try {
      // Hidratar los datos del usuario desde el backend (get email, name, role)
      await this.session.hydrateFromWhoAmI();

      // Obtener el email y rol del usuario desde la sesión
      const email = this.session.getEmail() || '';  // Obtén el correo electrónico desde la sesión
      const role = this.session.getRole(); // Obtén el rol desde la sesión

      console.log('Email:', email);  // Muestra el correo del usuario
      console.log('Role:', role);    // Muestra el rol del usuario

      // Llamar al backend para obtener el rol usando el correo electrónico
      this.obtenerRolDelBackend(email);

      // Continuar con la lógica existente
      this.subs.push(
        this.session.emailChanges().subscribe((correo: string | null) => {
          if (correo) {
            this.mostrarSelectorCorreo = false;
            this.viewerCorreo = (correo || '').trim().toLowerCase();
            this.cargarSubordinadosDelActor();
            this.cargarColaborador(this.viewerCorreo);
            this.cargarIniciativas(this.viewerCorreo);
          } else {
            this.mostrarSelectorCorreo = true;
            this.cargarOpcionesColaborador();
          }
        })
      );

      await this.cargarEasyAuthFront();

      const actual = this.session.getEmail();
      if (actual) {
        this.viewerCorreo = (actual || '').trim().toLowerCase();
        this.cargarSubordinadosDelActor();
        this.cargarColaborador(this.viewerCorreo);
        this.cargarIniciativas(this.viewerCorreo);
      } else {
        this.mostrarSelectorCorreo = true;
        this.cargarOpcionesColaborador();
      }

      // Cargar el gráfico y otras funcionalidades
      const mod = await import('chart.js/auto');
      this.ChartLib = (mod as any).default || (mod as any);
      this.recomputeAndRender();
    } catch (error) {
      console.error('Error al hidratar los datos del usuario', error);
    }
  }


  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.destroyCharts();
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
  }

  private async cargarEasyAuthFront(): Promise<void> {
    try {
      const me = await this.http.get<EasyAuthEntry[]>('/.auth/me', { withCredentials: true }).toPromise();
      const entry = me?.[0];
      if (!entry) return;

      // user_id directo del JSON
      this.userId = entry.user_id || '';

      // Claims en Map
      const claims = new Map(entry.user_claims?.map(c => [c.typ, c.val]) || []);

      // Email preferido (normalizado a minúsculas)
      const correo = (
        claims.get('preferred_username') ||
        claims.get('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress') ||
        ''
      ).toLowerCase();

      // Nombre del usuario
      this.nombreUsuario = claims.get('name') || '';

      // ⬇️⬇️⬇️ CAMBIO CLAVE: SIEMPRE sobreescribe la sesión con el login ⬇️⬇️⬇️
      this.session.setUserId(this.userId || correo);
      this.session.setNombre(this.nombreUsuario || correo);
      if (correo) {
        this.session.setEmail(correo);     // <-- ya no es condicional
        this.viewerCorreo = correo;        // opcional; la suscripción igual lo setea
      }

      console.log('[EasyAuth]', {
        userId: this.userId,
        correo,
        nombre: this.nombreUsuario,
        provider: entry.provider_name
      });
    } catch (err) {
      console.warn('No se pudo leer /.auth/me (¿no logueado todavía?):', err);
    }
  }

  private obtenerRolDelBackend(correo: string): void {
    if (!correo) return;

    this.http.get<{ ok: boolean; correo?: string; rol?: string | null }>(`${this.API}/api/rol/${encodeURIComponent(correo)}`).subscribe({
      next: (response) => {
        console.log('Respuesta del backend:', response);  // Verifica la respuesta del backend
        if (response.ok) {
          const rol: string | null = response.rol ?? null;  // Si rol es undefined, asigna null
          console.log('Rol obtenido:', rol);  // Verifica el rol obtenido
          this.session.setRole(rol);  // Guarda el rol en la sesión
          if (rol === 'administrador') {
            console.log('Usuario es administrador');
          }
        } else {
          console.error('Error al obtener el rol');
        }
      },
      error: (err) => {
        console.error('Error al hacer la solicitud del rol', err);
      }
    });

  }




  // ============ RESIZE (repinta con debounce) ============
  private resizeTimer: any = null;
  @HostListener('window:resize') _onWindowResize(): void {
    if (!this.ChartLib) return;
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.renderCharts(), 180);
  }

  // ===== Modales / sesión =====
  abrirSelectorCorreo(): void {
    this.mostrarSelectorCorreo = true;
    if (!this.opcionesColaborador.length) this.cargarOpcionesColaborador();
    this.correoSeleccionado = this.session.getEmail() || '';
  }
  cancelarSelector(): void {
    if (!this.session.getEmail()) return;
    this.mostrarSelectorCorreo = false;
  }
  confirmarSelector(): void {
    const correo = (this.correoSeleccionado || '').trim();
    if (!correo) return;
    this.session.setEmail(correo);
    this.mostrarSelectorCorreo = false;
  }

  private cargarOpcionesColaborador(): void {
    this.http.get<OpcionCorreo[]>(`${this.API}/api/correos_select`).subscribe({
      next: rows => this.opcionesColaborador = (rows || []).filter(r => (r?.correo || '').trim() !== ''),
      error: err => console.error('Error listando correos_select:', err)
    });
  }

  private cargarSubordinadosDelActor(): void {
    const actor = this.actorCorreo;
    if (!actor) {
      this.subordinados = [];
      return;
    }
    this.http
      .get<Array<{ nombre: string; correo_electronico: string }>>(
        `${this.API}/api/subordinados_de/${encodeURIComponent(actor)}`
      )
      .subscribe({
        next: rows => {
          const yo = { nombre: 'Yo', correo_electronico: actor };
          const clean = (rows || []).filter(r => (r?.correo_electronico || '').trim() !== '');
          this.subordinados = [yo, ...clean];
        },
        error: _ => { this.subordinados = []; }
      });
  }

  private cargarColaborador(correo: string): void {
    this.http.get<Colaborador[]>(`${this.API}/api/colaborador/${encodeURIComponent(correo)}`).subscribe({
      next: rows => this.colaborador = rows && rows.length ? rows[0] : null,
      error: err => console.error('Error obteniendo colaborador:', err)
    });
  }

  private cargarIniciativas(correo: string): void {
    this.http.get<Iniciativa[]>(`${this.API}/api/iniciativas_por_correo/${encodeURIComponent(correo)}`).subscribe({
      next: rows => {
        this.iniciativas = rows || [];
        this.recomputeAndRender();
      },
      error: err => console.error('Error obteniendo iniciativas:', err)
    });
  }

  onChangeViewer(correoEmpleado: string): void {
    const c = (correoEmpleado || '').trim().toLowerCase();
    if (!c || c === this.viewerCorreo) return;
    this.viewerCorreo = c;
    this.cargarColaborador(this.viewerCorreo);
    this.cargarIniciativas(this.viewerCorreo);
  }

  private weekFactor(p: string): number {
    const v = (p || '').toLowerCase().trim();
    if (/diar/i.test(v)) return this.WORKDAYS_PER_WEEK;
    if (/semanal|weekly|semana/.test(v)) return 1;
    if (/quincenal/.test(v)) return 0.5;
    if (/mensual|month/.test(v)) return 1 / this.WEEKS_PER_MONTH;
    if (/bimestral/.test(v)) return 1 / (2 * this.WEEKS_PER_MONTH);
    if (/trimestral/.test(v)) return 1 / 3;
    if (/semestral/.test(v)) return 1 / 6;
    if (/anual|a\u00f1o/.test(v)) return 1 / 52;
    if (/ad.?hoc|puntual|eventual/.test(v)) return 0;
    return 0;
  }

  private monthFactor(p: string): number {
    const v = (p || '').toLowerCase().trim();
    if (/diar/i.test(v)) return this.WORKDAYS_PER_WEEK * this.WEEKS_PER_MONTH;
    if (/semanal|weekly|semana/.test(v)) return this.WEEKS_PER_MONTH;
    if (/quincenal/.test(v)) return 2;
    if (/mensual|month/.test(v)) return 1;
    if (/bimestral/.test(v)) return 0.5;
    if (/trimestral/.test(v)) return 1 / 3;
    if (/semestral/.test(v)) return 1 / 6;
    if (/anual|a\u00f1o/.test(v)) return 1 / 12;
    if (/ad.?hoc|puntual|eventual/.test(v)) return 0;
    return 0;
  }

  private isActiva(estado: string): boolean {
    const v = (estado || '').toLowerCase().trim();
    if (/finalizad|cerrad|completad|cancelad/.test(v)) return false;
    return true;
  }

  private recomputeAndRender(): void {
    this.calcularMetricas();
    this.renderCharts();
  }

  // ====== MÉTRICAS ======
  private calcularMetricas(): void {
    const activas = this.iniciativas.filter(it => this.isActiva(it.estado_iniciativa));
    const activeIds = new Set(activas.map(x => x.id_iniciativa));
    const actsValid = (this.actividades || []).filter(a => a.id_iniciativa && activeIds.has(Number(a.id_iniciativa)));

    const semByInitActs = new Map<string, number>();
    const mesByInitActs = new Map<string, number>();

    for (const a of actsValid) {
      const min = Number(a.carga_minutos) || 0;
      const w = Math.round(min * this.weekFactor(a.periodicidad));
      const m = Math.round(min * this.monthFactor(a.periodicidad));
      const inicName = activas.find(x => x.id_iniciativa === a.id_iniciativa)?.nombre_iniciativa || `ID ${a.id_iniciativa}`;
      semByInitActs.set(inicName, (semByInitActs.get(inicName) || 0) + w);
      mesByInitActs.set(inicName, (mesByInitActs.get(inicName) || 0) + m);
    }

    const totalSemActs = Array.from(semByInitActs.values()).reduce((a, b) => a + b, 0);
    const totalMesActs = Array.from(mesByInitActs.values()).reduce((a, b) => a + b, 0);
    const useActivities = totalSemActs > 0 || totalMesActs > 0;

    const tipoAgg = new Map<string, number>();
    const perAgg = new Map<string, number>();
    const herrAgg = new Map<string, number>();
    let paretoPairs: Array<{ nombre: string; minutos: number }> = [];

    if (useActivities) {
      this.totalMinutos = totalSemActs;
      this.totalMinutosMensual = totalMesActs;

      this.distSemLabels = [...semByInitActs.keys()];
      this.distSemValues = this.distSemLabels.map(k => semByInitActs.get(k) || 0);

      this.distMesLabels = [...mesByInitActs.keys()];
      this.distMesValues = this.distMesLabels.map(k => mesByInitActs.get(k) || 0);

      paretoPairs = this.distSemLabels
        .map((n, i) => ({ nombre: n, minutos: this.distSemValues[i] }))
        .sort((a, b) => b.minutos - a.minutos);

      for (const a of actsValid) {
        const val = Math.round((Number(a.carga_minutos) || 0) * this.weekFactor(a.periodicidad));
        const t = (a.tipo_actividad || 'Sin tipo').trim();
        tipoAgg.set(t, (tipoAgg.get(t) || 0) + val);

        const p = (a.periodicidad || '—').trim();
        perAgg.set(p, (perAgg.get(p) || 0) + val);

        const tools = (a.herramientas || '').split(/[,;|/]/).map(x => x.trim()).filter(Boolean);
        if (tools.length === 0) herrAgg.set('Sin especificar', (herrAgg.get('Sin especificar') || 0) + val);
        else for (const h of tools) herrAgg.set(h, (herrAgg.get(h) || 0) + val);
      }

      const score = (it: Iniciativa): number => {
        const freqWeight = (s: string): number => {
          const v = (s || '').toLowerCase();
          const map: Record<string, number> = {
            'diaria': 1.0, 'diario': 1.0,
            'semanal': 0.85, 'weekly': 0.85,
            'quincenal': 0.75, 'mensual': 0.65, 'bimestral': 0.55, 'trimestral': 0.5,
            'semestral': 0.45, 'anual': 0.35, 'ad-hoc': 0.3, 'puntual': 0.3, 'eventual': 0.3
          };
          return map[v] ?? 0.6;
        };
        const tipoWeight = (s: string): number => {
          const v = (s || '').toLowerCase();
          if (/(reporte|consolidaci|validaci|carga|env[ií]o|etl|extract|transform|load)/.test(v)) return 1.0;
          if (/(soporte|operaci|seguimiento|monitoreo)/.test(v)) return 0.8;
          if (/(sql|excel)/.test(v)) return 0.85;
          if (/(desarrollo|proyecto|diseño|model)/.test(v)) return 0.5;
          if (/(an[aá]lisi)/.test(v)) return 0.45;
          return 0.6;
        };
        const herramientaWeight = (s: string | undefined): number => {
          const t = (s || '').toLowerCase();
          const tokens = t.split(/[,;|/]/).map(x => x.trim()).filter(Boolean);
          let w = 0.6;
          for (const h of tokens) {
            if (/excel|csv|outlook|correo|word/.test(h)) w = Math.max(w, 1.0);
            else if (/sharepoint|forms|power\s*apps/.test(h)) w = Math.max(w, 0.7);
            else if (/powerbi|bi/.test(h)) w = Math.max(w, 0.6);
            else if (/sql|sql server|postgres|duckdb/.test(h)) w = Math.max(w, 0.8);
            else if (/python|rpa|ui\s*path|automation/.test(h)) w = Math.max(w, 0.5);
          }
          return w;
        };
        const s = (freqWeight(it.periodicidad) * 0.5) + (tipoWeight(it.tipo_actividad) * 0.3) + (herramientaWeight(it.herramientas) * 0.2);
        return Math.round(Math.min(1, s) * 100);
      };

      const mapInicByName = new Map(activas.map(x => [x.nombre_iniciativa || `ID ${x.id_iniciativa}`, x]));
      const candidates = paretoPairs.map(p => {
        const inic = mapInicByName.get(p.nombre);
        const sc = inic ? score(inic) : 60;
        return { nombre: p.nombre, minutos: p.minutos, score: sc, impacto: p.minutos * (sc / 100) };
      }).sort((a, b) => b.impacto - a.impacto);

      this.topCandidatos = candidates.slice(0, 5);
      this.paretoLabels = paretoPairs.map(x => x.nombre);
      this.paretoMinutos = paretoPairs.map(x => x.minutos);
      this.tipoLabels = [...tipoAgg.keys()];
      this.tipoMinutos = this.tipoLabels.map(k => tipoAgg.get(k) || 0);
      this.perLabels = [...perAgg.keys()];
      this.perMinutos = this.perLabels.map(k => perAgg.get(k) || 0);
      this.herrLabels = [...herrAgg.keys()];
      this.herrMinutos = this.herrLabels.map(k => herrAgg.get(k) || 0);
    } else {
      const semanalByInit = activas.map(it => ({
        nombre: it.nombre_iniciativa || `ID ${it.id_iniciativa}`,
        minutos: Math.round((Number(it.carga_minutos) || 0) * this.weekFactor(it.periodicidad))
      }));
      const mensualByInitPairs = activas.map(it => ({
        nombre: it.nombre_iniciativa || `ID ${it.id_iniciativa}`,
        minutos: Math.round((Number(it.carga_minutos) || 0) * this.monthFactor(it.periodicidad))
      }));

      this.totalMinutos = semanalByInit.reduce((a, x) => a + x.minutos, 0);
      this.totalMinutosMensual = mensualByInitPairs.reduce((a, x) => a + x.minutos, 0);

      this.distSemLabels = semanalByInit.map(x => x.nombre);
      this.distSemValues = semanalByInit.map(x => x.minutos);
      this.distMesLabels = mensualByInitPairs.map(x => x.nombre);
      this.distMesValues = mensualByInitPairs.map(x => x.minutos);

      const tipoAgg2 = new Map<string, number>();
      const perAgg2 = new Map<string, number>();
      const herrAgg2 = new Map<string, number>();

      for (const it of activas) {
        const val = Math.round((Number(it.carga_minutos) || 0) * this.weekFactor(it.periodicidad));
        const t = (it.tipo_actividad || 'Sin tipo').trim();
        tipoAgg2.set(t, (tipoAgg2.get(t) || 0) + val);

        const p = (it.periodicidad || '—').trim();
        perAgg2.set(p, (perAgg2.get(p) || 0) + val);

        const tools = (it.herramientas || '').split(/[,;|/]/).map(x => x.trim()).filter(Boolean);
        if (tools.length === 0) herrAgg2.set('Sin especificar', (herrAgg2.get('Sin especificar') || 0) + val);
        else for (const h of tools) herrAgg2.set(h, (herrAgg2.get(h) || 0) + val);
      }

      const score = (it: Iniciativa): number => {
        const v = (it.periodicidad || '').toLowerCase();
        const map: Record<string, number> = {
          'diaria': 1.0, 'diario': 1.0, 'semanal': 0.85, 'weekly': 0.85, 'quincenal': 0.75, 'mensual': 0.65,
          'bimestral': 0.55, 'trimestral': 0.5, 'semestral': 0.45, 'anual': 0.35, 'ad-hoc': 0.3, 'puntual': 0.3, 'eventual': 0.3
        };
        const freq = map[v] ?? 0.6;
        const t = (it.tipo_actividad || '').toLowerCase();
        let tipo = 0.6;
        if (/(reporte|consolidaci|validaci|carga|env[ií]o|etl|extract|transform|load)/.test(t)) tipo = 1.0;
        else if (/(soporte|operaci|seguimiento|monitoreo)/.test(t)) tipo = 0.8;
        else if (/(sql|excel)/.test(t)) tipo = 0.85;
        else if (/(desarrollo|proyecto|diseño|model)/.test(t)) tipo = 0.5;
        else if (/(an[aá]lisi)/.test(t)) tipo = 0.45;

        const tools = (it.herramientas || '').toLowerCase();
        let her = 0.6;
        if (/excel|csv|outlook|correo|word/.test(tools)) her = 1.0;
        else if (/sharepoint|forms|power\s*apps/.test(tools)) her = 0.7;
        else if (/powerbi|bi/.test(tools)) her = 0.6;
        else if (/sql|sql server|postgres|duckdb/.test(tools)) her = 0.8;
        else if (/python|rpa|ui\s*path|automation/.test(tools)) her = 0.5;

        const s = (freq * 0.5) + (tipo * 0.3) + (her * 0.2);
        return Math.round(Math.min(1, s) * 100);
      };

      const candidates = activas.map(it => {
        const minutos = Math.round((Number(it.carga_minutos) || 0) * this.weekFactor(it.periodicidad));
        const sc = score(it);
        return { nombre: it.nombre_iniciativa || `ID ${it.id_iniciativa}`, minutos, score: sc, impacto: minutos * (sc / 100) };
      }).sort((a, b) => b.impacto - a.impacto);

      this.topCandidatos = candidates.slice(0, 5);
      this.paretoLabels = candidates.map(x => x.nombre);
      this.paretoMinutos = candidates.map(x => x.minutos);
      this.tipoLabels = [...tipoAgg2.keys()];
      this.tipoMinutos = this.tipoLabels.map(k => tipoAgg2.get(k) || 0);
      this.perLabels = [...perAgg2.keys()];
      this.perMinutos = this.perLabels.map(k => perAgg2.get(k) || 0);
      this.herrLabels = [...herrAgg2.keys()];
      this.herrMinutos = this.herrLabels.map(k => herrAgg2.get(k) || 0);
    }
  }

  /** Toma el canvas por id, lo ajusta al tamaño del wrapper .cg-box y devuelve el contexto 2D */
  private prepareCanvas(id: string): CanvasRenderingContext2D | null {
    const el = document.getElementById(id) as HTMLCanvasElement | null;
    if (!el) return null;
    const box = el.parentElement as HTMLElement | null;
    const w = Math.max(200, box?.clientWidth ?? 200);
    const h = Math.max(150, box?.clientHeight ?? 150);
    el.width = w;
    el.height = h;
    (el.style as any).width = `${w}px`;
    (el.style as any).height = `${h}px`;
    return el.getContext('2d');
  }

  private destroyCharts(): void {
    Object.values(this.chartRefs).forEach(ch => {
      try { ch?.destroy(); } catch { }
    });
    this.chartRefs = {};
  }

  private renderCharts(): void {
    if (!this.ChartLib) return;
    this.destroyCharts();

    const C = this.ChartLib;
    const P = this.PALETTE;

    // Donut SEM
    const ctxSem = this.prepareCanvas('cgChartDistSem');
    if (ctxSem) {
      this.chartRefs['distSem'] = new C(ctxSem, {
        type: 'doughnut',
        data: {
          labels: this.distSemLabels,
          datasets: [{ data: this.distSemValues, backgroundColor: this.colorList(this.distSemLabels.length), borderWidth: 0 }]
        },
        options: { responsive: false, maintainAspectRatio: false, animation: false, cutout: '58%', plugins: { legend: { position: 'bottom' } } }
      });
    }

    // Donut MES
    const ctxMes = this.prepareCanvas('cgChartDistMes');
    if (ctxMes) {
      this.chartRefs['distMes'] = new C(ctxMes, {
        type: 'doughnut',
        data: {
          labels: this.distMesLabels,
          datasets: [{ data: this.distMesValues, backgroundColor: this.colorList(this.distMesLabels.length), borderWidth: 0 }]
        },
        options: { responsive: false, maintainAspectRatio: false, animation: false, cutout: '58%', plugins: { legend: { position: 'bottom' } } }
      });
    }

    // Pareto
    const ctxPareto = this.prepareCanvas('cgChartPareto');
    if (ctxPareto) {
      const labelsFull = this.paretoLabels;
      const maxMinutes = Math.max(this.thresholdMinutos, ...(this.paretoMinutos.length ? this.paretoMinutos : [0]));
      this.chartRefs['pareto'] = new C(ctxPareto, {
        type: 'bar',
        data: {
          labels: this.paretoLabels,
          datasets: [
            { type: 'bar', label: 'Min/sem', data: this.paretoMinutos, backgroundColor: P.teal, borderColor: P.tealDark, borderWidth: 1, maxBarThickness: 26, categoryPercentage: 0.8, barPercentage: 0.9 },
            { type: 'line', label: `Umbral ${this.thresholdHoras}h (${this.thresholdMinutos} min)`, data: this.paretoMinutos.map(() => this.thresholdMinutos), borderColor: P.amber, backgroundColor: P.amber, borderWidth: 2, pointRadius: 0, borderDash: [6, 4], yAxisID: 'y' }
          ]
        },
        options: {
          responsive: false, maintainAspectRatio: false, animation: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 10 } },
            tooltip: { mode: 'index', intersect: false, callbacks: { title: (items: any[]) => labelsFull[items[0].dataIndex] || '' } }
          },
          layout: { padding: { left: 4, right: 8, top: 4, bottom: 4 } },
          scales: {
            y: { beginAtZero: true, suggestedMax: Math.ceil(maxMinutes * 1.1), title: { display: true, text: 'Minutos por semana' } },
            x: { ticks: { autoSkip: true, maxRotation: 0, minRotation: 0 } }
          }
        }
      });
    }

    // Tipo
    const ctxTipo = this.prepareCanvas('cgChartTipo');
    if (ctxTipo) {
      this.chartRefs['tipo'] = new C(ctxTipo, {
        type: 'doughnut',
        data: {
          labels: this.tipoLabels,
          datasets: [{ label: 'Min/sem', data: this.tipoMinutos, backgroundColor: this.colorList(this.tipoLabels.length), borderWidth: 0 }]
        },
        options: { responsive: false, maintainAspectRatio: false, animation: false, cutout: '65%', plugins: { legend: { position: 'bottom' } } }
      });
    }

    // Periodicidad
    const ctxPer = this.prepareCanvas('cgChartPer');
    if (ctxPer) {
      this.chartRefs['per'] = new C(ctxPer, {
        type: 'bar',
        data: {
          labels: this.perLabels,
          datasets: [{ label: 'Min/sem', data: this.perMinutos, backgroundColor: this.colorList(this.perLabels.length).map(c => c === this.PALETTE.amber ? '#FBBF24' : c), borderColor: this.PALETTE.tealDark, borderWidth: 1 }]
        },
        options: { responsive: false, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    }

    // Herramientas
    const ctxHerr = this.prepareCanvas('cgChartHerr');
    if (ctxHerr) {
      this.chartRefs['herr'] = new C(ctxHerr, {
        type: 'bar',
        data: {
          labels: this.herrLabels,
          datasets: [{ label: 'Min/sem', data: this.herrMinutos, backgroundColor: this.colorList(this.herrLabels.length), borderWidth: 0 }]
        },
        options: { indexAxis: 'y', responsive: false, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
      });
    }
  }

  // Modales
  mostrarModalColaborador = false;
  abrirModalDetalles(): void { this.mostrarModalColaborador = true; }
  cerrarModalDetalles(): void { this.mostrarModalColaborador = false; }
  abrirModalNuevaIniciativa(): void { console.log('Abrir modal nueva iniciativa'); }
}
