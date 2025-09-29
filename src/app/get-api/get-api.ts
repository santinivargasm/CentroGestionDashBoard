import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';


@Component({
  selector: 'app-get-api',
  standalone: true, // <-- Esto es clave
  imports: [], // Aquí importas el componente hijo
  templateUrl: './get-api.html',
  styleUrl: './get-api.css'
})
export class GetApi implements OnInit {

  displayedColumns = ['name', 'position', 'symbol'];
  http = inject(HttpClient);
  userList: any[] = [];

  ngOnInit(): void {
    this.getUsers();
  }

  getUsers() {
    this.http.get("http://127.0.0.1:5000/api/usuarios").subscribe((result: any) => {
      this.userList = result;
    });
  }
}