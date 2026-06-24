"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderQueueManager = void 0;
const firestore_1 = require("./firestore");
const path = __importStar(require("path"));
const MAX_CONCURRENT_RENDERS = Number(process.env.MAX_CONCURRENT_RENDERS ?? 2);
const MAX_CONCURRENT_PREVIEWS = Number(process.env.MAX_CONCURRENT_PREVIEWS ?? 3);
class QueueManager {
    renderQueue = [];
    previewQueue = [];
    activeRenders = new Map(); // jobId -> Job
    activePreviews = new Map(); // jobId -> Job
    // Historical stats (for /queue/stats)
    stats = {
        completedToday: 0,
        failedToday: 0,
        cancelledToday: 0
    };
    /**
     * Tracks all file paths currently locked by active render/preview operations.
     */
    getActiveFilePaths() {
        const paths = new Set();
        const addPaths = (job) => {
            job.activeFiles.forEach(f => {
                if (f)
                    paths.add(path.resolve(f));
            });
        };
        this.activeRenders.forEach(addPaths);
        this.activePreviews.forEach(addPaths);
        return paths;
    }
    /**
     * Returns current queue statistics.
     */
    getStats() {
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
    enqueue(taskId, type, reqBody, resolve, reject) {
        const jobId = `job-${Math.random().toString(36).substring(2, 11)}`;
        const job = {
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
        }
        else {
            this.previewQueue.push(job);
            console.log(`[Queue] Enqueued preview job ${jobId} (Task: ${taskId}). Queue length: ${this.previewQueue.length}`);
            this.processPreviews();
        }
        return job;
    }
    /**
     * Calculates the position of a queued job (1-indexed).
     */
    getQueuePosition(jobId, type) {
        const queue = type === 'render' ? this.renderQueue : this.previewQueue;
        const index = queue.findIndex(j => j.jobId === jobId);
        return index !== -1 ? index + 1 : undefined;
    }
    /**
     * Cancel a job (queued or running).
     */
    cancelJob(jobId) {
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
            if (job.reject)
                job.reject(new Error('Job cancelled'));
            console.log(`[Queue] Cancelled queued render job: ${jobId}`);
            return true;
        }
        // Check preview queue
        index = this.previewQueue.findIndex(j => j.jobId === jobId);
        if (index !== -1) {
            const [job] = this.previewQueue.splice(index, 1);
            job.status = 'FAILED';
            job.error = 'Job cancelled by request';
            if (job.reject)
                job.reject(new Error('Job cancelled'));
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
                }
                catch (e) {
                    console.warn(`[Queue] Failed to kill FFmpeg process for ${jobId}:`, e);
                }
            }
            this.activeRenders.delete(jobId);
            this.stats.cancelledToday++;
            this.notifyProgress(activeJob);
            if (activeJob.reject)
                activeJob.reject(new Error('Job cancelled'));
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
                }
                catch (e) {
                    console.warn(`[Queue] Failed to kill FFmpeg process for ${jobId}:`, e);
                }
            }
            this.activePreviews.delete(jobId);
            if (activeJob.reject)
                activeJob.reject(new Error('Job cancelled'));
            this.processPreviews();
            return true;
        }
        return false;
    }
    /**
     * Find job state by its Project/Task ID.
     */
    getJobByTaskId(taskId) {
        // Search active lists first
        for (const job of this.activeRenders.values()) {
            if (job.taskId === taskId)
                return job;
        }
        for (const job of this.activePreviews.values()) {
            if (job.taskId === taskId)
                return job;
        }
        // Search queues
        let found = this.renderQueue.find(j => j.taskId === taskId);
        if (found)
            return found;
        return this.previewQueue.find(j => j.taskId === taskId);
    }
    /**
     * Dynamically determines the maximum active renders.
     * If any active render has neuralUpscale enabled, we throttle concurrency to 1.
     */
    getMaxConcurrentRenders() {
        let throttleNeeded = false;
        let throttleReason = '';
        for (const activeJob of this.activeRenders.values()) {
            const mq = activeJob.reqBody?.blueprint?.max_quality_settings;
            if (mq?.neuralUpscale === true) {
                throttleNeeded = true;
                throttleReason = 'Active AI upscale job';
                break;
            }
            if (mq?.resolution === '8K' || mq?.resolution === '16K') {
                throttleNeeded = true;
                throttleReason = `Active ${mq.resolution} export job`;
                break;
            }
        }
        if (throttleNeeded) {
            console.log(`[Queue] ${throttleReason} detected. Throttling render concurrency to 1.`);
            return 1;
        }
        // Check next queued job
        if (this.activeRenders.size > 0 && this.renderQueue.length > 0) {
            const nextJob = this.renderQueue[0];
            const nextMq = nextJob.reqBody?.blueprint?.max_quality_settings;
            if (nextMq?.neuralUpscale === true || nextMq?.resolution === '8K' || nextMq?.resolution === '16K') {
                console.log(`[Queue] Next job in queue is AI or ${nextMq?.resolution || 'high-res'}. Throttling render concurrency to 1.`);
                return 1;
            }
        }
        return Number(process.env.MAX_CONCURRENT_RENDERS ?? 2);
    }
    /**
     * Processes the Master Renders queue.
     */
    processRenders() {
        const limit = this.getMaxConcurrentRenders();
        if (this.activeRenders.size >= limit) {
            return;
        }
        // Determine if an AI job is already active to prevent running two AI jobs concurrently
        let hasActiveAiJob = false;
        for (const activeJob of this.activeRenders.values()) {
            const mq = activeJob.reqBody?.blueprint?.max_quality_settings;
            if (mq?.neuralUpscale === true) {
                hasActiveAiJob = true;
                break;
            }
        }
        // Find the next job in the queue that can run
        let nextJobIndex = -1;
        for (let i = 0; i < this.renderQueue.length; i++) {
            const job = this.renderQueue[i];
            const isJobAi = job.reqBody?.blueprint?.max_quality_settings?.neuralUpscale === true;
            // If it's an AI job, it can only run if no other AI job is active
            if (!isJobAi || !hasActiveAiJob) {
                nextJobIndex = i;
                break;
            }
        }
        if (nextJobIndex === -1) {
            return;
        }
        const [nextJob] = this.renderQueue.splice(nextJobIndex, 1);
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
    processPreviews() {
        if (this.activePreviews.size >= MAX_CONCURRENT_PREVIEWS) {
            return;
        }
        const nextJob = this.previewQueue.shift();
        if (!nextJob)
            return;
        this.activePreviews.set(nextJob.jobId, nextJob);
        nextJob.startedAt = Date.now();
        nextJob.status = 'DOWNLOADING';
        nextJob.percent = 5;
        this.executePreviewJob(nextJob);
    }
    /**
     * Placeholders for runners initialized from server.ts
     */
    executeRenderRunner = async () => { };
    executePreviewRunner = async () => { };
    async executeRenderJob(job) {
        console.log(`[Queue] Starting execution of render job: ${job.jobId} (Task: ${job.taskId})`);
        try {
            await this.executeRenderRunner(job);
            if (!job.cancelled) {
                this.stats.completedToday++;
            }
        }
        catch (e) {
            console.error(`[Queue] Render job ${job.jobId} execution failed:`, e);
            if (!job.cancelled) {
                this.stats.failedToday++;
            }
        }
        finally {
            this.activeRenders.delete(job.jobId);
            this.processRenders();
        }
    }
    async executePreviewJob(job) {
        console.log(`[Queue] Starting execution of preview job: ${job.jobId} (Task: ${job.taskId})`);
        try {
            await this.executePreviewRunner(job);
        }
        catch (e) {
            console.error(`[Queue] Preview job ${job.jobId} execution failed:`, e);
        }
        finally {
            this.activePreviews.delete(job.jobId);
            this.processPreviews();
        }
    }
    /**
     * Helper to write updates and queue positions to Firestore/Memory cache.
     */
    async notifyProgress(job, percentOverride, statusOverride, errorMsg) {
        if (percentOverride !== undefined)
            job.percent = percentOverride;
        if (statusOverride !== undefined)
            job.status = statusOverride;
        if (errorMsg !== undefined)
            job.error = errorMsg;
        let displayStatus = job.status;
        let percent = job.percent;
        if (job.status === 'QUEUED') {
            const pos = this.getQueuePosition(job.jobId, job.type);
            job.queuePosition = pos;
            displayStatus = pos ? `QUEUED (Position: ${pos})` : 'QUEUED';
            percent = 1;
        }
        else {
            job.queuePosition = undefined;
        }
        try {
            await (0, firestore_1.updateProgress)(job.taskId, percent, displayStatus, job.error, job.diagnostics, job.queuePosition);
        }
        catch (err) {
            console.error(`[Queue] Failed to update progress for job ${job.jobId}:`, err);
        }
    }
}
exports.renderQueueManager = new QueueManager();
