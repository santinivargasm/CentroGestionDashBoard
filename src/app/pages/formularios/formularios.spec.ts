import { ComponentFixture, TestBed } from '@angular/core/testing';

import { formulariosComponent } from './formularios.component';

describe('Formularios', () => {
  let component: formulariosComponent;
  let fixture: ComponentFixture<formulariosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [formulariosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(formulariosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
