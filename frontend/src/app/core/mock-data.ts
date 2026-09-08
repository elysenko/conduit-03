import {
  Article,
  Comment,
  Profile,
  ServiceSetting,
  User,
} from './models';

/** Preview-only demo identity. Seeded by AuthService when COLOSSUS_PREVIEW is on. */
export const DEMO_USER: User = {
  id: 'usr_jake',
  email: 'jake@demo',
  username: 'jake',
  bio: 'I work at statefarm',
  image: 'https://api.dicebear.com/7.x/initials/svg?seed=Jake&backgroundColor=5cb85c',
  role: 'ADMIN',
};

export const MOCK_PROFILES: Profile[] = [
  {
    username: 'jake',
    bio: 'I work at statefarm',
    image: 'https://api.dicebear.com/7.x/initials/svg?seed=Jake&backgroundColor=5cb85c',
    following: false,
  },
  {
    username: 'eric-simons',
    bio: 'Cofounder @GoThinkster, lived in Aol’s HQ for a few months, kinda looks like Peeta from the Hunger Games.',
    image: 'https://api.dicebear.com/7.x/initials/svg?seed=Eric&backgroundColor=4a8fd4',
    following: true,
  },
  {
    username: 'albert-pai',
    bio: 'Cofounder @GoThinkster, links and things.',
    image: 'https://api.dicebear.com/7.x/initials/svg?seed=Albert&backgroundColor=d9822b',
    following: false,
  },
  {
    username: 'maya-ortiz',
    bio: 'Systems engineer. Writes about distributed things.',
    image: 'https://api.dicebear.com/7.x/initials/svg?seed=Maya&backgroundColor=b85c5c',
    following: false,
  },
];

const jake = MOCK_PROFILES[0];
const eric = MOCK_PROFILES[1];
const albert = MOCK_PROFILES[2];
const maya = MOCK_PROFILES[3];

export const MOCK_ARTICLES: Article[] = [
  {
    slug: 'how-to-train-your-dragon',
    title: 'How to train your dragon',
    description: 'Ever wonder how?',
    body: "It takes a Jacobian.\n\nDragons are not, contrary to popular belief, trained through force. They are trained through consistency — the same signal, given the same way, every single time.\n\nStart with the feeding ritual. A dragon that associates your approach with food will tolerate your approach without food. Only then can you begin the saddle work.\n\nThe rest is patience.",
    tagList: ['dragons', 'training'],
    createdAt: '2026-08-28T09:12:00.000Z',
    updatedAt: '2026-08-28T09:12:00.000Z',
    favorited: true,
    favoritesCount: 32,
    author: jake,
  },
  {
    slug: 'the-song-of-roland',
    title: 'The song of Roland',
    description: 'Ever wonder how?',
    body: "Roland rode out at dawn, and by dusk the pass at Roncevaux had a new name.\n\nThis piece walks through the manuscript tradition and why the Oxford text remains the one everybody cites.",
    tagList: ['history', 'literature'],
    createdAt: '2026-08-26T14:40:00.000Z',
    updatedAt: '2026-08-26T14:40:00.000Z',
    favorited: false,
    favoritesCount: 11,
    author: eric,
  },
  {
    slug: 'shipping-postgres-without-tears',
    title: 'Shipping Postgres without tears',
    description: 'Migrations, connection pools, and the three settings that actually matter.',
    body: "Most Postgres outages I have seen were not query problems. They were connection problems.\n\nSet your pool size below max_connections divided by replica count, run migrations from exactly one process, and never let an ORM open a transaction it does not close.",
    tagList: ['postgres', 'backend'],
    createdAt: '2026-08-22T08:05:00.000Z',
    updatedAt: '2026-08-22T08:05:00.000Z',
    favorited: false,
    favoritesCount: 47,
    author: maya,
  },
  {
    slug: 'a-quiet-week-of-refactoring',
    title: 'A quiet week of refactoring',
    description: 'No new features. Just less code.',
    body: "We deleted 4,000 lines and shipped nothing. It was the best week of the quarter.\n\nHere is the list of things we removed, and what each one was originally supposed to do.",
    tagList: [],
    createdAt: '2026-08-19T17:30:00.000Z',
    updatedAt: '2026-08-19T17:30:00.000Z',
    favorited: true,
    favoritesCount: 8,
    author: jake,
  },
  {
    slug: 'notes-on-reading-old-code',
    title: 'Notes on reading old code',
    description: 'The comments lie. The tests do not.',
    body: "Every codebase older than two years contains an archaeological record. Learn to read the layers before you dig.",
    tagList: [],
    createdAt: '2026-08-14T11:15:00.000Z',
    updatedAt: '2026-08-14T11:15:00.000Z',
    favorited: false,
    favoritesCount: 3,
    author: albert,
  },
  {
    slug: 'why-we-still-write-integration-tests',
    title: 'Why we still write integration tests',
    description: 'Unit tests tell you the parts work. Integration tests tell you the product works.',
    body: "A green unit suite on a broken deployment is the most expensive kind of confidence.",
    tagList: ['testing'],
    createdAt: '2026-08-09T07:50:00.000Z',
    updatedAt: '2026-08-09T07:50:00.000Z',
    favorited: false,
    favoritesCount: 19,
    author: eric,
  },
];

export const MOCK_COMMENTS: Comment[] = [
  {
    id: 'cmt_1',
    body: 'With supporting text below as a natural lead-in to additional content.',
    createdAt: '2026-08-29T10:02:00.000Z',
    author: eric,
  },
  {
    id: 'cmt_2',
    body: 'The bit about the feeding ritual matches what I found. Consistency beats intensity every time.',
    createdAt: '2026-08-30T16:45:00.000Z',
    author: jake,
  },
];

export const MOCK_TAGS: string[] = [
  'dragons',
  'training',
  'postgres',
  'backend',
  'testing',
  'history',
  'literature',
  'angular',
  'nestjs',
  'prisma',
];

export const MOCK_SETTINGS: ServiceSetting[] = [
  {
    service: 'postgresql',
    label: 'PostgreSQL',
    description: 'Primary datastore for users, articles, comments and tags.',
    configured: true,
    fields: [
      {
        key: 'DATABASE_URL',
        label: 'Database URL',
        value: 'postgresql://conduit:••••••••@db:5432/conduit',
        placeholder: 'postgresql://user:password@host:5432/database',
        secret: true,
      },
    ],
  },
  {
    service: 'minio',
    label: 'MinIO object storage',
    description: 'Optional S3-compatible storage for profile and article images.',
    configured: false,
    fields: [
      {
        key: 'MINIO_ENDPOINT',
        label: 'Endpoint',
        value: '',
        placeholder: 'http://minio:9000',
        secret: false,
      },
      {
        key: 'MINIO_ACCESS_KEY',
        label: 'Access key',
        value: '',
        placeholder: 'PLACEHOLDER_CONFIGURE_IN_SETTINGS',
        secret: true,
      },
      {
        key: 'MINIO_SECRET_KEY',
        label: 'Secret key',
        value: '',
        placeholder: 'PLACEHOLDER_CONFIGURE_IN_SETTINGS',
        secret: true,
      },
      {
        key: 'MINIO_BUCKET',
        label: 'Bucket',
        value: '',
        placeholder: 'conduit-media',
        secret: false,
      },
    ],
  },
];
