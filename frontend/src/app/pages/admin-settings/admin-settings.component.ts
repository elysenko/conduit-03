import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminSettingsService } from '../../core/admin-settings.service';
import { apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
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
  private readonly settingsApi = inject(AdminSettingsService);

  /** Live API state — GET /api/admin/settings resolves each key from the
   *  environment first, then the SystemSetting table. Secrets arrive masked. */
  readonly services = signal<ServiceSetting[]>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly savingService = signal<string | null>(null);
  readonly savedService = signal<string | null>(null);

  readonly adminName = this.auth.currentUser;

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.settingsApi.list().subscribe({
      next: (services) => {
        this.services.set(services);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.services.set([]);
        this.error.set(apiErrorMessage(err, 'Could not load service settings.'));
        this.loading.set(false);
      },
    });
  }

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
    // Masked values are echoed back untouched; the server reads that as
    // "keep the stored secret", so sending the whole card is safe.
    const updates = service.fields
      .filter((f) => f.value.trim())
      .map((f) => ({ key: f.key, value: f.value }));

    this.settingsApi.save(service.service, updates).subscribe({
      next: (services) => {
        this.services.set(services);
        this.savingService.set(null);
        this.savedService.set(service.service);
      },
      error: (err: unknown) => {
        this.savingService.set(null);
        this.error.set(apiErrorMessage(err, `Could not save ${service.label} credentials.`));
      },
    });
  }
}
