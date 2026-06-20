import { executeMediaQuery } from '../database/mediaDb.js';
import tmdbService from './tmdbService.js';

class MediaCacheService {
  async getCachedMedia(tmdbId, mediaType) {
    const result = await executeMediaQuery(
      'SELECT * FROM media_cache WHERE tmdb_id = ? AND media_type = ?',
      [tmdbId, mediaType]
    );
    if (result.success && result.data.length > 0) {
      return this._parseCacheRow(result.data[0]);
    }
    return null;
  }

  async saveToCache(data, mediaType) {
    const tmdbId = data.id;
    if (!tmdbId) return null;

    const genres = data.genres ? JSON.stringify(data.genres) : null;
    const runtime = data.runtime || data.episode_run_time?.[0] || null;
    const releaseDate = data.release_date || data.first_air_date || null;
    const status = data.status || null;
    const numberOfSeasons = data.number_of_seasons || null;
    const numberOfEpisodes = data.number_of_episodes || null;

    const result = await executeMediaQuery(
      `INSERT OR REPLACE INTO media_cache 
        (tmdb_id, media_type, title, original_title, poster_path, backdrop_path, 
         vote_average, vote_count, overview, genres, runtime, release_date,
         number_of_seasons, number_of_episodes, status, credits, videos, images, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        tmdbId, mediaType,
        data.title || data.name || null,
        data.original_title || data.original_name || null,
        data.poster_path || null,
        data.backdrop_path || null,
        data.vote_average || 0,
        data.vote_count || 0,
        data.overview || null,
        genres,
        runtime,
        releaseDate,
        numberOfSeasons,
        numberOfEpisodes,
        status,
        data.credits ? JSON.stringify(data.credits) : null,
        data.videos ? JSON.stringify(data.videos) : null,
        data.images ? JSON.stringify(data.images) : null
      ]
    );

    return result.success ? { tmdbId, mediaType } : null;
  }

  async getOrFetchMovie(movieId) {
    const cached = await this.getCachedMedia(movieId, 'movie');
    if (cached) return cached;

    try {
      const data = await tmdbService.getMovieDetails(movieId);
      await this.saveToCache(data, 'movie');
      return this._parseTMDbData(data, 'movie');
    } catch (error) {
      console.error(`Ошибка получения фильма ${movieId}:`, error.message);
      return null;
    }
  }

  async getOrFetchTV(tvId) {
    const cached = await this.getCachedMedia(tvId, 'tv');
    if (cached) return cached;

    try {
      const data = await tmdbService.getTVDetails(tvId);
      await this.saveToCache(data, 'tv');
      return this._parseTMDbData(data, 'tv');
    } catch (error) {
      console.error(`Ошибка получения сериала ${tvId}:`, error.message);
      return null;
    }
  }

  async getOrFetch(tmdbId, mediaType) {
    if (mediaType === 'tv') return this.getOrFetchTV(tmdbId);
    return this.getOrFetchMovie(tmdbId);
  }

  async refreshCache(tmdbId, mediaType) {
    try {
      const data = mediaType === 'tv'
        ? await tmdbService.getTVDetails(tmdbId)
        : await tmdbService.getMovieDetails(tmdbId);
      await this.saveToCache(data, mediaType);
      return this._parseTMDbData(data, mediaType);
    } catch (error) {
      console.error(`Ошибка обновления кэша ${mediaType}/${tmdbId}:`, error.message);
      return null;
    }
  }

  async getCacheStats() {
    const total = await executeMediaQuery('SELECT COUNT(*) as count FROM media_cache');
    const movies = await executeMediaQuery("SELECT COUNT(*) as count FROM media_cache WHERE media_type = 'movie'");
    const tv = await executeMediaQuery("SELECT COUNT(*) as count FROM media_cache WHERE media_type = 'tv'");

    return {
      total: total.data?.[0]?.count || 0,
      movies: movies.data?.[0]?.count || 0,
      tv: tv.data?.[0]?.count || 0
    };
  }

  _parseCacheRow(row) {
    let genres = null;
    if (row.genres) {
      try { genres = JSON.parse(row.genres); } catch { genres = null; }
    }
    let credits = null;
    if (row.credits) {
      try { credits = JSON.parse(row.credits); } catch { credits = null; }
    }
    let videos = null;
    if (row.videos) {
      try { videos = JSON.parse(row.videos); } catch { videos = null; }
    }
    let images = null;
    if (row.images) {
      try { images = JSON.parse(row.images); } catch { images = null; }
    }
    return {
      id: row.tmdb_id,
      title: row.title,
      name: row.title,
      original_title: row.original_title,
      original_name: row.original_title,
      poster_path: row.poster_path,
      backdrop_path: row.backdrop_path,
      vote_average: row.vote_average,
      vote_count: row.vote_count,
      overview: row.overview,
      genres,
      runtime: row.runtime,
      release_date: row.release_date,
      first_air_date: row.release_date,
      number_of_seasons: row.number_of_seasons,
      number_of_episodes: row.number_of_episodes,
      status: row.status,
      credits,
      videos,
      images,
      media_type: row.media_type
    };
  }

  _parseTMDbData(data, mediaType) {
    return {
      id: data.id,
      title: data.title || data.name,
      name: data.name || data.title,
      original_title: data.original_title || data.original_name,
      original_name: data.original_name || data.original_title,
      poster_path: data.poster_path,
      backdrop_path: data.backdrop_path,
      vote_average: data.vote_average,
      vote_count: data.vote_count,
      overview: data.overview,
      genres: data.genres,
      runtime: data.runtime || data.episode_run_time?.[0],
      release_date: data.release_date || data.first_air_date,
      first_air_date: data.first_air_date || data.release_date,
      number_of_seasons: data.number_of_seasons,
      number_of_episodes: data.number_of_episodes,
      status: data.status,
      media_type: mediaType
    };
  }

  // === Person Cache ===

  async getCachedPerson(personId) {
    const result = await executeMediaQuery(
      'SELECT * FROM person_cache WHERE tmdb_id = ?',
      [personId]
    );
    if (result.success && result.data.length > 0) {
      return this._parsePersonRow(result.data[0]);
    }
    return null;
  }

  async savePersonToCache(data) {
    const personId = data.id;
    if (!personId) return null;

    await executeMediaQuery(
      `INSERT OR REPLACE INTO person_cache
        (tmdb_id, name, also_known_as, biography, birthday, deathday,
         place_of_birth, profile_path, popularity, known_for, images, combined_credits, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        personId,
        data.name || null,
        data.also_known_as ? JSON.stringify(data.also_known_as) : null,
        data.biography || null,
        data.birthday || null,
        data.deathday || null,
        data.place_of_birth || null,
        data.profile_path || null,
        data.popularity || 0,
        data.known_for ? JSON.stringify(data.known_for) : null,
        data.images ? JSON.stringify(data.images) : null,
        data.combined_credits ? JSON.stringify(data.combined_credits) : null
      ]
    );

    return { personId };
  }

  async getOrFetchPerson(personId) {
    const cached = await this.getCachedPerson(personId);
    if (cached) return cached;

    try {
      const data = await tmdbService.getPersonDetails(personId);
      await this.savePersonToCache(data);
      return this._parsePersonData(data);
    } catch (error) {
      console.error(`Ошибка получения персоны ${personId}:`, error.message);
      return null;
    }
  }

  _parsePersonRow(row) {
    let alsoKnownAs = null;
    if (row.also_known_as) {
      try { alsoKnownAs = JSON.parse(row.also_known_as); } catch {}
    }
    let knownFor = null;
    if (row.known_for) {
      try { knownFor = JSON.parse(row.known_for); } catch {}
    }
    let images = null;
    if (row.images) {
      try { images = JSON.parse(row.images); } catch {}
    }
    let combinedCredits = null;
    if (row.combined_credits) {
      try { combinedCredits = JSON.parse(row.combined_credits); } catch {}
    }
    return {
      id: row.tmdb_id,
      name: row.name,
      also_known_as: alsoKnownAs,
      biography: row.biography,
      birthday: row.birthday,
      deathday: row.deathday,
      place_of_birth: row.place_of_birth,
      profile_path: row.profile_path,
      popularity: row.popularity,
      known_for: knownFor,
      images,
      combined_credits: combinedCredits
    };
  }

  _parsePersonData(data) {
    return {
      id: data.id,
      name: data.name,
      also_known_as: data.also_known_as,
      biography: data.biography,
      birthday: data.birthday,
      deathday: data.deathday,
      place_of_birth: data.place_of_birth,
      profile_path: data.profile_path,
      popularity: data.popularity,
      known_for: data.known_for,
      images: data.images,
      combined_credits: data.combined_credits
    };
  }
}

export default new MediaCacheService();
