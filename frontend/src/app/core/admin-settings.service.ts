import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ServiceSetting } from './models';

export interface SettingUpdate {
  key: string;
  value: string;
}

/**
 * Admin credential screen — GET/PATCH /api/admin/settings (ADMIN role only).
 * Values arrive masked; the server treats a masked value echoed back as
 * "leave this one alone", so the UI can submit the whole card safely.
 */
@Injectable({ providedIn: 'root' })
export class AdminSettingsService {
  private readonly api = inject(ApiService);

  list(): Observable<ServiceSetting[]> {
    return this.api.get<ServiceSetting[]>('/admin/settings');
  }

  save(service: string, settings: SettingUpdate[]): Observable<ServiceSetting[]> {
    return this.api
      .patch<{ services: ServiceSetting[] }>('/admin/settings', { settings })
      .pipe(map((res) => res.services));
  }
}
