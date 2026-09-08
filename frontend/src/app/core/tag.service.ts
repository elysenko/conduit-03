import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiService } from './api.service';

/** Popular tags for the home sidebar — GET /api/tags, ordered by usage. */
@Injectable({ providedIn: 'root' })
export class TagService {
  private readonly api = inject(ApiService);

  popular(): Observable<string[]> {
    return this.api.get<{ tags: string[] }>('/tags').pipe(map((res) => res.tags));
  }
}
