import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Article } from '../core/models';

@Component({
  selector: 'app-article-preview',
  imports: [RouterLink, DatePipe],
  templateUrl: './article-preview.component.html',
  styleUrl: './article-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticlePreviewComponent {
  @Input({ required: true }) article!: Article;
  @Output() toggleFavorite = new EventEmitter<Article>();
}
