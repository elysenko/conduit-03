import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { Article } from '../core/models';
import { ArticlePreviewComponent } from './article-preview.component';

@Component({
  selector: 'app-article-list',
  imports: [ArticlePreviewComponent],
  templateUrl: './article-list.component.html',
  styleUrl: './article-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleListComponent {
  @Input() articles: Article[] = [];
  @Input() articlesCount = 0;
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() emptyMessage = 'No articles are here… yet.';
  @Input() page = 1;
  @Input() pageSize = 20;
  @Output() toggleFavorite = new EventEmitter<Article>();
  @Output() pageChange = new EventEmitter<number>();

  get pages(): number[] {
    const total = Math.max(1, Math.ceil(this.articlesCount / this.pageSize));
    return Array.from({ length: total }, (_, i) => i + 1);
  }
}
