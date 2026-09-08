import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from './layout/footer.component';
import { HeaderComponent } from './layout/header.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  // data-testid="app-ready" is the universal readiness landmark: it enters the DOM only
  // after Angular bootstraps this root component, so the render gate can wait on it to
  // confirm the SPA hydrated (not a blank shell / 404 / failed bundle). Keep it here.
  template: `
    <div class="app-shell" data-testid="app-ready">
      <app-header />
      <main class="app-main"><router-outlet /></main>
      <app-footer />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
