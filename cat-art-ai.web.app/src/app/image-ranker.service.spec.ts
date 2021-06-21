import { TestBed } from '@angular/core/testing';

import { ImageRankerService } from './image-ranker.service';

describe('ImageRankerService', () => {
  let service: ImageRankerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImageRankerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
