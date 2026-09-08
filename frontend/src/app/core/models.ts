export type Role = 'USER' | 'MANAGER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  username: string;
  bio: string;
  image: string | null;
  role: Role;
  token?: string;
}

export interface Profile {
  username: string;
  bio: string;
  image: string | null;
  following: boolean;
}

export interface Article {
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number;
  author: Profile;
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: Profile;
}

export interface ArticleListResponse {
  articles: Article[];
  articlesCount: number;
}

export interface SettingField {
  key: string;
  label: string;
  value: string;
  placeholder: string;
  secret: boolean;
}

export interface ServiceSetting {
  service: string;
  label: string;
  description: string;
  configured: boolean;
  fields: SettingField[];
}

export interface ListArticlesQuery {
  tag?: string;
  author?: string;
  favorited?: string;
  limit?: number;
  offset?: number;
}
