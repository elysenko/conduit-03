/**
 * Credential slots surfaced on /admin/settings, one card per provisioned
 * backing service. Values come from the environment (mounted from the platform
 * secret) or, when an admin overrides them, from the SystemSetting table.
 */
export interface SettingFieldSpec {
  key: string;
  label: string;
  placeholder: string;
  secret: boolean;
}

export interface ServiceSpec {
  service: string;
  label: string;
  description: string;
  fields: SettingFieldSpec[];
}

export const SERVICE_CATALOG: ServiceSpec[] = [
  {
    service: 'postgresql',
    label: 'PostgreSQL',
    description: 'Primary datastore for users, articles, comments and tags.',
    fields: [
      {
        key: 'DATABASE_URL',
        label: 'Database URL',
        placeholder: 'postgresql://user:password@host:5432/database',
        secret: true,
      },
    ],
  },
  {
    service: 'minio',
    label: 'MinIO object storage',
    description:
      'Optional S3-compatible storage for profile and article images.',
    fields: [
      {
        key: 'MINIO_ENDPOINT',
        label: 'Endpoint',
        placeholder: 'http://minio:9000',
        secret: false,
      },
      {
        key: 'MINIO_ACCESS_KEY',
        label: 'Access key',
        placeholder: 'minio access key',
        secret: true,
      },
      {
        key: 'MINIO_SECRET_KEY',
        label: 'Secret key',
        placeholder: 'minio secret key',
        secret: true,
      },
      {
        key: 'MINIO_BUCKET',
        label: 'Bucket',
        placeholder: 'conduit-media',
        secret: false,
      },
    ],
  },
];

/** Keys this app is willing to read or write through the settings screen. */
export const KNOWN_KEYS: string[] = SERVICE_CATALOG.flatMap((service) =>
  service.fields.map((field) => field.key),
);
