import { PinataSDK } from 'pinata';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import { Readable } from 'stream';

/**
 * IPFS Service - Handles file uploads to IPFS using Pinata SDK
 */
export class IPFSService {
  private static instance: IPFSService;
  private pinata: PinataSDK;

  private constructor() {
    // Initialize Pinata SDK
    this.pinata = new PinataSDK({
      pinataJwt: config.ipfs.pinataJwt!,
      pinataGateway: config.ipfs.gateway,
    });
    
    logger.info('IPFS service initialized with Pinata SDK', {
      gateway: config.ipfs.gateway,
    });
  }

  public static getInstance(): IPFSService {
    if (!IPFSService.instance) {
      IPFSService.instance = new IPFSService();
    }
    return IPFSService.instance;
  }

  /**
   * Upload file to IPFS using Pinata SDK
   */
  public async uploadFile(
    filePath: string,
    fileName: string
  ): Promise<{ cid: string; uri: string }> {
    try {
      // Read file and create File object for SDK
      const fileBuffer = fs.readFileSync(filePath);
      const blob = new Blob([fileBuffer]);
      const file = new File([blob], fileName);

      // Upload to IPFS with metadata
      const upload = await this.pinata.upload.file(file).addMetadata({
        name: fileName,
        keyvalues: {
          project: 'taste.fun',
          timestamp: new Date().toISOString(),
        },
      });

      const cid = upload.cid;
      const uri = `ipfs://${cid}`;

      logger.info('File uploaded to Pinata', { 
        fileName, 
        cid,
        fileId: upload.id,
        size: upload.size,
      });

      return { cid, uri };
    } catch (error) {
      logger.error('Failed to upload to Pinata', { 
        error: error instanceof Error ? error.message : error, 
        fileName,
      });
      throw error;
    }
  }

  /**
   * Upload multiple files to IPFS
   */
  public async uploadFiles(
    files: { path: string; name: string }[]
  ): Promise<{ cid: string; uri: string }[]> {
    const results = await Promise.all(
      files.map((file) => this.uploadFile(file.path, file.name))
    );
    return results;
  }

  /**
   * Upload from stream (for multer integration)
   */
  public async uploadFromStream(
    stream: Readable,
    fileName: string
  ): Promise<{ cid: string; uri: string }> {
    try {
      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      // Create File object
      const blob = new Blob([buffer]);
      const file = new File([blob], fileName);

      // Upload using SDK
      const upload = await this.pinata.upload.file(file).addMetadata({
        name: fileName,
        keyvalues: {
          project: 'taste.fun',
          timestamp: new Date().toISOString(),
        },
      });

      const cid = upload.cid;
      const uri = `ipfs://${cid}`;

      logger.info('File uploaded from stream to Pinata', { 
        fileName, 
        cid,
        size: upload.size,
      });

      return { cid, uri };
    } catch (error) {
      logger.error('Failed to upload stream to Pinata', { 
        error: error instanceof Error ? error.message : error, 
        fileName,
      });
      throw error;
    }
  }

  /**
   * Get gateway URL for a CID
   */
  public getGatewayUrl(cid: string): string {
    return `https://${config.ipfs.gateway}/ipfs/${cid}`;
  }

  /**
   * Retrieve file from IPFS via gateway
   */
  public async getFile(cid: string): Promise<any> {
    try {
      const data = await this.pinata.gateways.get(cid);
      logger.info('File retrieved from IPFS', { cid });
      return data;
    } catch (error) {
      logger.error('Failed to retrieve file from IPFS', { 
        error: error instanceof Error ? error.message : error, 
        cid,
      });
      throw error;
    }
  }

  /**
   * Convert CID to gateway URL using SDK
   */
  public async convertToUrl(cid: string): Promise<string> {
    try {
      const url = await this.pinata.gateways.convert(cid);
      return url;
    } catch (error) {
      logger.error('Failed to convert CID to URL', { 
        error: error instanceof Error ? error.message : error, 
        cid,
      });
      throw error;
    }
  }

  /**
   * List uploaded files with pagination
   */
  public async listFiles(options?: {
    limit?: number;
    pageToken?: string;
  }): Promise<any> {
    try {
      const files = await this.pinata.files.list()
        .pageLimit(options?.limit || 10)
        .pageToken(options?.pageToken || '');
      
      logger.info('Listed files from Pinata', { 
        count: files.files?.length || 0,
      });
      
      return files;
    } catch (error) {
      logger.error('Failed to list files', { 
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Delete a file by ID
   */
  public async deleteFile(fileId: string): Promise<void> {
    try {
      await this.pinata.files.delete([fileId]);
      logger.info('File deleted from Pinata', { fileId });
    } catch (error) {
      logger.error('Failed to delete file', { 
        error: error instanceof Error ? error.message : error, 
        fileId,
      });
      throw error;
    }
  }

  /**
   * Check if IPFS service is accessible
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Try to list files with limit 1 to check authentication
      await this.pinata.files.list().pageLimit(1);
      logger.info('IPFS health check passed');
      return true;
    } catch (error) {
      logger.error('IPFS health check failed', { 
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  /**
   * Get file info by CID
   */
  public async getFileInfo(cid: string): Promise<any> {
    try {
      const files = await this.pinata.files.list()
        .cid(cid)
        .pageLimit(1);
      
      if (files.files && files.files.length > 0) {
        return files.files[0];
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to get file info', { 
        error: error instanceof Error ? error.message : error, 
        cid,
      });
      throw error;
    }
  }
}

export default IPFSService;
