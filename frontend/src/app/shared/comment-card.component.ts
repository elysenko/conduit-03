import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Comment } from '../core/models';

@Component({
  selector: 'app-comment-card',
  imports: [RouterLink, DatePipe],
  templateUrl: './comment-card.component.html',
  styleUrl: './comment-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentCardComponent {
  @Input({ required: true }) comment!: Comment;
  @Input() canDelete = false;
  @Output() remove = new EventEmitter<Comment>();
}
