import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly errors = signal<string[]>([]);
  readonly submitting = signal(false);
  readonly previewShortcut = this.auth.previewShortcut;

  submit(): void {
    this.errors.set([]);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errors.set(['username, email and password (min 8 characters) are required']);
      return;
    }
    this.submitting.set(true);
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    this.auth.register(this.form.getRawValue(), redirect).subscribe({
      next: () => this.submitting.set(false),
      error: (err: unknown) => {
        this.submitting.set(false);
        this.errors.set(Array.isArray(err) ? err : ['email has already been taken']);
      },
    });
  }

  useDemoMode(): void {
    this.auth.previewSignIn();
  }
}
