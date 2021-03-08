import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { AngularFirestore } from '@angular/fire/firestore';
import { switchMap, map, tap, take, throttleTime } from 'rxjs/operators';
import { ImageEntry } from 'src/app/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { of, combineLatest, BehaviorSubject, Observable, Subject } from 'rxjs';

interface ImagePairResponse {
  status: 'ok' | 'error';
  images?: [ImageEntry, ImageEntry];
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
  private clickDebounce: Subject<ImageEntry>;


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

      this.clickDebounce = new Subject<ImageEntry>();
      this.clickDebounce.asObservable().pipe(
        throttleTime(500)
      ).subscribe((choice) => {
        this.handleChoice(choice);
      });
    }

  public ngOnInit(): void {
    this.title.setTitle('CatArt.AI - Rate the awesomeness of cat art with machine learning');
    this.getImagePair();
  }

  public onImageLoaded(id: string): void {
    if (id === 'A') {
      this.imageLoadedA.next(true);
    } else {
      this.imageLoadedB.next(true);
    }
  }

  public onImageClick(entry: ImageEntry): void {
    this.clickDebounce.next(entry);
  }

  public handleChoice(entry: ImageEntry): void {
    console.log('Image clicked');
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
      map((resp: ImagePairResponse) => {
        if (resp && resp.status === 'ok') {
          return resp.images;
        }
        return null;
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
