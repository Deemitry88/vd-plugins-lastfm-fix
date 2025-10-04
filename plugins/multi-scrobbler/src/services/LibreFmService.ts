import { Track } from "../../../defs";
import { currentSettings } from "..";
import Constants from "../constants";
import { BaseService } from "./BaseService";

interface LibreFMResponse {
  recenttracks?: {
    track: LibreFMTrack[];
  };
  track?: {
    duration: string;
  };
  error?: number;
  message?: string;
}

interface LibreFMTrack {
  name: string;
  artist: {
    name: string;
  };
  album: {
    "#text": string;
  };
  image?: {
    size: string;
    "#text": string;
  }[];
  url: string;
  date?: {
    "#text": string;
    uts: string;
  };
  "@attr"?: {
    nowplaying: boolean;
  };
  loved: string;
}

export class LibreFmService extends BaseService {
    getServiceName(): string {
        return "Libre.fm";
    }

    protected logVerbose(...args: any[]): void {
        if (currentSettings.verboseLogging) {
            console.log(`[${this.getServiceName()}] Verbose:`, ...args);
        }
    }

    async validateCredentials(): Promise<boolean> {
        try {
            const username = currentSettings.librefmUsername || currentSettings.username;
            const apiKey = currentSettings.librefmApiKey || currentSettings.apiKey;

            if (!username || !apiKey) {
                throw new Error("Username or API key not set for Libre.fm");
            }

            const params = new URLSearchParams({
                method: "user.getinfo",
                user: username,
                api_key: apiKey,
                format: "json",
            });

            const url = `${Constants.SERVICES.librefm.baseUrl}?${params}`;
            await this.makeRequest(url);

            this.log("Credentials validation successful");
            return true;
        } catch (error) {
            this.logError("Credentials validation failed:", error);
            return false;
        }
    }

    async fetchLatestScrobble(): Promise<Track> {
        try {
            const username = currentSettings.librefmUsername || currentSettings.username;
            const apiKey = currentSettings.librefmApiKey || currentSettings.apiKey;

            if (!username || !apiKey) {
                throw new Error("Username or API key not set for Libre.fm");
            }

            this.logVerbose("Fetching latest scrobble for user:", username);

            const params = new URLSearchParams({
                method: "user.getrecenttracks",
                user: username,
                api_key: apiKey,
                limit: "1",
                extended: "1",
                format: "json",
            });

            const url = `${Constants.SERVICES.librefm.baseUrl}?${params}`;
            const data: LibreFMResponse = await this.makeRequest(url);

            const lastTrack = data?.recenttracks?.track?.[0];
            if (!lastTrack) {
                throw new Error("No tracks found");
            }

            this.logVerbose("Raw track data:", lastTrack);

            const isNowPlaying = Boolean(lastTrack["@attr"]?.nowplaying);
            const trackTimestamp = lastTrack.date?.uts ? parseInt(lastTrack.date.uts) : Math.floor(Date.now() / 1000);

            let duration: number | null = null;
            let endTime: number | null = null;

            // Fetch track duration if it's currently playing
            if (isNowPlaying) {
                try {
                    const trackInfoParams = new URLSearchParams({
                        method: "track.getInfo",
                        track: lastTrack.name,
                        artist: lastTrack.artist.name,
                        api_key: apiKey,
                        format: "json",
                    });

                    const trackInfoUrl = `${Constants.SERVICES.librefm.baseUrl}?${trackInfoParams}`;
                    const trackInfo: LibreFMResponse = await this.makeRequest(trackInfoUrl);

                    if (trackInfo?.track?.duration) {
                        duration = parseInt(trackInfo.track.duration);
                        if (duration > 0) {
                            // Duration is in milliseconds, convert to seconds
                            duration = Math.floor(duration / 1000);
                            endTime = trackTimestamp + duration;
                        }
                    }
                } catch (error) {
                    this.logVerbose("Failed to fetch track duration:", error);
                }
            }

            const albumArt = this.processAlbumArt(
                lastTrack.image?.find(img => img.size === "large")?.["#text"]
            );

            const track: Track = {
                name: lastTrack.name,
                artist: lastTrack.artist.name,
                album: lastTrack.album["#text"],
                albumArt,
                url: lastTrack.url,
                date: lastTrack.date?.["#text"] ?? "now",
                nowPlaying: isNowPlaying,
                loved: lastTrack.loved === "1",
                from: trackTimestamp,
                to: endTime,
                duration,
            };

            this.logVerbose("Processed track:", track);
            this.log(`${isNowPlaying ? "Now playing" : "Last played"}:`, `${track.artist} - ${track.name}`);

            return track;
        } catch (error) {
            this.logError("Failed to fetch latest scrobble:", error);
            throw error;
        }
    }
}
