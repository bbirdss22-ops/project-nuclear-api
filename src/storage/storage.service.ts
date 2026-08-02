import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const BANK_BOOKS_BUCKET = 'bank-books';
const BANK_BOOK_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    if (url && serviceRoleKey) {
      this.supabase = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } else {
      this.logger.warn(
        '⚠️ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured — storage disabled',
      );
      this.supabase = createClient(url ?? '', serviceRoleKey ?? '');
    }
  }

  get isAvailable(): boolean {
    return (
      !!this.configService.get<string>('SUPABASE_URL') &&
      !!this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')
    );
  }

  isAllowedBankBookMime(mimetype: string): boolean {
    return BANK_BOOK_MIME_TYPES.includes(mimetype);
  }

  /**
   * Upload a bank book image to the (already created) private "bank-books" bucket.
   * Path convention: bank-books/{customerId}/{timestamp}-{filename}
   */
  async uploadBankBook(
    customerId: string,
    fileBuffer: Buffer,
    mimetype: string,
    filename: string,
  ): Promise<string> {
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${customerId}/${Date.now()}-${sanitized}`;
    const { error } = await this.supabase.storage
      .from(BANK_BOOKS_BUCKET)
      .upload(path, fileBuffer, {
        contentType: mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error(
        `❌ Supabase upload failed (customer ${customerId}): ${error.message}`,
      );
      throw error;
    }

    this.logger.log(
      `📤 Bank book uploaded (customer ${customerId}) → ${path}`,
    );
    return path;
  }

  /**
   * Create a signed URL for a stored object (default 5 minutes).
   */
  async createSignedUrl(
    path: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(BANK_BOOKS_BUCKET)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      this.logger.error(`❌ createSignedUrl failed: ${error.message}`);
      throw error;
    }

    return data.signedUrl;
  }

  /**
   * Delete an object from the bucket.
   */
  async deleteFile(path: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(BANK_BOOKS_BUCKET)
      .remove([path]);

    if (error) {
      this.logger.error(`❌ deleteFile failed (${path}): ${error.message}`);
      throw error;
    }
  }
}
