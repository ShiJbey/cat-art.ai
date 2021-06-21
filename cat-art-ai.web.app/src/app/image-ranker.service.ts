import { Injectable } from '@angular/core';
import * as tf from '@tensorflow/tfjs';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ImageRankerService {

  public ready$: Observable<boolean>;

  private readySubject = new BehaviorSubject<boolean>(false);
  private model: tf.GraphModel;

  constructor() {
    this.ready$ = this.readySubject.asObservable();
    this.loadModel().catch(console.error);
  }

  public async predict(input: tf.Tensor): Promise<number> {
    const prediction = this.model.predict(input);
    if (prediction instanceof Array) {
      return prediction[0].dataSync()[0];
    } else if (prediction instanceof tf.Tensor) {
      return prediction.dataSync()[0];
    }
    return 0;
  }

  private async loadModel(): Promise<void> {
    this.model = await tf.loadGraphModel('/assets/tfjs-model-sig/model.json');
    this.readySubject.next(true);
  }

}
