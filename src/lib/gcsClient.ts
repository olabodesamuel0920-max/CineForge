import { Storage } from '@google-cloud/storage';

/**
 * Creates and returns a Google Cloud Storage client.
 * If GCP credentials are provided in environment variables (standard on Vercel),
 * it instantiates the client using key authentication. Otherwise, it falls back
 * to Application Default Credentials (ADC).
 */
export function getGcsStorage(): Storage {
  const projectId = process.env.GCP_PROJECT_ID;
  const clientEmail = process.env.GCP_CLIENT_EMAIL;
  const privateKey = process.env.GCP_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    return new Storage({
      projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
    });
  }

  return new Storage();
}
