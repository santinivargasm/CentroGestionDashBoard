import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './header/header';
import { Sidebar } from './sidebar/sidebar';
import { EmailSessionService } from './core/email-session.service';
import { clearAllCookies } from './core/cookie-utils';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Header, Sidebar],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  title = 'centroGestionDashboard';

  constructor(private emailSession: EmailSessionService) {}

  ngOnInit() {
    // 1️⃣ Limpiar cookies
    clearAllCookies();

    // 2️⃣ Limpiar almacenamiento
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}

    // 3️⃣ Limpiar estado del servicio
    this.emailSession.clear();

    // 4️⃣ (Opcional) Si usas Azure EasyAuth y quieres forzar logout en cada arranque:
    // window.location.replace('/.auth/logout');
  }
}
