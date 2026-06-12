import { ChildProcess } from 'child_process';
import { updateProgress } from './firestore';
import * as fs from 'fs';
import * as path from 'path';

export interface RenderJob {
  jobId: string;
  taskId: string; // Mapped Next.js project ID
  type: 'render' | 'preview';
  reqBody: any;
  status: 'QUEUED' | 'DOWNLOADING' | 'ANALYZING' | 'RENDERING' | 'UPLOADING' | 'COMPLETED' | 'FAILED';
  percent: number;
  addedAt: number;
  startedAt?: number;
  endedAt?: number;
  error?: string;
  cancelled?: boolean;
  process?: ChildProcess; // Underlying FFmpeg spawn handle for cancellation
  activeFiles: string[];
  queuePosition?: number;
  diagnostics?: {
    renderProfile?: string;
    downloadDuration?: number;
    analysisDuration?: number;
    renderDuration?: number;
    uploadDuration?: number;
    totalDuration?: number;
    outputSize?: number;
    error?: string;
    workerNode?: string;
    videoDuration?: number;
    resolution?: [number, number];
    codec?: string;
  };
  resolve?: (value: any) => void;
  reject?: (reason: any) => void;
}

const MAX_CONCURRENT_RENDERS = Number(process.env.MAX_CONCURRENT_RENDERS ?? 2);
const MAX_CONCURRENT_PREVIEWS = Number(process.env.MAX_CONCURRENT_PREVIEWS ?? 3);

class QueueManager {
  private renderQueue: RenderJob[] = [];
  private previewQueue: RenderJob[] = [];
  private activeRenders: Map<string, RenderJob> = new Map(); // jobId -> Job
  private activePreviews: Map<string, RenderJob> = new Map(); // jobId -> Job
  
  // Historical stats (for /queue/stats)
  private stats = {
    completedToday: 0,
    failedToday: 0,
    cancelledToday: 0
  };

  /**
   * Tracks all file paths currently locked by active render/preview operations.
   */
  public getActiveFilePaths(): Set<string> {
    const paths = new Set<string>();
    
    const addPaths = (job: RenderJob) => {
      job.activeFiles.forEach(f => {
        if (f) paths.add(path.resolve(f));
      });
    };

    this.activeRenders.forEach(addPaths);
    this.activePreviews.forEach(addPaths);
    return paths;
  }

  /**
   * Returns current queue statistics.
   */
  public getStats() {
    return {
      queuedRenders: this.renderQueue.length,
      queuedPreviews: this.previewQueue.length,
      runningRenders: this.activeRenders.size,
      runningPreviews: this.activePreviews.size,
      completedToday: this.stats.completedToday,
      failedToday: this.stats.failedToday,
      cancelledToday: this.stats.cancelledToday
    };
  }

  /**
   * Create and append a new job to the appropriate queue pool.
   */
  public enqueue(
    taskId: string,
    type: 'render' | 'preview',
    reqBody: any,
    resolve?: (value: any) => void,
    reject?: (reason: any) => void
  ): RenderJob {
    const jobId = `job-${Math.random().toString(36).substring(2, 11)}`;
    const job: RenderJob = {
      jobId,
      taskId,
      type,
      reqBody,
      status: 'QUEUED',
      percent: 1,
      addedAt: Date.now(),
      activeFiles: [],
      resolve,
      reject
    };

    if (type === 'render') {
      this.renderQueue.push(job);
      console.log(`[Queue] Enqueued master render job ${jobId} (Task: ${taskId}). Queue length: ${this.renderQueue.length}`);
      // Notify state
      this.notifyProgress(job);
      this.processRenders();
    } else {
      this.previewQueue.push(job);
      console.log(`[Queue] Enqueued preview job ${jobId} (Task: ${taskId}). Queue length: ${this.previewQueue.length}`);
      this.processPreviews();
    }

    return job;
  }

  /**
   * Calculates the position of a queued job (1-indexed).
   */
  public getQueuePosition(jobId: string, type: 'render' | 'preview'): number | undefined {
    const queue = type === 'render' ? this.renderQueue : this.previewQueue;
    const index = queue.findIndex(j => j.jobId === jobId);
    return index !== -1 ? index + 1 : undefined;
  }

  /**
   * Cancel a job (queued or running).
   */
  public cancelJob(jobId: string): boolean {
    // Check render queue
    let index = this.renderQueue.findIndex(j => j.jobId === jobId);
    if (index !== -1) {
      const [job] = this.renderQueue.splice(index, 1);
      job.status = 'FAILED';
      job.error = 'Job cancelled by request';
      job.endedAt = Date.now();
      job.diagnostics = {
        totalDuration: (job.endedAt - job.addedAt) / 1000,
        error: 'Cancelled'
      };
      this.stats.cancelledToday++;
      this.notifyProgress(job);
      if (job.reject) job.reject(new Error('Job cancelled'));
      console.log(`[Queue] Cancelled queued render job: ${jobId}`);
      return true;
    }

    // Check preview queue
    index = this.previewQueue.findIndex(j => j.jobId === jobId);
    if (index !== -1) {
      const [job] = this.previewQueue.splice(index, 1);
      job.status = 'FAILED';
      job.error = 'Job cancelled by request';
      if (job.reject) job.reject(new Error('Job cancelled'));
      console.log(`[Queue] Cancelled queued preview job: ${jobId}`);
      return true;
    }

    // Check active renders
    let activeJob = this.activeRenders.get(jobId);
    if (activeJob) {
      activeJob.cancelled = true;
      activeJob.status = 'FAILED';
      activeJob.error = 'Job cancelled by request';
      activeJob.endedAt = Date.now();
      activeJob.diagnostics = {
        ...activeJob.diagnostics,
        totalDuration: (activeJob.endedAt - (activeJob.startedAt ?? activeJob.addedAt)) / 1000,
        error: 'Cancelled'
      };
      
      if (activeJob.process) {
        try {
          activeJob.process.kill('SIGKILL');
          console.log(`[Queue] Killed active FFmpeg process for render job: ${jobId}`);
        } catch (e) {
          console.warn(`[Queue] Failed to kill FFmpeg process for ${jobId}:`, e);
        }
      }
      
      this.activeRenders.delete(jobId);
      this.stats.cancelledToday++;
      this.notifyProgress(activeJob);
      if (activeJob.reject) activeJob.reject(new Error('Job cancelled'));
      
      this.processRenders();
      return true;
    }

    // Check active previews
    activeJob = this.activePreviews.get(jobId);
    if (activeJob) {
      activeJob.cancelled = true;
      activeJob.status = 'FAILED';
      
      if (activeJob.process) {
        try {
          activeJob.process.kill('SIGKILL');
          console.log(`[Queue] Killed active FFmpeg process for preview job: ${jobId}`);
        } catch (e) {
          console.warn(`[Queue] Failed to kill FFmpeg process for ${jobId}:`, e);
        }
      }
      
      this.activePreviews.delete(jobId);
      if (activeJob.reject) activeJob.reject(new Error('Job cancelled'));
      
      this.processPreviews();
      return true;
    }

    return false;
  }

  /**
   * Find job state by its Project/Task ID.
   */
  public getJobByTaskId(taskId: string): RenderJob | undefined {
    // Search active lists first
    for (const job of this.activeRenders.values()) {
      if (job.taskId === taskId) return job;
    }
    for (const job of this.activePreviews.values()) {
      if (job.taskId === taskId) return job;
    }
    // Search queues
    let found = this.renderQueue.find(j => j.taskId === taskId);
    if (found) return found;
    return this.previewQueue.find(j => j.taskId === taskId);
  }

  /**
   * Processes the Master Renders queue.
   */
  private processRenders() {
    if (this.activeRenders.size >= MAX_CONCURRENT_RENDERS) {
      return;
    }

    const nextJob = this.renderQueue.shift();
    if (!nextJob) return;

    this.activeRenders.set(nextJob.jobId, nextJob);
    nextJob.startedAt = Date.now();
    nextJob.status = 'DOWNLOADING';
    nextJob.percent = 2;
    this.notifyProgress(nextJob);

    // Call execution handler provided by server.ts context
    this.executeRenderJob(nextJob);
  }

  /**
   * Processes the Previews queue.
   */
  private processPreviews() {
    if (this.activePreviews.size >= MAX_CONCURRENT_PREVIEWS) {
      return;
    }

    const nextJob = this.previewQueue.shift();
    if (!nextJob) return;

    this.activePreviews.set(nextJob.jobId, nextJob);
    nextJob.startedAt = Date.now();
    nextJob.status = 'DOWNLOADING';
    nextJob.percent = 5;

    this.executePreviewJob(nextJob);
  }

  /**
   * Placeholders for runners initialized from server.ts
   */
  public executeRenderRunner: (job: RenderJob) => Promise<void> = async () => {};
  public executePreviewRunner: (job: RenderJob) => Promise<void> = async () => {};

  private async executeRenderJob(job: RenderJob) {
    console.log(`[Queue] Starting execution of render job: ${job.jobId} (Task: ${job.taskId})`);
    try {
      await this.executeRenderRunner(job);
      if (!job.cancelled) {
        this.stats.completedToday++;
      }
    } catch (e) {
      console.error(`[Queue] Render job ${job.jobId} execution failed:`, e);
      if (!job.cancelled) {
        this.stats.failedToday++;
      }
    } finally {
      this.activeRenders.delete(job.jobId);
      this.processRenders();
    }
  }

  private async executePreviewJob(job: RenderJob) {
    console.log(`[Queue] Starting execution of preview job: ${job.jobId} (Task: ${job.taskId})`);
    try {
      await this.executePreviewRunner(job);
    } catch (e) {
      console.error(`[Queue] Preview job ${job.jobId} execution failed:`, e);
    } finally {
      this.activePreviews.delete(job.jobId);
      this.processPreviews();
    }
  }

  /**
   * Helper to write updates and queue positions to Firestore/Memory cache.
   */
  public async notifyProgress(job: RenderJob, percentOverride?: number, statusOverride?: string, errorMsg?: string) {
    if (percentOverride !== undefined) job.percent = percentOverride;
    if (statusOverride !== undefined) job.status = statusOverride as any;
    if (errorMsg !== undefined) job.error = errorMsg;

    let displayStatus: string = job.status;
    let percent = job.percent;

    if (job.status === 'QUEUED') {
      const pos = this.getQueuePosition(job.jobId, job.type);
      job.queuePosition = pos;
      displayStatus = pos ? `QUEUED (Position: ${pos})` : 'QUEUED';
      percent = 1;
    } else {
      job.queuePosition = undefined;
    }

    try {
      await updateProgress(job.taskId, percent, displayStatus, job.error, job.diagnostics, job.queuePosition);
    } catch (err) {
      console.error(`[Queue] Failed to update progress for job ${job.jobId}:`, err);
    }
  }
}

export const renderQueueManager = new QueueManager();
