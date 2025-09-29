import { Component, OnInit } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { CommonModule } from '@angular/common';

import { HttpClient, HttpClientModule } from '@angular/common/http';

import { ActivatedRoute } from '@angular/router';

// Angular Material

import { MatInputModule } from '@angular/material/input';

import { MatButtonModule } from '@angular/material/button';

import { MatTableModule } from '@angular/material/table';

import { MatFormFieldModule } from '@angular/material/form-field';

import { MatDatepickerModule } from '@angular/material/datepicker';

import { MatNativeDateModule } from '@angular/material/core';

import { MatCheckboxModule } from '@angular/material/checkbox';

const BASE_URL = 'http://127.0.0.1:5000/api';

interface HistoriaDeUsuario {

  id_historia?: number;

  nombre_historia: string;

  descripcion: string;

  estado: string;

  fase: string;

  responsable?: string;               // opcional si tu DB lo permite

  fecha_inicio: string | Date;

  fecha_fin: string | Date;

  id_iniciativa: number;

  validacion_fase_1: boolean;

  validacion_fase_2: boolean;

  validacion_fase_n: boolean;

}

@Component({

  selector: 'app-history-user',

  standalone: true,

  imports: [

    CommonModule,

    HttpClientModule,

    ReactiveFormsModule,

    MatInputModule,

    MatButtonModule,

    MatTableModule,

    MatFormFieldModule,

    MatDatepickerModule,

    MatNativeDateModule,

    MatCheckboxModule

  ],

  templateUrl: './history-user.component.html',

  styleUrls: ['./history-user.component.css']

})

export class HistoryUserComponent implements OnInit {

  historiaForm!: FormGroup;

  historias: HistoriaDeUsuario[] = [];

  displayedColumns: string[] = [

    'id_historia',

    'nombre_historia',

    'descripcion',

    'estado',

    'fase',

    'responsable',

    'fecha_inicio',

    'fecha_fin',

    'id_iniciativa',

    'validacion_fase_1',

    'validacion_fase_2',

    'validacion_fase_n'

  ];

  constructor(

    private fb: FormBuilder,

    private http: HttpClient,

    private route: ActivatedRoute

  ) { }

  ngOnInit(): void {

    this.initForm();

    // Lee el id de la URL: /historias/:id

    this.route.paramMap.subscribe(params => {

      const id = Number(params.get('id'));

      if (!Number.isNaN(id)) {

        this.obtenerHistorias(id);

        // precargar el id_iniciativa en el formulario

        this.historiaForm.patchValue({ id_iniciativa: id });

      }

    });

  }

  initForm(): void {

    this.historiaForm = this.fb.group({

      nombre_historia: [''],

      descripcion: [''],

      estado: ['Pendiente'],    // default

      fase: [''],

      responsable: [''],

      fecha_inicio: [''],

      fecha_fin: [''],

      id_iniciativa: [null],

      // Booleans

      validacion_fase_1: [false],

      validacion_fase_2: [false],

      validacion_fase_n: [false]

    });

  }

  private toISODate(value: string | Date): string | null {
    if (!value) return null;

    // Si es un Date válido → convertir a YYYY-MM-DD
    if (value instanceof Date && !isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }

    // Si ya es string → normalizar
    const s = String(value).trim();
    if (!s) return null;

    // Si viene con formato ISO → cortar al día
    if (s.includes('T')) {
      return s.split('T', 1)[0];
    }

    // Si ya está en YYYY-MM-DD lo dejamos igual
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return s;
    }

    return null; // fallback si no coincide
  }
  crearHistoria(): void {

    const raw = this.historiaForm.value as Partial<HistoriaDeUsuario>;

    const historia: any = {

      ...raw,

      estado: raw.estado && String(raw.estado).trim() ? raw.estado : 'Pendiente',

      fecha_inicio: this.toISODate(raw.fecha_inicio as any),

      fecha_fin: this.toISODate(raw.fecha_fin as any)

    };

    this.http.post<HistoriaDeUsuario>(`${BASE_URL}/historias_usuario`, historia)

      .subscribe({

        next: () => {

          console.log('Historia creada');

          if (historia.id_iniciativa) {

            this.obtenerHistorias(historia.id_iniciativa);

          }

          // reset conservando id_iniciativa y booleans a false

          this.historiaForm.reset({

            id_iniciativa: historia.id_iniciativa,

            estado: 'Pendiente',

            validacion_fase_1: false,

            validacion_fase_2: false,

            validacion_fase_n: false

          });

        },

        error: (err) => console.error('Error al crear historia', err)

      });

  }

  obtenerHistorias(id_iniciativa: number): void {

    this.http.get<HistoriaDeUsuario[]>(`${BASE_URL}/historias_usuario/${id_iniciativa}`)

      .subscribe({

        next: (historias) => this.historias = historias,

        error: (err) => console.error('Error al obtener historias', err)

      });

  }

}

