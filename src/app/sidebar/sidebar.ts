import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, RouterOutlet, CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class Sidebar {
  collapsed = signal(false);
  router = inject(Router);

  isActive(route: string) {
    // Normaliza la URL actual (sin query ni fragmentos)
    const url = this.router.url.split('?')[0].split('#')[0];
    // Activo si es exactamente la ruta o si está en un sub-segmento (p.ej. /actividades/loquesea)
    return url === route || url.startsWith(route + '/');
  }
}
