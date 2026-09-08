import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly errors = signal<string[]>([]);
  readonly submitting = signal(false);

  /**
   * Preview-only shortcut label. `COLOSSUS_PREVIEW` is folded to `false` by esbuild in
   * production builds, so this (and `useDemoMode`) is dead-code-eliminated from every
   * shipped bundle — it only exists in the `mockup` preview configuration.
   */
  readonly previewShortcut = COLOSSUS_PREVIEW ? 'Sign in as the seeded demo user' : null;

  private get redirect(): string | null {
    return this.route.snapshot.queryParamMap.get('redirect');
  }

  submit(): void {
    this.errors.set([]);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errors.set(['email and password are required (password min 8 characters)']);
      return;
    }
    this.submitting.set(true);
    this.auth.login(this.form.getRawValue(), this.redirect).subscribe({
      next: () => this.submitting.set(false),
      error: (err: unknown) => {
        this.submitting.set(false);
        this.errors.set(Array.isArray(err) ? err : ['email or password is invalid']);
      },
    });
  }

  useDemoMode(): void {
    this.auth.previewSignIn();
  }
}
