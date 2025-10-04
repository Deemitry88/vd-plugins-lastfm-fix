import { ServiceClient, Track } from "../../../defs";
import Constants from "../constants";
import { incrementApiCall, recordServiceError } from "../utils/debug";

export abstract class BaseService implements ServiceClient {
  protected retryCount = 0;
  protected lastError = 0;

  abstract fetchLatestScrobble(): Promise<Track>;
  abstract validateCredentials(): Promise<boolean>;
  abstract getServiceName(): string;

  protected log(...args: any[]): void {
    console.log(`[${this.getServiceName()}]`, ...args);
  }

  protected logError(...args: any[]): void {
    console.error(`[${this.getServiceName()}] Error:`, ...args);
  }

  protected logVerbose(...args: any[]): void {
    // subclasses will check if verbose logging is enabled
    console.log(`[${this.getServiceName()}] Verbose:`, ...args);
  }

  protected async handleError(error: any): Promise<never> {
    this.lastError = error.error || 0;

    const errorMessage = this.getErrorMessage(error);
    this.logError(errorMessage);
    recordServiceError(
      this.getServiceName().toLowerCase() as any,
      errorMessage,
    );

    throw new Error(`${this.getServiceName()} API Error: ${errorMessage}`);
  }

  protected getErrorMessage(error: any): string {
    if (error.error && Constants.API_ERROR_CODES[error.error]) {
      return Constants.API_ERROR_CODES[error.error];
    }
    return error.message || error.toString() || "Unknown error";
  }

  protected async makeRequest(
    url: string,
    options: RequestInit = {},
  ): Promise<any> {
    try {
      this.logVerbose(`Making request to: ${url}`);
      incrementApiCall();

      const response = await fetch(url, {
        ...options,
        headers: {
          "User-Agent": "Vendetta Multi-Service Scrobbler/3.0.0",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = new Error(
          `HTTP ${response.status}: ${response.statusText}`,
        );
        recordServiceError(
          this.getServiceName().toLowerCase() as any,
          error.message,
        );
        throw error;
      }

      const data = await response.json();

      if (data.error) {
        await this.handleError(data);
      }

      this.retryCount = 0; // worked, reset retry counter
      return data;
    } catch (error) {
      this.retryCount++;
      if (this.retryCount > Constants.MAX_RETRY_ATTEMPTS) {
        this.retryCount = 0;
        recordServiceError(
          this.getServiceName().toLowerCase() as any,
          `Max retries exceeded: ${(error as Error).message}`,
        );
        throw error;
      }

      this.logVerbose(
        `Request failed, retrying (${this.retryCount}/${Constants.MAX_RETRY_ATTEMPTS})`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, Constants.RETRY_DELAY),
      );
      return this.makeRequest(url, options);
    }
  }

  protected isDefaultCover(cover?: string): boolean {
    if (!cover) return true;
    return Constants.DEFAULT_COVER_HASHES.some((hash) => cover.includes(hash));
  }

  protected processAlbumArt(cover?: string): string | null {
    if (!cover || this.isDefaultCover(cover)) {
      return null;
    }
    return cover;
  }

  public getLastError(): number {
    return this.lastError;
  }

  public resetRetryCount(): void {
    this.retryCount = 0;
  }
}
