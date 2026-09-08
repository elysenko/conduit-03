import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiService } from './api.service';
import { withAvatar } from './avatar';
import { Profile } from './models';

/** Public profiles and the follow relationship — /api/profiles/:username. */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly api = inject(ApiService);

  get(username: string): Observable<Profile> {
    return this.api
      .get<{ profile: Profile }>(`/profiles/${encodeURIComponent(username)}`)
      .pipe(map((res) => withAvatar(res.profile)));
  }

  /** POST follows, DELETE unfollows; both answer with the updated profile. */
  setFollow(username: string, following: boolean): Observable<Profile> {
    const path = `/profiles/${encodeURIComponent(username)}/follow`;
    const request = following
      ? this.api.post<{ profile: Profile }>(path)
      : this.api.delete<{ profile: Profile }>(path);
    return request.pipe(map((res) => withAvatar(res.profile)));
  }
}
