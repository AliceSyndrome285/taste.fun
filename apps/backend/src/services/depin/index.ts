import axios from 'axios';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { IPFSService } from '../ipfs';
import * as bs58 from 'bs58';

/**
 * DePIN Service - Handles image generation via io.net
 */
export class DePINService {
  private static instance: DePINService;
  private connection: Connection;
  private serviceKeypair: Keypair;
  private program: Program | null = null;

  private constructor() {
    this.connection = new Connection(config.solana.rpcUrl, 'confirmed');
    
    // Load service keypair from private key
    const privateKeyBytes = bs58.decode(config.depin.servicePrivateKey);
    this.serviceKeypair = Keypair.fromSecretKey(privateKeyBytes);

    logger.info('DePIN service initialized', {
      servicePubkey: this.serviceKeypair.publicKey.toString(),
    });
  }

  public static getInstance(): DePINService {
    if (!DePINService.instance) {
      DePINService.instance = new DePINService();
    }
    return DePINService.instance;
  }

  /**
   * Set program instance for calling smart contract
   */
  public setProgram(program: Program): void {
    this.program = program;
  }

  /**
   * Generate images using Cloudflare Worker AI
   */
  public async generateImages(
    ideaPubkey: string,
    prompts: string[],
    depinProvider: string,
    model: string = 'flux-1-schnell'
  ): Promise<string[]> {
    try {
      logger.info('Requesting image generation from Cloudflare Worker', {
        ideaPubkey,
        promptCount: prompts.length,
        model,
      });

      // Call Cloudflare Worker API for batch generation
      // First authenticate to get cookie if password is configured
      let authCookie = '';
      if (config.depin.apiKey) {
        try {
          const authResponse = await axios.post(
            `${config.depin.apiUrl}/api/auth`,
            { password: config.depin.apiKey },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 30000,
            }
          );
          
          // Extract cookie from Set-Cookie header
          const setCookieHeader = authResponse.headers['set-cookie'];
          if (setCookieHeader && setCookieHeader[0]) {
            authCookie = setCookieHeader[0].split(';')[0]; // Get just the auth=1 part
          }
        } catch (authError) {
          logger.warn('Failed to authenticate with DePIN service, trying without auth', { authError });
        }
      }

      // Use batch-generate endpoint for multiple prompts
      const response = await axios.post(
        `${config.depin.apiUrl}/api/batch-generate`,
        {
          prompts,
          model,
          num_steps: model === 'flux-1-schnell' ? 6 : 20,
          height: 1024,
          width: 1024,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(authCookie ? { 'Cookie': authCookie } : {}),
          },
          timeout: 120000, // 2 minutes timeout
        }
      );

      if (!response.data || !response.data.images) {
        throw new Error('Invalid response from Cloudflare Worker');
      }

      const images: string[] = response.data.images;

      if (images.length !== prompts.length) {
        throw new Error(`Expected ${prompts.length} images, got ${images.length}`);
      }

      logger.info('Images generated successfully', {
        ideaPubkey,
        imageCount: images.length,
      });

      // Upload images to IPFS
      logger.info('Uploading images to IPFS', { ideaPubkey, imageCount: images.length });
      const ipfsService = IPFSService.getInstance();
      const imageUris: string[] = [];
      
      for (let i = 0; i < images.length; i++) {
        const base64Data = images[i];
        
        // Convert base64 data URL to buffer
        const base64String = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
        const buffer = Buffer.from(base64String, 'base64');
        
        // Create filename with timestamp and index
        const timestamp = Date.now();
        const fileName = `idea_${ideaPubkey}_option_${i + 1}_${timestamp}.png`;
        
        // Create a temporary file-like object for upload
        const blob = new Blob([buffer], { type: 'image/png' });
        const file = new File([blob], fileName);
        
        try {
          // Upload to IPFS using pinata SDK
          const upload = await ipfsService.pinata.upload.file(file).addMetadata({
            name: fileName,
            keyvalues: {
              project: 'taste.fun',
              ideaPubkey,
              optionIndex: String(i + 1),
              timestamp: new Date().toISOString(),
            },
          });
          
          const ipfsUri = `ipfs://${upload.cid}`;
          imageUris.push(ipfsUri);
          
          logger.info('Image uploaded to IPFS', {
            ideaPubkey,
            optionIndex: i + 1,
            cid: upload.cid,
            size: upload.size,
          });
        } catch (uploadError) {
          logger.error('Failed to upload image to IPFS', {
            error: uploadError,
            ideaPubkey,
            optionIndex: i + 1,
          });
          throw uploadError;
        }
      }

      // Call smart contract to confirm images
      await this.confirmImages(ideaPubkey, imageUris);

      return imageUris;
    } catch (error) {
      logger.error('Failed to generate images', {
        error,
        ideaPubkey,
      });
      throw error;
    }
  }

  /**
   * Generate images using Cloudflare Worker AI (backward compatible single prompt)
   */
  public async generateImagesFromSinglePrompt(
    ideaPubkey: string,
    prompt: string,
    depinProvider: string,
    optionCount: number = 4
  ): Promise<string[]> {
    // Create 4 variations of the same prompt
    const prompts = Array(optionCount).fill(prompt);
    return this.generateImages(ideaPubkey, prompts, depinProvider);
  }

  /**
   * Call smart contract to confirm images
   */
  private async confirmImages(
    ideaPubkey: string,
    imageUris: string[]
  ): Promise<void> {
    if (!this.program) {
      throw new Error('Program not initialized');
    }

    try {
      logger.info('Confirming images on-chain', {
        ideaPubkey,
        imageCount: imageUris.length,
      });

      const ideaPublicKey = new PublicKey(ideaPubkey);

      // Call confirm_images instruction
      const tx = await this.program.methods
        .confirmImages(imageUris)
        .accounts({
          idea: ideaPublicKey,
          depinAuthority: this.serviceKeypair.publicKey,
        })
        .signers([this.serviceKeypair])
        .rpc();

      logger.info('Images confirmed on-chain', {
        ideaPubkey,
        signature: tx,
      });
    } catch (error) {
      logger.error('Failed to confirm images on-chain', {
        error,
        ideaPubkey,
      });
      throw error;
    }
  }

  /**
   * Health check for DePIN service
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      
      // Only add Authorization header if API key is provided
      if (config.depin.apiKey) {
        headers.Authorization = `Bearer ${config.depin.apiKey}`;
      }

      const response = await axios.get(`${config.depin.apiUrl}/health`, {
        headers,
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      logger.error('DePIN health check failed', { error });
      return false;
    }
  }
}

export default DePINService;
