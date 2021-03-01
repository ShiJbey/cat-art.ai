import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { AngularFirestore } from '@angular/fire/firestore';
import { combineAll, map, switchMap, take } from 'rxjs/operators';
import { ImageEntry } from 'src/app/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { of, combineLatest } from 'rxjs';

interface ImagePairResponse {
  status: 'ok' | 'error';
  pair?: [string, string];
  errorMessage?: string;
}

interface UpdateScoresRequest {
  images: [ImageEntry, ImageEntry];
  winner: 0 | 1;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {

  public loading = true;
  public imageA: ImageEntry;
  public imageB: ImageEntry;

  constructor(
    private title: Title,
    private firestore: AngularFirestore,
    private functions: AngularFireFunctions) {}

  public ngOnInit(): void {
    this.title.setTitle('Cat At AI - Rate cat art with machine learning');
    this.getImagePair();
  }

  public handleChoice(entry: ImageEntry): void {
    this.loading = true;
    const updateScores = this.functions.httpsCallable('updateScores');
    const req: UpdateScoresRequest = {
      images: [this.imageA, this.imageB],
      winner: (entry.path === this.imageA.path) ? 0 : 1
    };
    updateScores(req).subscribe(() => {
      this.getImagePair();
    });
  }

  private getImagePair(): void {
    this.loading = true;
    const getImageNames = this.functions.httpsCallable('getImagePair');
    getImageNames({}).pipe(
      switchMap((resp: ImagePairResponse) => {
        if (resp && resp.status === 'ok') {
          // remove the extenstion from the images
          const [docA, docB] = resp.pair.map(val => val.split('.')[0]);

          return combineLatest([
            this.firestore.doc<ImageEntry>(docA).valueChanges(),
            this.firestore.doc<ImageEntry>(docB).valueChanges()
          ]);
        }
        return of(null);
      })
    ).subscribe((val) => {
      if (val) {
        const [imageA, imageB] = val;
        this.imageA = imageA;
        this.imageB = imageB;
        this.loading = false;
      }
    });
  }
}
