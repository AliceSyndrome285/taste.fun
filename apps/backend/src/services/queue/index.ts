import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { ImageGenerationTask, HistoricalSyncTask } from '../../types';
import { DePINService } from '../depin';

export class QueueService {
  private static instance: QueueService;
  private connection: IORedis;
  private imageGenerationQueue: Queue<ImageGenerationTask>;
  private imageGenerationWorker: Worker<ImageGenerationTask>;

  private constructor() {
    // Create Redis connection
    this.connection = new IORedis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
    });

    // Create image generation queue
    this.imageGenerationQueue = new Queue<ImageGenerationTask>(
      'image-generation',
      {
        connection: this.connection,
      }
    );

    // Create worker for image generation
    this.imageGenerationWorker = new Worker<ImageGenerationTask>(
      'image-generation',
      async (job: Job<ImageGenerationTask>) => {
        await this.processImageGeneration(job);
      },
      {
        connection: this.connection,
        concurrency: 5, // Process up to 5 jobs concurrently
      }
    );

    // Worker event handlers
    this.imageGenerationWorker.on('completed', (job) => {
      logger.info('Image generation job completed', {
        jobId: job.id,
        ideaPubkey: job.data.ideaPubkey,
      });
    });

    this.imageGenerationWorker.on('failed', (job, err) => {
      logger.error('Image generation job failed', {
        jobId: job?.id,
        ideaPubkey: job?.data.ideaPubkey,
        error: err,
      });
    });

    logger.info('Queue service initialized');
  }

  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  /**
   * Add image generation task to queue
   */
  public async addImageGenerationTask(
    task: ImageGenerationTask
  ): Promise<void> {
    try {
      await this.imageGenerationQueue.add('generate-images', task, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 1 day
          count: 1000,
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
      });

      logger.info('Image generation task added to queue', {
        ideaPubkey: task.ideaPubkey,
      });
    } catch (error) {
      logger.error('Failed to add image generation task', {
        error,
        task,
      });
      throw error;
    }
  }

  /**
   * Process image generation task
   */
  private async processImageGeneration(
    job: Job<ImageGenerationTask>
  ): Promise<void> {
    const { ideaPubkey, prompt, depinProvider, retryCount } = job.data;

    logger.info('Processing image generation task', {
      jobId: job.id,
      ideaPubkey,
      retryCount,
    });

    try {
      // Parse prompt - it might contain multiple prompts separated by delimiter
      // Format: "prompt1|||prompt2|||prompt3|||prompt4"
      let prompts: string[];
      if (prompt.includes('|||')) {
        prompts = prompt.split('|||').map(p => p.trim()).filter(p => p.length > 0);
      } else {
        // Fallback: create 4 variations of the same prompt for 4 voting options
        prompts = Array(4).fill(prompt);
      }

      // Call DePIN service to generate images with multiple prompts
      const depinService = DePINService.getInstance();
      await depinService.generateImages(ideaPubkey, prompts, depinProvider);

      logger.info('Image generation completed', { ideaPubkey, promptCount: prompts.length });
    } catch (error) {
      logger.error('Image generation failed', {
        error,
        ideaPubkey,
        attemptsMade: job.attemptsMade,
      });
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  public async getQueueStats(): Promise<any> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.imageGenerationQueue.getWaitingCount(),
      this.imageGenerationQueue.getActiveCount(),
      this.imageGenerationQueue.getCompletedCount(),
      this.imageGenerationQueue.getFailedCount(),
    ]);

    return {
      imageGeneration: {
        waiting,
        active,
        completed,
        failed,
      },
    };
  }

  /**
   * Clean up and close connections
   */
  public async close(): Promise<void> {
    await this.imageGenerationWorker.close();
    await this.imageGenerationQueue.close();
    await this.connection.quit();
    logger.info('Queue service closed');
  }
}

export default QueueService;
