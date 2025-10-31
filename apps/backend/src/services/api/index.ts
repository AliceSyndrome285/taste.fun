import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { db } from '../../database';
import { IPFSService } from '../ipfs';
import {
  IdeaListQuery,
  IdeaResponse,
  VoteResponse,
  UserActivityResponse,
  StatsResponse,
  UploadResponse,
  PaginatedResponse,
  IdeaStatus,
} from '../../types';
import { lamportsToSol } from '../../utils/helpers';
import * as path from 'path';
import * as fs from 'fs';

export class APIServer {
  private app: express.Application;
  private ipfsService: IPFSService;

  constructor() {
    this.app = express();
    this.ipfsService = IPFSService.getInstance();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // CORS
    this.app.use(
      cors({
        origin: config.server.corsOrigin,
        credentials: true,
      })
    );

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        query: req.query,
      });
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', this.handleHealth.bind(this));

    // API routes
    const router = express.Router();

    // Themes
    router.get('/themes', this.getThemes.bind(this));
    router.get('/themes/:id', this.getThemeById.bind(this));
    router.get('/themes/:id/ideas', this.getThemeIdeas.bind(this));
    router.get('/themes/:id/swaps', this.getThemeSwaps.bind(this));
    router.get('/themes/:id/price-history', this.getThemePriceHistory.bind(this));

    // Ideas
    router.get('/ideas', this.getIdeas.bind(this));
    router.get('/ideas/:id', this.getIdeaById.bind(this));
    router.get('/ideas/:id/votes', this.getIdeaVotes.bind(this));

    // Users
    router.get('/users/:pubkey/activity', this.getUserActivity.bind(this));
    router.get('/users/:pubkey/themes', this.getUserThemes.bind(this));
    router.get('/users/:pubkey/portfolio', this.getUserPortfolio.bind(this));

    // Stats
    router.get('/stats', this.getStats.bind(this));

    // Leaderboard
    router.get('/leaderboard/themes', this.getThemeLeaderboard.bind(this));
    router.get('/leaderboard/ideas', this.getIdeaLeaderboard.bind(this));
    router.get('/leaderboard/voters', this.getVoterLeaderboard.bind(this));

    // Upload
    router.post('/upload/images', this.handleUpload.bind(this));

    this.app.use('/api', router);

    // Error handler
    this.app.use(this.errorHandler.bind(this));
  }

  /**
   * Health check endpoint
   */
  private async handleHealth(req: Request, res: Response): Promise<void> {
    try {
      const dbHealthy = await db.testConnection();
      const ipfsHealthy = await this.ipfsService.healthCheck();

      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealthy ? 'ok' : 'error',
          ipfs: ipfsHealthy ? 'ok' : 'error',
        },
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: 'Health check failed',
      });
    }
  }

  /**
   * GET /api/themes - List themes with filtering
   */
  private async getThemes(req: Request, res: Response): Promise<void> {
    try {
      const {
        creator,
        status,
        sortBy = 'created_at',
        order = 'desc',
        limit = 20,
        offset = 0,
      } = req.query as any;

      let query = 'SELECT * FROM themes';
      const params: any[] = [];
      const conditions: string[] = [];

      if (creator) {
        conditions.push(`creator_pubkey = $${params.length + 1}`);
        params.push(creator);
      }

      if (status) {
        conditions.push(`status = $${params.length + 1}`);
        params.push(status);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      const validSortColumns = ['created_at', 'sol_reserves', 'token_reserves'];
      const sortColumn = validSortColumns.includes(sortBy as string)
        ? sortBy
        : 'created_at';
      const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
      query += ` ORDER BY ${sortColumn} ${sortOrder}`;

      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      const result = await db.query(query, params);

      let countQuery = 'SELECT COUNT(*) FROM themes';
      if (conditions.length > 0) {
        countQuery += ' WHERE ' + conditions.join(' AND ');
      }
      const countResult = await db.query(
        countQuery,
        params.slice(0, params.length - 2)
      );
      const total = parseInt(countResult.rows[0].count);

      const themes: any[] = result.rows.map((row: any) =>
        this.transformThemeRecord(row)
      );

      const response: any = {
        data: themes,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(offset as string) + themes.length < total,
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching themes', { error });
      res.status(500).json({ error: 'Failed to fetch themes' });
    }
  }

  /**
   * GET /api/themes/:id - Get theme by ID
   */
  private async getThemeById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await db.query(
        'SELECT * FROM themes WHERE pubkey = $1',
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Theme not found' });
        return;
      }

      const theme = this.transformThemeRecord(result.rows[0]);

      // Get idea count
      const ideasResult = await db.query(
        'SELECT COUNT(*) as count FROM ideas WHERE theme_pubkey = $1',
        [id]
      );
      theme.totalIdeas = parseInt(ideasResult.rows[0].count);

      // Get total volume
      const volumeResult = await db.query(
        'SELECT SUM(sol_amount) as volume FROM token_swaps WHERE theme_pubkey = $1',
        [id]
      );
      theme.totalVolume = lamportsToSol(volumeResult.rows[0].volume || '0');

      // Get 24h price change
      const priceChange = await this.calculate24hPriceChange(id);
      theme.priceChange24h = priceChange;

      res.json(theme);
    } catch (error) {
      logger.error('Error fetching theme', { error, id: req.params.id });
      res.status(500).json({ error: 'Failed to fetch theme' });
    }
  }

  /**
   * GET /api/themes/:id/ideas - Get ideas for a theme
   */
  private async getThemeIdeas(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { limit = 20, offset = 0 } = req.query as any;

      const result = await db.query(
        `SELECT * FROM ideas 
         WHERE theme_pubkey = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [id, parseInt(limit), parseInt(offset)]
      );

      const countResult = await db.query(
        'SELECT COUNT(*) FROM ideas WHERE theme_pubkey = $1',
        [id]
      );
      const total = parseInt(countResult.rows[0].count);

      const ideas = result.rows.map((row: any) => this.transformIdeaRecord(row));

      res.json({
        data: ideas,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + ideas.length < total,
      });
    } catch (error) {
      logger.error('Error fetching theme ideas', { error, id: req.params.id });
      res.status(500).json({ error: 'Failed to fetch theme ideas' });
    }
  }

  /**
   * GET /api/themes/:id/swaps - Get swap history for a theme
   */
  private async getThemeSwaps(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { limit = 50, offset = 0 } = req.query as any;

      const result = await db.query(
        `SELECT * FROM token_swaps 
         WHERE theme_pubkey = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [id, parseInt(limit), parseInt(offset)]
      );

      const swaps = result.rows.map((row: any) => this.transformSwapRecord(row));

      res.json({ data: swaps });
    } catch (error) {
      logger.error('Error fetching theme swaps', { error, id: req.params.id });
      res.status(500).json({ error: 'Failed to fetch theme swaps' });
    }
  }

  /**
   * GET /api/themes/:id/price-history - Get price history for a theme
   */
  private async getThemePriceHistory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { range = '24h' } = req.query as any;

      let hoursBack = 24;
      if (range === '7d') hoursBack = 168;
      else if (range === '30d') hoursBack = 720;

      const result = await db.query(
        `SELECT 
          DATE_TRUNC('hour', created_at) as hour,
          AVG(price_after) as avg_price,
          MIN(price_after) as min_price,
          MAX(price_after) as max_price,
          SUM(CASE WHEN is_buy THEN sol_amount ELSE 0 END) as buy_volume,
          SUM(CASE WHEN NOT is_buy THEN sol_amount ELSE 0 END) as sell_volume
         FROM token_swaps 
         WHERE theme_pubkey = $1 
           AND created_at >= NOW() - INTERVAL '${hoursBack} hours'
         GROUP BY hour
         ORDER BY hour ASC`,
        [id]
      );

      const priceHistory = result.rows.map((row: any) => ({
        timestamp: new Date(row.hour).getTime() / 1000,
        avgPrice: parseFloat(row.avg_price),
        minPrice: parseFloat(row.min_price),
        maxPrice: parseFloat(row.max_price),
        buyVolume: lamportsToSol(row.buy_volume || '0'),
        sellVolume: lamportsToSol(row.sell_volume || '0'),
      }));

      res.json({ data: priceHistory });
    } catch (error) {
      logger.error('Error fetching price history', { error, id: req.params.id });
      res.status(500).json({ error: 'Failed to fetch price history' });
    }
  }

  /**
   * GET /api/users/:pubkey/themes - Get themes created by user
   */
  private async getUserThemes(req: Request, res: Response): Promise<void> {
    try {
      const { pubkey } = req.params;

      const result = await db.query(
        'SELECT * FROM themes WHERE creator_pubkey = $1 ORDER BY created_at DESC',
        [pubkey]
      );

      const themes = result.rows.map((row: any) => this.transformThemeRecord(row));

      res.json({ data: themes });
    } catch (error) {
      logger.error('Error fetching user themes', { error, pubkey: req.params.pubkey });
      res.status(500).json({ error: 'Failed to fetch user themes' });
    }
  }

  /**
   * GET /api/ideas - List ideas with filtering
   */
  private async getIdeas(req: Request, res: Response): Promise<void> {
    try {
      const {
        status,
        sortBy = 'created_at',
        order = 'desc',
        limit = 20,
        offset = 0,
      } = req.query as any;

      let query = 'SELECT * FROM ideas';
      const params: any[] = [];
      const conditions: string[] = [];

      // Filter by status
      if (status) {
        conditions.push(`status = $${params.length + 1}`);
        params.push(status);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // Sorting
      const validSortColumns = [
        'total_staked',
        'created_at',
        'total_voters',
        'voting_deadline',
      ];
      const sortColumn = validSortColumns.includes(sortBy as string)
        ? sortBy
        : 'created_at';
      const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
      query += ` ORDER BY ${sortColumn} ${sortOrder}`;

      // Pagination
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      // Execute query
      const result = await db.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM ideas';
      if (conditions.length > 0) {
        countQuery += ' WHERE ' + conditions.join(' AND ');
      }
      const countResult = await db.query(
        countQuery,
        params.slice(0, params.length - 2)
      );
      const total = parseInt(countResult.rows[0].count);

      // Transform to response format
      const ideas: IdeaResponse[] = result.rows.map((row) =>
        this.transformIdeaRecord(row)
      );

      const response: PaginatedResponse<IdeaResponse> = {
        data: ideas,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(offset as string) + ideas.length < total,
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching ideas', { error });
      res.status(500).json({ error: 'Failed to fetch ideas' });
    }
  }

  /**
   * GET /api/ideas/:id - Get idea by ID
   */
  private async getIdeaById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await db.query(
        'SELECT * FROM ideas WHERE pubkey = $1',
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Idea not found' });
        return;
      }

      const idea = this.transformIdeaRecord(result.rows[0]);

      // Fetch vote distribution
      const votesResult = await db.query(
        `SELECT image_choice, 
                COUNT(*) as vote_count,
                SUM(vote_weight) as total_weight
         FROM votes
         WHERE idea_pubkey = $1
         GROUP BY image_choice`,
        [id]
      );

      idea.votes = votesResult.rows.map((row: any) => ({
        imageIndex: row.image_choice,
        weight: parseInt(row.total_weight),
      }));

      res.json(idea);
    } catch (error) {
      logger.error('Error fetching idea', { error, id: req.params.id });
      res.status(500).json({ error: 'Failed to fetch idea' });
    }
  }

  /**
   * GET /api/ideas/:id/votes - Get votes for an idea
   */
  private async getIdeaVotes(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT * FROM votes 
         WHERE idea_pubkey = $1
         ORDER BY created_at DESC`,
        [id]
      );

      const votes: VoteResponse[] = result.rows.map((row) =>
        this.transformVoteRecord(row)
      );

      res.json(votes);
    } catch (error) {
      logger.error('Error fetching votes', { error, id: req.params.id });
      res.status(500).json({ error: 'Failed to fetch votes' });
    }
  }

  /**
   * GET /api/users/:pubkey/activity - Get user activity
   */
  private async getUserActivity(req: Request, res: Response): Promise<void> {
    try {
      const { pubkey } = req.params;

      // Fetch created ideas
      const ideasResult = await db.query(
        'SELECT * FROM ideas WHERE initiator_pubkey = $1 ORDER BY created_at DESC',
        [pubkey]
      );

      // Fetch votes
      const votesResult = await db.query(
        `SELECT v.*, i.prompt, i.status as idea_status
         FROM votes v
         JOIN ideas i ON v.idea_pubkey = i.pubkey
         WHERE v.voter_pubkey = $1
         ORDER BY v.created_at DESC`,
        [pubkey]
      );

      // Calculate earnings
      const earningsResult = await db.query(
        `SELECT COALESCE(SUM(rs.winnings), 0) as total_earnings
         FROM reviewer_stakes rs
         WHERE rs.reviewer_pubkey = $1 AND rs.is_winner = TRUE`,
        [pubkey]
      );

      const response: UserActivityResponse = {
        ideas: ideasResult.rows.map((row) => this.transformIdeaRecord(row)),
        votes: votesResult.rows.map((row) => this.transformVoteRecord(row)),
        totalCreated: ideasResult.rows.length,
        totalVoted: votesResult.rows.length,
        totalEarned: lamportsToSol(
          earningsResult.rows[0].total_earnings || '0'
        ),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching user activity', {
        error,
        pubkey: req.params.pubkey,
      });
      res.status(500).json({ error: 'Failed to fetch user activity' });
    }
  }

  /**
   * GET /api/users/:pubkey/portfolio - Get user's complete portfolio
   */
  private async getUserPortfolio(req: Request, res: Response): Promise<void> {
    try {
      const { pubkey } = req.params;

      // 1. Get user's theme token holdings from swaps
      const themeTokensQuery = `
        WITH user_swaps AS (
          SELECT 
            ts.theme_pubkey,
            SUM(CASE WHEN ts.is_buy THEN ts.token_amount ELSE -ts.token_amount END) as token_balance,
            SUM(CASE WHEN ts.is_buy THEN ts.sol_amount ELSE 0 END) as total_bought_sol,
            SUM(CASE WHEN ts.is_buy THEN ts.token_amount ELSE 0 END) as total_bought_tokens
          FROM token_swaps ts
          WHERE ts.user_pubkey = $1
          GROUP BY ts.theme_pubkey
          HAVING SUM(CASE WHEN ts.is_buy THEN ts.token_amount ELSE -ts.token_amount END) > 0
        )
        SELECT 
          us.*,
          t.name as theme_name,
          t.description,
          t.token_mint,
          t.sol_reserves,
          t.token_reserves,
          t.creator_pubkey
        FROM user_swaps us
        JOIN themes t ON us.theme_pubkey = t.pubkey
        WHERE us.token_balance > 0
        ORDER BY us.token_balance DESC
      `;

      const themeTokensResult = await db.query(themeTokensQuery, [pubkey]);

      // 2. Get created themes
      const createdThemesQuery = `
        SELECT pubkey, name, description, token_mint, sol_reserves, token_reserves, created_at
        FROM themes
        WHERE creator_pubkey = $1
        ORDER BY created_at DESC
      `;
      const createdThemesResult = await db.query(createdThemesQuery, [pubkey]);

      // 3. Get vote history with winnings
      const voteHistoryQuery = `
        SELECT 
          v.*,
          i.prompt,
          i.status as idea_status,
          i.theme_pubkey,
          t.name as theme_name,
          i.total_staked as prize_pool,
          CASE 
            WHEN v.is_winner = TRUE THEN (v.stake_amount * 1.5)::bigint
            ELSE 0
          END as winnings
        FROM votes v
        JOIN ideas i ON v.idea_pubkey = i.pubkey
        JOIN themes t ON i.theme_pubkey = t.pubkey
        WHERE v.voter_pubkey = $1
        ORDER BY v.created_at DESC
        LIMIT 50
      `;
      const voteHistoryResult = await db.query(voteHistoryQuery, [pubkey]);

      // 4. Calculate pending rewards (winnings not withdrawn)
      const pendingRewardsQuery = `
        SELECT COALESCE(SUM(
          CASE 
            WHEN v.is_winner = TRUE AND v.winnings_withdrawn = FALSE 
            THEN (v.stake_amount * 1.5)::bigint - v.stake_amount
            ELSE 0
          END
        ), 0) as pending_rewards
        FROM votes v
        WHERE v.voter_pubkey = $1 AND v.is_winner = TRUE AND v.winnings_withdrawn = FALSE
      `;
      const pendingRewardsResult = await db.query(pendingRewardsQuery, [pubkey]);

      // Transform theme tokens data
      const themeTokens = themeTokensResult.rows.map((row: any) => {
        const tokenBalance = parseInt(row.token_balance) / 1e6; // Assuming 6 decimals
        const avgBuyPrice = row.total_bought_tokens > 0 
          ? (parseInt(row.total_bought_sol) / 1e9) / (parseInt(row.total_bought_tokens) / 1e6)
          : 0;
        
        // Calculate current price from reserves
        const solReserves = parseInt(row.sol_reserves) / 1e9;
        const tokenReserves = parseInt(row.token_reserves) / 1e6;
        const currentPrice = tokenReserves > 0 ? solReserves / tokenReserves : 0;
        
        const currentValue = tokenBalance * currentPrice;
        const costBasis = tokenBalance * avgBuyPrice;
        const profitLoss = costBasis > 0 ? ((currentValue - costBasis) / costBasis) * 100 : 0;

        return {
          themeId: row.theme_pubkey,
          themeName: row.theme_name,
          tokenMint: row.token_mint,
          amount: tokenBalance,
          avgBuyPrice,
          currentPrice,
          value: currentValue,
          profitLoss,
        };
      });

      // Transform created themes
      const createdThemes = createdThemesResult.rows.map((row: any) => ({
        id: row.pubkey,
        name: row.name,
        description: row.description,
        tokenMint: row.token_mint,
        marketCap: parseInt(row.sol_reserves) / 1e9,
        createdAt: new Date(row.created_at).getTime() / 1000,
      }));

      // Transform vote history
      const voteHistory = voteHistoryResult.rows.map((row: any) => ({
        ideaId: row.idea_pubkey,
        ideaPrompt: row.prompt,
        themeId: row.theme_pubkey,
        themeName: row.theme_name,
        imageChoice: row.image_choice,
        staked: parseInt(row.stake_amount) / 1e9,
        winnings: parseInt(row.winnings) / 1e9,
        status: row.idea_status === 'Completed' 
          ? (row.is_winner ? 'Won' : 'Lost')
          : 'Voting',
        timestamp: new Date(row.created_at).getTime() / 1000,
        isWinner: row.is_winner,
        withdrawn: row.winnings_withdrawn,
      }));

      const response = {
        address: pubkey,
        solBalance: 10.0, // This should come from on-chain balance
        themeTokens,
        createdThemes,
        voteHistory,
        pendingRewards: parseInt(pendingRewardsResult.rows[0].pending_rewards) / 1e9,
        stats: {
          totalCreated: createdThemes.length,
          totalVoted: voteHistory.length,
          totalWon: voteHistory.filter((v: any) => v.status === 'Won').length,
          winRate: voteHistory.length > 0 
            ? (voteHistory.filter((v: any) => v.status === 'Won').length / voteHistory.length) * 100 
            : 0,
        },
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching user portfolio', {
        error,
        pubkey: req.params.pubkey,
      });
      res.status(500).json({ error: 'Failed to fetch user portfolio' });
    }
  }

  /**
   * GET /api/stats - Get platform statistics
   */
  private async getStats(req: Request, res: Response): Promise<void> {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_ideas,
          COUNT(*) FILTER (WHERE status = 'Voting') as active_ideas,
          COUNT(*) FILTER (WHERE status = 'Completed') as completed_ideas,
          COALESCE(SUM(total_staked), 0) as total_staked,
          (SELECT COUNT(*) FROM votes) as total_votes,
          (SELECT COUNT(DISTINCT voter_pubkey) FROM votes) as total_users
        FROM ideas
      `);

      const row = result.rows[0];

      const stats: StatsResponse = {
        totalIdeas: parseInt(row.total_ideas),
        activeIdeas: parseInt(row.active_ideas),
        completedIdeas: parseInt(row.completed_ideas),
        totalStaked: lamportsToSol(row.total_staked),
        totalVotes: parseInt(row.total_votes),
        totalUsers: parseInt(row.total_users),
      };

      res.json(stats);
    } catch (error) {
      logger.error('Error fetching stats', { error });
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  }

  /**
   * POST /api/upload/images - Upload images to IPFS
   */
  private async handleUpload(req: Request, res: Response): Promise<void> {
    const upload = multer({
      dest: 'uploads/',
      limits: {
        fileSize: config.upload.maxFileSize,
        files: config.upload.maxFiles,
      },
      fileFilter: (req, file, cb) => {
        if (config.upload.allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type'));
        }
      },
    }).array('images', config.upload.maxFiles);

    upload(req, res, async (err) => {
      if (err) {
        logger.error('Upload error', { error: err });
        res.status(400).json({ error: err.message });
        return;
      }

      try {
        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
          res.status(400).json({ error: 'No files uploaded' });
          return;
        }

        if (files.length > config.upload.maxFiles) {
          res
            .status(400)
            .json({ error: `Maximum ${config.upload.maxFiles} files allowed` });
          return;
        }

        // Upload each file to IPFS
        const uploadPromises = files.map((file) =>
          this.ipfsService.uploadFile(file.path, file.originalname)
        );

        const results = await Promise.all(uploadPromises);

        // Clean up temporary files
        files.forEach((file) => {
          fs.unlinkSync(file.path);
        });

        const response: UploadResponse = {
          imageUris: results.map((r) => r.uri),
          cids: results.map((r) => r.cid),
        };

        res.json(response);

        logger.info('Files uploaded successfully', {
          count: files.length,
          cids: response.cids,
        });
      } catch (error) {
        logger.error('Error uploading files', { error });
        res.status(500).json({ error: 'Failed to upload files' });
      }
    });
  }

  /**
   * Error handler middleware
   */
  private errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    logger.error('API error', {
      error: err,
      path: req.path,
      method: req.method,
    });

    res.status(500).json({
      error: 'Internal server error',
      message: config.server.env === 'development' ? err.message : undefined,
    });
  }

  /**
   * Transform database record to API response
   */
  private transformThemeRecord(row: any): any {
    const solReserves = parseBigInt(row.sol_reserves);
    const tokenReserves = parseBigInt(row.token_reserves);
    const currentPrice = tokenReserves > 0 
      ? Number(solReserves) / Number(tokenReserves) / 1e9 
      : 0;

    return {
      id: row.pubkey,
      themeId: row.theme_id,
      creator: row.creator_pubkey,
      name: row.name,
      description: row.description,
      tokenMint: row.token_mint,
      totalSupply: lamportsToSol(row.total_supply),
      circulatingSupply: lamportsToSol(row.circulating_supply),
      creatorReserve: lamportsToSol(row.creator_reserve),
      tokenReserves: lamportsToSol(row.token_reserves),
      solReserves: lamportsToSol(row.sol_reserves),
      buybackPool: lamportsToSol(row.buyback_pool),
      currentPrice,
      votingMode: row.voting_mode,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  /**
   * Transform swap record to API response
   */
  private transformSwapRecord(row: any): any {
    return {
      signature: row.signature,
      theme: row.theme_pubkey,
      user: row.user_pubkey,
      isBuy: row.is_buy,
      solAmount: lamportsToSol(row.sol_amount),
      tokenAmount: lamportsToSol(row.token_amount),
      priceAfter: row.price_after,
      timestamp: new Date(row.created_at).getTime() / 1000,
    };
  }

  /**
   * Calculate 24h price change
   */
  private async calculate24hPriceChange(themePubkey: string): Promise<number> {
    try {
      const result = await db.query(
        `SELECT price_after
         FROM token_swaps
         WHERE theme_pubkey = $1
           AND created_at >= NOW() - INTERVAL '24 hours'
         ORDER BY created_at ASC
         LIMIT 1`,
        [themePubkey]
      );

      if (result.rows.length === 0) {
        return 0;
      }

      const price24hAgo = parseFloat(result.rows[0].price_after);

      const latestResult = await db.query(
        `SELECT price_after
         FROM token_swaps
         WHERE theme_pubkey = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [themePubkey]
      );

      if (latestResult.rows.length === 0) {
        return 0;
      }

      const currentPrice = parseFloat(latestResult.rows[0].price_after);

      if (price24hAgo === 0) {
        return 0;
      }

      return ((currentPrice - price24hAgo) / price24hAgo) * 100;
    } catch (error) {
      logger.error('Error calculating 24h price change', { error, themePubkey });
      return 0;
    }
  }

  /**
   * Transform database record to API response
   */
  private transformIdeaRecord(row: any): IdeaResponse {
    return {
      id: row.pubkey,
      ideaId: row.idea_id,
      theme: row.theme_pubkey,
      initiator: row.initiator_pubkey,
      sponsor: row.sponsor_pubkey,
      prompt: row.prompt,
      status: row.status as IdeaStatus,
      imageUris: row.image_uris || [],
      totalStaked: lamportsToSol(row.total_staked),
      totalVoters: row.total_voters,
      votingDeadline: row.voting_deadline
        ? new Date(row.voting_deadline).getTime() / 1000
        : undefined,
      winningImageIndex: row.winning_image_index,
      createdAt: new Date(row.created_at).getTime() / 1000,
    };
  }

  /**
   * GET /api/leaderboard/themes - Get theme leaderboard
   */
  private async getThemeLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      const {
        sortBy = 'total_votes',
        timeFilter = 'all',
        limit = 50,
        offset = 0,
      } = req.query as any;

      // Calculate total votes for each theme based on ideas
      const query = `
        SELECT 
          t.*,
          COUNT(DISTINCT i.id) as total_ideas,
          COALESCE(SUM(i.total_voters), 0) as total_votes,
          COALESCE(SUM(i.total_staked), 0) as total_staked,
          COALESCE(SUM(ts.sol_amount), 0) as total_volume
        FROM themes t
        LEFT JOIN ideas i ON t.pubkey = i.theme_pubkey
        LEFT JOIN token_swaps ts ON t.pubkey = ts.theme_pubkey
        WHERE t.status = 'Active'
        GROUP BY t.id
        ORDER BY ${sortBy === 'market_cap' ? 't.sol_reserves' : 'total_votes'} DESC
        LIMIT $1 OFFSET $2
      `;

      const result = await db.query(query, [parseInt(limit as string), parseInt(offset as string)]);

      const themes = result.rows.map((row: any) => ({
        ...this.transformThemeRecord(row),
        totalVotes: parseInt(row.total_votes || 0),
        totalIdeas: parseInt(row.total_ideas || 0),
        totalVolume: lamportsToSol(row.total_volume || 0),
      }));

      res.json({
        data: themes,
        total: themes.length,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });
    } catch (error) {
      logger.error('Error fetching theme leaderboard', { error });
      res.status(500).json({ error: 'Failed to fetch theme leaderboard' });
    }
  }

  /**
   * GET /api/leaderboard/ideas - Get idea leaderboard
   */
  private async getIdeaLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      const {
        status = 'Voting',
        sortBy = 'total_staked',
        limit = 50,
        offset = 0,
      } = req.query as any;

      let query = 'SELECT * FROM ideas';
      const params: any[] = [];
      const conditions: string[] = [];

      if (status && status !== 'all') {
        conditions.push(`status = $${params.length + 1}`);
        params.push(status);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      const sortColumn = sortBy === 'total_voters' ? 'total_voters' : 'total_staked';
      query += ` ORDER BY ${sortColumn} DESC`;
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      const result = await db.query(query, params);

      const ideas = result.rows.map((row: any) => this.transformIdeaRecord(row));

      res.json({
        data: ideas,
        total: ideas.length,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });
    } catch (error) {
      logger.error('Error fetching idea leaderboard', { error });
      res.status(500).json({ error: 'Failed to fetch idea leaderboard' });
    }
  }

  /**
   * GET /api/leaderboard/voters - Get voter leaderboard
   */
  private async getVoterLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      const {
        limit = 50,
        offset = 0,
      } = req.query as any;

      // Calculate stats for each voter
      const query = `
        SELECT 
          v.voter_pubkey,
          COUNT(DISTINCT v.idea_pubkey) as total_votes,
          COUNT(CASE WHEN v.is_winner = TRUE THEN 1 END) as wins,
          COALESCE(SUM(CASE WHEN v.is_winner = TRUE THEN v.stake_amount * 1.5 ELSE 0 END), 0) as total_winnings,
          COALESCE(SUM(v.stake_amount), 0) as total_staked
        FROM votes v
        JOIN ideas i ON v.idea_pubkey = i.pubkey
        WHERE i.status = 'Completed'
        GROUP BY v.voter_pubkey
        ORDER BY total_winnings DESC
        LIMIT $1 OFFSET $2
      `;

      const result = await db.query(query, [parseInt(limit as string), parseInt(offset as string)]);

      const voters = result.rows.map((row: any) => ({
        address: row.voter_pubkey,
        totalVotes: parseInt(row.total_votes),
        wins: parseInt(row.wins),
        totalWinnings: lamportsToSol(row.total_winnings),
        totalStaked: lamportsToSol(row.total_staked),
      }));

      res.json({
        data: voters,
        total: voters.length,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });
    } catch (error) {
      logger.error('Error fetching voter leaderboard', { error });
      res.status(500).json({ error: 'Failed to fetch voter leaderboard' });
    }
  }

  /**
   * Transform vote record to API response
   */
  private transformVoteRecord(row: any): VoteResponse {
    return {
      idea: row.idea_pubkey,
      voter: row.voter_pubkey,
      imageChoice: row.image_choice,
      stakeAmount: lamportsToSol(row.stake_amount),
      voteWeight: parseInt(row.vote_weight),
      createdAt: new Date(row.created_at).getTime() / 1000,
      isWinner: row.is_winner,
      winningsWithdrawn: row.winnings_withdrawn,
    };
  }

  /**
   * Start the API server
   */
  public start(): void {
    this.app.listen(config.server.port, () => {
      logger.info('API server started', {
        port: config.server.port,
        env: config.server.env,
      });
    });
  }

  /**
   * Get Express app instance
   */
  public getApp(): express.Application {
    return this.app;
  }
}

export default APIServer;
