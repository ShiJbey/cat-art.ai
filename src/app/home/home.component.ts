import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { AngularFirestore } from '@angular/fire/firestore';
import { switchMap, map, tap } from 'rxjs/operators';
import { ImageEntry } from 'src/app/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { of, combineLatest, BehaviorSubject, Observable, Subject } from 'rxjs';

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

  public imagesLoaded$: Observable<boolean>;
  public imageA: ImageEntry;
  public imageB: ImageEntry;

  private imageLoadedA: BehaviorSubject<boolean>;
  private imageLoadedB: BehaviorSubject<boolean>;

  constructor(
    private title: Title,
    private firestore: AngularFirestore,
    private functions: AngularFireFunctions) {
      this.imageLoadedA = new BehaviorSubject<boolean>(false);
      this.imageLoadedB = new BehaviorSubject<boolean>(false);
      this.imagesLoaded$ = combineLatest([
        this.imageLoadedA.asObservable(),
        this.imageLoadedB.asObservable()
      ]).pipe(
        map(([loadedA, loadedB]) => !(loadedA && loadedB)),
      );
    }

  public ngOnInit(): void {
    this.title.setTitle('Cat At AI - Rate cat art with machine learning');
    this.getImagePair();
  }

  public onImageLoaded(id: string): void {
    if (id === 'A') {
      this.imageLoadedA.next(true);
    } else {
      this.imageLoadedB.next(true);
    }
  }

  public handleChoice(entry: ImageEntry): void {
    this.resetLoading();
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
    this.resetLoading();
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
      }
    });
  }

  private resetLoading(): void {
    this.imageLoadedA.next(false);
    this.imageLoadedB.next(false);
  }
}
