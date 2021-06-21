"""
Preprocess training data downloaded from the database
"""
import sys
import os
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image

def parse_cmd():
  parser = argparse.ArgumentParser()

  parser.add_argument('datafile', type=Path, help="JSON file with database data")
  parser.add_argument('images', type=Path, help="Directory with image files")

  return parser.parse_args()


if __name__ == '__main__':
  args = parse_cmd()

  with open(args.datafile, 'r') as f:
    json_data = json.load(f)

  num_images = len(json_data)

  # Map file names with scores and win/loss ratios
  images = np.zeros((num_images, 224, 224, 3), dtype=np.uint8)
  scores = np.zeros(num_images)
  win_rate = np.zeros(num_images)

  # Extract needed information
  for i, entry in enumerate(json_data):
    scores[i] = entry['score']
    win_rate[i] = entry['wins'] / (entry['wins'] + entry['losses'])

    # Load the image, resize it and save it to the ndarray
    filename = entry['path'].split('/')[-1]
    img_data = Image.open(os.path.join(args.images, filename)).convert('RGB')
    img_data = img_data.resize((224, 224))
    images[i] = np.array(img_data)

  # Scale the scores to the interval [0.0, 1.0]
  score_max = np.max(scores)
  score_min = np.min(scores)
  scores = (scores - score_min) / (score_max - score_min)

  # Write the data to file for later
  np.savez('cat-art-data.npz', images=images, scores=scores, win_rate=win_rate)
