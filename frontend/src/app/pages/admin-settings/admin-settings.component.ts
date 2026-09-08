import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { MOCK_SETTINGS } from '../../core/mock-data';
import { ServiceSetting } from '../../core/models';

@Component({
  selector: 'app-admin-settings',
  imports: [FormsModule],
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsComponent {
  private readonly auth = inject(AuthService);

  /** Backend-owned data — replaced with API calls by the service layer. */
  services = signal<ServiceSetting[]>([...MOCK_SETTINGS]);

  loading = signal(false);
  error = signal<string | null>(null);
  savingService = signal<string | null>(null);
  savedService = signal<string | null>(null);

  readonly adminName = this.auth.currentUser;

  updateField(service: string, key: string, value: string): void {
    this.services.update((list) =>
      list.map((s) =>
        s.service === service
          ? { ...s, fields: s.fields.map((f) => (f.key === key ? { ...f, value } : f)) }
          : s,
      ),
    );
  }

  save(service: ServiceSetting): void {
    this.savedService.set(null);
    this.error.set(null);
    const missing = service.fields.filter((f) => !f.value.trim());
    if (missing.length === service.fields.length) {
      this.error.set(`Enter at least one credential for ${service.label}.`);
      return;
    }
    this.savingService.set(service.service);
    this.services.update((list) =>
      list.map((s) => (s.service === service.service ? { ...s, configured: true } : s)),
    );
    this.savingService.set(null);
    this.savedService.set(service.service);
  }
}
