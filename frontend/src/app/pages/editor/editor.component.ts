import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MOCK_ARTICLES } from '../../core/mock-data';
import { Article } from '../../core/models';

@Component({
  selector: 'app-editor',
  imports: [ReactiveFormsModule],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Backend-owned data — replaced with API calls by the service layer. */
  articles = signal<Article[]>([...MOCK_ARTICLES]);

  loading = signal(false);
  submitting = signal(false);
  errors = signal<string[]>([]);

  readonly slug = signal<string | null>(this.route.snapshot.paramMap.get('slug'));
  readonly isEdit = computed(() => this.slug() !== null);
  readonly tags = signal<string[]>([]);
  readonly tagDraft = signal('');

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required]],
    body: ['', [Validators.required, Validators.minLength(10)]],
  });

  constructor() {
    const existing = this.articles().find((a) => a.slug === this.slug());
    if (existing) {
      this.form.patchValue({
        title: existing.title,
        description: existing.description,
        body: existing.body,
      });
      this.tags.set([...existing.tagList]);
    }
  }

  updateTagDraft(value: string): void {
    this.tagDraft.set(value);
  }

  addTag(): void {
    const tag = this.tagDraft().trim().toLowerCase();
    if (tag && !this.tags().includes(tag)) {
      this.tags.update((list) => [...list, tag]);
    }
    this.tagDraft.set('');
  }

  removeTag(tag: string): void {
    this.tags.update((list) => list.filter((t) => t !== tag));
  }

  submit(): void {
    this.errors.set([]);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errors.set(['title, description and body are required']);
      return;
    }
    this.submitting.set(true);
    const value = this.form.getRawValue();
    // The save response owns the slug: a title edit regenerates it, so navigate
    // to whatever slug comes back rather than the one we arrived with.
    const savedSlug =
      value.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'untitled';
    this.submitting.set(false);
    void this.router.navigate(['/article', savedSlug]);
  }

  cancel(): void {
    void this.router.navigate(this.isEdit() ? ['/article', this.slug()] : ['/']);
  }
}
