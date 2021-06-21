import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'app-github-corner',
  templateUrl: './github-corner.component.html',
  styleUrls: ['./github-corner.component.scss'],
})
export class GithubCornerComponent implements OnInit {
  @Input() public url = '';

  constructor() {}

  ngOnInit(): void {}
}
