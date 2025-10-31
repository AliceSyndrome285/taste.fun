/**
 * API Client for Taste.Fun Backend
 * Handles all HTTP requests to the backend API server
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ipfs.cradleintro.top/api';

export interface IdeaStatus {
  GeneratingImages: 'GeneratingImages';
  Voting: 'Voting';
  Completed: 'Completed';
  Cancelled: 'Cancelled';
}

export interface VotingMode {
  Classic: 'Classic';
  Reverse: 'Reverse';
  MiddleWay: 'MiddleWay';
}

export interface ThemeResponse {
  id: string;
  themeId: number;
  creator: string;
  name: string;
  description: string;
  tokenMint: string;
  totalSupply: number;
  circulatingSupply: number;
  creatorReserve: number;
  tokenReserves: number;
  solReserves: number;
  buybackPool: number;
  currentPrice: number;
  votingMode: keyof VotingMode;
  status: 'Active' | 'Migrated' | 'Paused';
  createdAt: number;
  totalIdeas?: number;
  totalVolume?: number;
  priceChange24h?: number;
}

export interface TokenSwapResponse {
  signature: string;
  theme: string;
  user: string;
  isBuy: boolean;
  solAmount: number;
  tokenAmount: number;
  priceAfter: number;
  timestamp: number;
}

export interface PriceHistoryPoint {
  timestamp: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  buyVolume: number;
  sellVolume: number;
}

export interface IdeaResponse {
  id: string;
  ideaId: number;
  theme: string;
  initiator: string;
  sponsor?: string;
  prompt: string;
  status: keyof IdeaStatus;
  imageUris: string[];
  totalStaked: number;
  totalVoters: number;
  votingDeadline?: number;
  winningImageIndex?: number;
  createdAt: number;
  votes?: {
    imageIndex: number;
    weight: number;
  }[];
  rejectAllWeight?: number;
}

export interface VoteResponse {
  idea: string;
  voter: string;
  imageChoice: number;
  stakeAmount: number;
  voteWeight: number;
  createdAt: number;
  isWinner?: boolean;
  winningsWithdrawn: boolean;
}

export interface UserActivityResponse {
  ideas: IdeaResponse[];
  votes: VoteResponse[];
  totalCreated: number;
  totalVoted: number;
  totalEarned: number;
}

export interface StatsResponse {
  totalIdeas: number;
  activeIdeas: number;
  completedIdeas: number;
  totalStaked: number;
  totalVotes: number;
  totalUsers: number;
}

export interface UploadResponse {
  imageUris: string[];
  cids: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface IdeaListParams {
  theme?: string;
  status?: keyof IdeaStatus;
  sortBy?: 'total_staked' | 'created_at' | 'total_voters' | 'voting_deadline';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ThemeListParams {
  creator?: string;
  status?: 'Active' | 'Migrated' | 'Paused';
  sortBy?: 'created_at' | 'sol_reserves' | 'token_reserves';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Generic fetch wrapper with error handling
   */
  private async fetch<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', { url, error });
      throw error;
    }
  }

  /**
   * GET /api/themes - List themes with filtering
   */
  async getThemes(params?: ThemeListParams): Promise<PaginatedResponse<ThemeResponse>> {
    const searchParams = new URLSearchParams();
    
    if (params?.creator) searchParams.append('creator', params.creator);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.order) searchParams.append('order', params.order);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    const query = searchParams.toString();
    const endpoint = query ? `/themes?${query}` : '/themes';
    
    return this.fetch<PaginatedResponse<ThemeResponse>>(endpoint);
  }

  /**
   * GET /api/themes/:id - Get theme by ID
   */
  async getThemeById(id: string): Promise<ThemeResponse> {
    return this.fetch<ThemeResponse>(`/themes/${id}`);
  }

  /**
   * GET /api/themes/:id/ideas - Get ideas for a theme
   */
  async getThemeIdeas(
    id: string,
    params?: { limit?: number; offset?: number }
  ): Promise<PaginatedResponse<IdeaResponse>> {
    const searchParams = new URLSearchParams();
    
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    const query = searchParams.toString();
    const endpoint = query ? `/themes/${id}/ideas?${query}` : `/themes/${id}/ideas`;
    
    return this.fetch<PaginatedResponse<IdeaResponse>>(endpoint);
  }

  /**
   * GET /api/themes/:id/swaps - Get swap history for a theme
   */
  async getThemeSwaps(
    id: string,
    params?: { limit?: number; offset?: number }
  ): Promise<{ data: TokenSwapResponse[] }> {
    const searchParams = new URLSearchParams();
    
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    const query = searchParams.toString();
    const endpoint = query ? `/themes/${id}/swaps?${query}` : `/themes/${id}/swaps`;
    
    return this.fetch<{ data: TokenSwapResponse[] }>(endpoint);
  }

  /**
   * GET /api/themes/:id/price-history - Get price history for a theme
   */
  async getThemePriceHistory(
    id: string,
    range: '24h' | '7d' | '30d' = '24h'
  ): Promise<{ data: PriceHistoryPoint[] }> {
    return this.fetch<{ data: PriceHistoryPoint[] }>(
      `/themes/${id}/price-history?range=${range}`
    );
  }

  /**
   * GET /api/users/:pubkey/themes - Get themes created by user
   */
  async getUserThemes(pubkey: string): Promise<{ data: ThemeResponse[] }> {
    return this.fetch<{ data: ThemeResponse[] }>(`/users/${pubkey}/themes`);
  }

  /**
   * GET /api/ideas - List ideas with filtering
   */
  async getIdeas(params?: IdeaListParams): Promise<PaginatedResponse<IdeaResponse>> {
    const searchParams = new URLSearchParams();
    
    if (params?.status) searchParams.append('status', params.status);
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.order) searchParams.append('order', params.order);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    const query = searchParams.toString();
    const endpoint = query ? `/ideas?${query}` : '/ideas';
    
    return this.fetch<PaginatedResponse<IdeaResponse>>(endpoint);
  }

  /**
   * GET /api/ideas/:id - Get idea by ID
   */
  async getIdeaById(id: string): Promise<IdeaResponse> {
    return this.fetch<IdeaResponse>(`/ideas/${id}`);
  }

  /**
   * GET /api/ideas/:id/votes - Get votes for an idea
   */
  async getIdeaVotes(id: string): Promise<VoteResponse[]> {
    return this.fetch<VoteResponse[]>(`/ideas/${id}/votes`);
  }

  /**
   * GET /api/users/:pubkey/activity - Get user activity
   */
  async getUserActivity(pubkey: string): Promise<UserActivityResponse> {
    return this.fetch<UserActivityResponse>(`/users/${pubkey}/activity`);
  }

  /**
   * GET /api/users/:pubkey/portfolio - Get user portfolio (wallet data)
   */
  async getUserPortfolio(pubkey: string): Promise<any> {
    return this.fetch<any>(`/users/${pubkey}/portfolio`);
  }

  /**
   * GET /api/stats - Get platform statistics
   */
  async getStats(): Promise<StatsResponse> {
    return this.fetch<StatsResponse>('/stats');
  }

  /**
   * GET /api/leaderboard/themes - Get theme leaderboard
   */
  async getThemeLeaderboard(sortBy: 'votes' | 'market_cap' = 'votes'): Promise<PaginatedResponse<any>> {
    return this.fetch<PaginatedResponse<any>>(`/leaderboard/themes?sortBy=${sortBy}`);
  }

  /**
   * GET /api/leaderboard/ideas - Get idea leaderboard
   */
  async getIdeaLeaderboard(status: 'Voting' | 'Completed' = 'Voting'): Promise<PaginatedResponse<any>> {
    return this.fetch<PaginatedResponse<any>>(`/leaderboard/ideas?status=${status}`);
  }

  /**
   * GET /api/leaderboard/voters - Get voter leaderboard
   */
  async getVoterLeaderboard(): Promise<PaginatedResponse<any>> {
    return this.fetch<PaginatedResponse<any>>('/leaderboard/voters');
  }

  /**
   * POST /api/upload/images - Upload images to IPFS
   */
  async uploadImages(files: File[]): Promise<UploadResponse> {
    const formData = new FormData();
    
    files.forEach((file) => {
      formData.append('images', file);
    });

    const response = await fetch(`${this.baseUrl}/upload/images`, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - browser will set it with boundary
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Failed to upload images');
    }

    return await response.json();
  }

  /**
   * Check API health
   */
  async health(): Promise<{ status: string; timestamp: string }> {
    const response = await fetch(`${this.baseUrl.replace('/api', '')}/health`);
    return await response.json();
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Export class for custom instances
export default APIClient;
