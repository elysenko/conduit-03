import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly currentUser = this.auth.currentUser;
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly errors = signal<string[]>([]);

  readonly form = this.fb.nonNullable.group({
    image: [this.currentUser()?.image ?? ''],
    username: [this.currentUser()?.username ?? '', [Validators.required]],
    bio: [this.currentUser()?.bio ?? ''],
    email: [this.currentUser()?.email ?? '', [Validators.required, Validators.email]],
    password: [''],
  });

  constructor() {
    // The cached user may predate an edit made elsewhere, so re-read it from
    // the API before the form is touched. Untouched controls only.
    this.loading.set(true);
    this.auth.refreshCurrentUser().subscribe((user) => {
      this.loading.set(false);
      if (!user || this.form.dirty) {
        return;
      }
      this.form.patchValue({
        image: user.image ?? '',
        username: user.username,
        bio: user.bio,
        email: user.email,
      });
    });
  }

  submit(): void {
    this.errors.set([]);
    this.saved.set(false);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errors.set(['username and a valid email are required']);
      return;
    }
    this.saving.set(true);
    const { password, ...patch } = this.form.getRawValue();
    if (password && password.length < 8) {
      this.saving.set(false);
      this.errors.set(['password must be at least 8 characters']);
      return;
    }
    this.auth.updateUser(patch).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        this.form.controls.password.reset('');
      },
      error: () => {
        this.saving.set(false);
        this.errors.set(['Could not save your settings. Please try again.']);
      },
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
