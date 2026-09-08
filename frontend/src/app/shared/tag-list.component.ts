import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-tag-list',
  templateUrl: './tag-list.component.html',
  styleUrl: './tag-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagListComponent {
  @Input() tags: string[] = [];
  @Input() loading = false;
  @Input() activeTag: string | null = null;
  @Output() select = new EventEmitter<string>();
}
