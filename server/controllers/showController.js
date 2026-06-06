import axios from "axios";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";

const tmdbHeaders = () => ({
  accept: "application/json",
  Authorization: `Bearer ${process.env.TMDB_API_KEY?.trim()}`,
  "User-Agent": "Mozilla/5.0",
});

export const getNowPlayingMovies = async (req, res) => {
  try {
    const token = process.env.TMDB_API_KEY?.trim();

    if (!token) {
      return res.status(500).json({
        success: false,
        message: "TMDB_API_KEY missing in .env",
      });
    }

    const { data } = await axios.get(
      "https://api.themoviedb.org/3/movie/now_playing?language=en-US&page=1",
      {
        headers: tmdbHeaders(),
        timeout: 30000,
      }
    );

    return res.json({
      success: true,
      movies: data.results || [],
    });
  } catch (error) {
    console.log("TMDB ERROR:", error.code, error.message);
    console.log("TMDB RESPONSE:", error.response?.data);

    return res.status(500).json({
      success: false,
      code: error.code,
      message: error.response?.data?.status_message || error.message,
    });
  }
};

export const addShow = async (req, res) => {
  try {
    const { movieId, showsInput, showPrice } = req.body;

    if (!movieId || !showsInput || !showPrice) {
      return res.status(400).json({
        success: false,
        message: "movieId, showsInput and showPrice are required",
      });
    }

    let movie = await Movie.findById(movieId);

    if (!movie) {
      const [movieDetailsResponse, movieCreditsResponse] = await Promise.all([
        axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, {
          headers: tmdbHeaders(),
          timeout: 30000,
        }),
        axios.get(`https://api.themoviedb.org/3/movie/${movieId}/credits`, {
          headers: tmdbHeaders(),
          timeout: 30000,
        }),
      ]);

      const movieApiData = movieDetailsResponse.data;
      const movieCreditsData = movieCreditsResponse.data;

      const movieDetails = {
        _id: movieId,
        title: movieApiData.title,
        overview: movieApiData.overview,
        poster_path: movieApiData.poster_path,
        backdrop_path: movieApiData.backdrop_path,
        genres: movieApiData.genres,
        casts: movieCreditsData.cast?.slice(0, 10) || [],
        release_date: movieApiData.release_date,
        original_language: movieApiData.original_language,
        tagline: movieApiData.tagline || "",
        vote_average: movieApiData.vote_average,
        runtime: movieApiData.runtime,
      };

      movie = await Movie.create(movieDetails);
    }

    const showsToCreate = [];

    showsInput.forEach((show) => {
      const showDate = show.date;

      show.time.forEach((time) => {
        const dateTimeString = `${showDate}T${time}`;

        showsToCreate.push({
          movie: movie._id,
          showDateTime: new Date(dateTimeString),
          showPrice: Number(showPrice),
          occupiedSeats: {},
        });
      });
    });

    if (showsToCreate.length > 0) {
      await Show.insertMany(showsToCreate);
    }

    return res.json({
      success: true,
      message: "Show Added successfully.",
    });
  } catch (error) {
    console.error("ADD SHOW ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getShows = async (req, res) => {
  try {
    const shows = await Show.find({
      showDateTime: { $gte: new Date() },
    })
      .populate("movie")
      .sort({ showDateTime: 1 });

    const uniqueShows = [];
    const movieIds = new Set();

    shows.forEach((show) => {
      if (show.movie && !movieIds.has(show.movie._id.toString())) {
        movieIds.add(show.movie._id.toString());
        uniqueShows.push(show.movie);
      }
    });

    return res.json({
      success: true,
      shows: uniqueShows,
    });
  } catch (error) {
    console.error("GET SHOWS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getShow = async (req, res) => {
  try {
    const { movieId } = req.params;

    const shows = await Show.find({
      movie: movieId,
      showDateTime: { $gte: new Date() },
    }).sort({ showDateTime: 1 });

    const movie = await Movie.findById(movieId);

    const dateTime = {};

    shows.forEach((show) => {
      const date = show.showDateTime.toISOString().split("T")[0];

      if (!dateTime[date]) {
        dateTime[date] = [];
      }

      dateTime[date].push({
        time: show.showDateTime,
        showId: show._id,
      });
    });

    return res.json({
      success: true,
      movie,
      dateTime,
    });
  } catch (error) {
    console.error("GET SHOW ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};