import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { apiErrorMessages } from '../../core/api.service';
import { ArticleInput, ArticleService } from '../../core/article.service';

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
  private readonly articleApi = inject(ArticleService);

  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly errors = signal<string[]>([]);

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
    const slug = this.slug();
    if (slug) {
      this.loadForEdit(slug);
    }
  }

  private loadForEdit(slug: string): void {
    this.loading.set(true);
    this.articleApi.get(slug).subscribe({
      next: (article) => {
        this.form.patchValue({
          title: article.title,
          description: article.description,
          body: article.body,
        });
        this.tags.set([...article.tagList]);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.errors.set(apiErrorMessages(err, 'Could not load this article for editing.'));
        this.loading.set(false);
      },
    });
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
    const input: ArticleInput = { ...value, tagList: this.tags() };
    const slug = this.slug();

    const request = slug
      ? this.articleApi.update(slug, input)
      : this.articleApi.create(input);

    request.subscribe({
      // The save response owns the slug: a title edit regenerates it, so
      // navigate to whatever slug comes back rather than the one we arrived with.
      next: (article) => {
        this.submitting.set(false);
        void this.router.navigate(['/article', article.slug]);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.errors.set(apiErrorMessages(err, 'Could not save this article. Please try again.'));
      },
    });
  }

  cancel(): void {
    void this.router.navigate(this.isEdit() ? ['/article', this.slug()] : ['/']);
  }
}
