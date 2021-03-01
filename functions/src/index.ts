/* eslint-disable require-jsdoc */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as _ from "lodash";

interface ImageEntry {
  path: string;
  url: string;
  wins: number;
  losses: number;
  score: number;
}

interface ImagePairResponse {
  status: "ok" | "error";
  pair?: [string, string];
  errorMessage?: string;
}

interface UpdateScoresRequest {
  images: [ImageEntry, ImageEntry];
  winner: 0 | 1;
}

function getRandomIndices(
    arraySize: number,
    replacement: boolean = false
): [number, number] {
  const indexA = _.random(arraySize);
  let indexB = _.random(arraySize);

  if (!replacement && (indexA === indexB)) {
    const maxAttempts = 10;
    const attemptcount = 0;
    while (attemptcount < maxAttempts) {
      indexB = _.random(arraySize);
      if (indexA !== indexB) {
        break;
      }
    }
  }

  return [indexA, indexB];
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function getNewRating(
    rating: number,
    actualScore: number,
    expectedScore: number
): number {
  return rating + 32 * (actualScore - expectedScore);
}

admin.initializeApp();

// Get a pair of images from the database with similar ELO scores
export const getImagePair = functions.https.onCall(
    async (data, context): Promise<ImagePairResponse | null> => {
      // METHOD A: Choose a random document from storage and
      // retrieve it and an immediate neighbor from the database
      try {
        const bucket = admin.storage().bucket("gs://cat-art-ai.appspot.com");
        const [files] = await bucket.getFiles({prefix: "samples"});
        const [indexA, indexB] = getRandomIndices(files.length, false);
        functions.logger.log(indexA, indexB);
        return {
          status: "ok",
          pair: [files[indexA].name, files[indexB].name],
        };
      } catch (err) {
        return {
          status: "error",
          errorMessage: err.message,
        };
      }
    }
);

export const updateScores = functions.https.onCall(
    async (data: UpdateScoresRequest, context): Promise<void> => {
      try {
        const winner = data.images[data.winner];
        const loser = (data.winner === 0) ? data.images[1]: data.images[0];

        winner.wins = winner.wins + 1;
        loser.losses = loser.losses + 1;

        const prevWinnerScore = winner.score;
        const prevLoserScore = loser.score;

        const winProbA = expectedScore(prevWinnerScore, prevLoserScore);
        const winProbB = 1 - winProbA;

        winner.score = getNewRating(prevWinnerScore, 1, winProbA);
        loser.score = getNewRating(prevLoserScore, 0, winProbB);

        functions.logger.log(
            `${winner.path}: (${prevWinnerScore}) => (${winner.score}), \
            ${loser.path}: (${prevLoserScore}) => (${loser.score})`);

        const firestore = admin.firestore();
        const batch = firestore.batch();
        batch.update(
            firestore.doc(winner.path.split(".")[0]),
            winner);
        batch.update(
            firestore.doc(loser.path.split(".")[0]),
            loser);
        await batch.commit();
      } catch (err) {
        functions.logger.error(err.message);
      }
    }
);
