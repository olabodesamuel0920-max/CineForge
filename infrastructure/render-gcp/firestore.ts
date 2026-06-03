import { Firestore } from '@google-cloud/firestore';

// In-memory progress cache for local testing mode
const localProgressStore: Record<string, { percent: number; status: string; error?: string; diagnostics?: any; queuePosition?: number }> = {};

let firestoreClient: Firestore | null = null;
const COLLECTION_NAME = process.env.PROGRESS_COLLECTION_NAME || 'CineForgeProgress';

function getFirestore(): Firestore | null {
  if (process.env.RENDER_MODE !== 'cloud') {
    process.env.RENDER_MODE = 'local';
    return null;
  }
  if (!firestoreClient) {
    try {
      firestoreClient = new Firestore();
    } catch (e) {
      console.warn('Firestore initialization failed. Falling back to local progress store.', e);
      process.env.RENDER_MODE = 'local';
      return null;
    }
  }
  return firestoreClient;
}

let lastDbUpdate = 0;
const DB_UPDATE_INTERVAL = 3000; // 3 seconds interval debounce

/**
 * Updates the rendering progress in Google Cloud Firestore or local store.
 */
export async function updateProgress(
  taskId: string,
  percent: number,
  status: string,
  error?: string,
  diagnostics?: any,
  queuePosition?: number
): Promise<void> {
  const now = Date.now();
  
  // Force update if it is a terminal state, completed, failed, queued, or start of render
  const isTerminal = percent === 100 || status === 'COMPLETED' || status === 'FAILED' || percent === 0 || percent === 1 || percent === 2 || status.startsWith('QUEUED');
  
  if (!isTerminal && (now - lastDbUpdate < DB_UPDATE_INTERVAL)) {
    return; // Throttle write
  }
  
  lastDbUpdate = now;

  // Local Mode fallback
  const client = getFirestore();
  if (!client) {
    console.log(`[Local Progress] TaskId: ${taskId} | ${percent}% | Status: ${status}${error ? ` | Error: ${error}` : ''}`);
    localProgressStore[taskId] = { percent, status, error, diagnostics, queuePosition };
    return;
  }

  try {
    const docRef = client.collection(COLLECTION_NAME).doc(taskId);
    
    const updateData: Record<string, any> = {
      Percent: percent,
      Status: status,
      LastSeen: now
    };

    if (error !== undefined) {
      updateData.Error = error;
    }

    if (diagnostics !== undefined) {
      updateData.Diagnostics = diagnostics;
    }

    if (queuePosition !== undefined) {
      updateData.QueuePosition = queuePosition;
    }

    // Set document with merge options to create or update existing progress logs
    await docRef.set(updateData, { merge: true });
  } catch (err) {
    // Print failure but do not crash the render worker
    console.error(`[TaskId: ${taskId}] Failed to log progress state write to Firestore collection ${COLLECTION_NAME}:`, err);
  }
}

/**
 * Retrieves the current rendering progress.
 */
export async function getProgress(
  taskId: string
): Promise<{ percent: number; status: string; error?: string; diagnostics?: any; queuePosition?: number } | null> {
  const client = getFirestore();
  if (!client) {
    return localProgressStore[taskId] || null;
  }

  try {
    const docRef = client.collection(COLLECTION_NAME).doc(taskId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data();
    return {
      percent: data?.Percent ?? 0,
      status: data?.Status ?? 'UNKNOWN',
      error: data?.Error,
      diagnostics: data?.Diagnostics,
      queuePosition: data?.QueuePosition
    };
  } catch (err) {
    console.error(`[TaskId: ${taskId}] Failed to read progress state from Firestore collection ${COLLECTION_NAME}:`, err);
    return null;
  }
}

