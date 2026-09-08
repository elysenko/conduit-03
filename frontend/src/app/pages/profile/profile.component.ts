import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { MOCK_PROFILES } from '../../core/mock-data';
import { Profile } from '../../core/models';

@Component({
  selector: 'app-profile',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  /** Backend-owned data — replaced with API calls by the service layer. */
  profiles = signal<Profile[]>([...MOCK_PROFILES]);

  loading = signal(false);
  error = signal<string | null>(null);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  readonly username = computed(() => this.params().get('username') ?? '');
  readonly profile = computed<Profile | undefined>(() => {
    const name = this.username();
    return this.profiles().find((p) => p.username === name) ?? this.profiles()[0];
  });
  readonly isSelf = computed(
    () => this.profile()?.username === this.auth.currentUser()?.username,
  );

  toggleFollow(): void {
    const name = this.profile()?.username;
    this.profiles.update((list) =>
      list.map((p) => (p.username === name ? { ...p, following: !p.following } : p)),
    );
  }
}
