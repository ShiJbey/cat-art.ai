import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { map, throttleTime } from 'rxjs/operators';
import { AngularFireFunctions } from '@angular/fire/functions';
import { combineLatest, BehaviorSubject, Observable, Subject } from 'rxjs';
import * as tf from '@tensorflow/tfjs';
import { ImageEntry } from 'src/app/core';
import { loadImageFile } from '../utils';
import { ImageRankerService } from '../image-ranker.service';

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

  @ViewChild('uploadPreview', {static: false}) imagePreview: ElementRef;
  public uploadedImageURL: string;
  public awesomenessScore: number;
  public modelReady: Observable<boolean>;
  public loading = false;

  public imagesLoaded$: Observable<boolean>;
  public imageA: ImageEntry;
  public imageB: ImageEntry;

  private imageLoadedA: BehaviorSubject<boolean>;
  private imageLoadedB: BehaviorSubject<boolean>;
  private clickDebounce: Subject<ImageEntry>;


  constructor(
    private title: Title,
    private functions: AngularFireFunctions,
    private imageRanker: ImageRankerService) {
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

      this.modelReady = this.imageRanker.ready$;
    }

  public ngOnInit(): void {
    this.title.setTitle('CatArt.AI - Rate the awesomeness of cat art with machine learning');
    this.getImagePair();
  }

  public async onImageUpload(event: Event): Promise<void> {
    this.loading = true;
    const file = (event.target as HTMLInputElement).files[0];
    try {
      if (file) {
        this.uploadedImageURL = await loadImageFile(file);
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.loading = false;
    }
  }

  public async scoreImage() {
    try {
      let x = tf.browser.fromPixels(this.imagePreview.nativeElement);
      x = tf.image.resizeBilinear(x, [224, 224]);
      x = tf.expandDims(x);
      this.imageRanker.predict(x)
        .then((score) => {
          this.awesomenessScore = score;
        });
    } catch (err) {
      console.error(err);
    }
  }

  public getScoreColor(): string {
    if (this.awesomenessScore <= 0.40) {
      return 'poor-score';
    } else if (this.awesomenessScore < 0.70) {
      return 'okay-score';
    } else {
      return 'good-score';
    }
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
