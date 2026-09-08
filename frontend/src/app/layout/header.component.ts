import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth.service';

interface NavItem {
  label: string;
  link: string;
  icon: string;
  exact: boolean;
}

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  private readonly auth = inject(AuthService);

  readonly currentUser = this.auth.currentUser;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly isAdmin = this.auth.isAdmin;

  /**
   * Five items at most, so the mobile presentation is a bottom tab bar rather
   * than a drawer (see header.component.css).
   */
  readonly navItems = computed<NavItem[]>(() => {
    const home: NavItem = { label: 'Home', link: '/', icon: '⌂', exact: true };
    if (!this.isAuthenticated()) {
      return [
        home,
        { label: 'Sign in', link: '/login', icon: '→', exact: false },
        { label: 'Sign up', link: '/register', icon: '✎', exact: false },
      ];
    }
    const items: NavItem[] = [
      home,
      { label: 'New Article', link: '/editor', icon: '✎', exact: false },
      { label: 'Settings', link: '/settings', icon: '⚙', exact: false },
      {
        label: this.currentUser()?.username ?? 'Profile',
        link: `/profile/${this.currentUser()?.username ?? ''}`,
        icon: '☺',
        exact: false,
      },
    ];
    if (this.isAdmin()) {
      items.push({ label: 'Admin', link: '/admin/settings', icon: '⛭', exact: false });
    }
    return items;
  });
}
