import { Component, CUSTOM_ELEMENTS_SCHEMA, ViewChild } from '@angular/core';
import JSZip from 'jszip';
import { zip, FlateError } from "fflate";
import { RouterOutlet } from '@angular/router';
import { ProgressbarModule, ProgressbarType } from 'ngx-bootstrap/progressbar';
import { NgxSpinnerModule, NgxSpinnerService } from "ngx-spinner";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CircleProgressOptions, NgCircleProgressModule } from 'ng-circle-progress';
import {RoundProgressComponent} from 'angular-svg-round-progressbar';
import { EMPTY, from, lastValueFrom, Observable, of, throwError, timer } from 'rxjs';
import { catchError, defaultIfEmpty, delay, map, mergeMap, retry } from 'rxjs/operators';
import { ModalDirective } from 'ngx-bootstrap/modal';

type FileStruct = {
	filename: string;
	data: Blob;
}

@Component({
	standalone: true,
	selector: 'app-root',
	imports: [
		RouterOutlet,
        ProgressbarModule,
		NgxSpinnerModule,
		CommonModule,
		FormsModule,
		NgCircleProgressModule,
		RoundProgressComponent,
		ModalDirective
	],
	providers: [
		{
		  provide: CircleProgressOptions,
		  useValue: {
			radius: 70,
			maxPercent: 100,
			outerStrokeWidth: 10,
			showSubtitle: false,
			innerStrokeColor: "#e6eef0",
			animationDuration: 300,
		  }
		}
	],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss'
})
export class AppComponent {
	zipProgress: number = 0;
	progressType: ProgressbarType = 'success';
	isProcessing: boolean = false;
	fileCountInput: number = 1;
	semicircle: boolean = false;
	radius: number = 100;
	progressBarColor: string = '#0d6efd';
	errorChance: number = 0.2;
	maxRetries: number = 1;
	allowFailure: boolean = true;

	contractIdErrorList: number[] = [];

	@ViewChild('autoShownModal', { static: false }) autoShownModal?: ModalDirective;
	isModalShown = false;

	constructor(private readonly spinner: NgxSpinnerService) {}

	ngOnInit() {
		this.spinner.show();
		
		setTimeout(() => {
		  this.spinner.hide();
		}, 300);
	}

	onKeyUp(event: KeyboardEvent) {
		const inputValue = this.fileCountInput;
		if (inputValue > 100) {
		  this.fileCountInput = 100;
		}
	}

	clear() {
		this.zipProgress = 0;
		this.progressType = 'success';
		this.progressBarColor = '#0d6efd';
		this.isProcessing = false;
		this.contractIdErrorList = [];
	}
	  
	clearAll() {
		this.fileCountInput = 1;
		this.clear();
	}

	async mainZip(): Promise<void> {
		this.clear();
		this.isProcessing = true;
		this.zipProgress = 0;

		const retryDelayMs = 1000;
		
		try {
			if (this.fileCountInput === 1) {
				await this.downloadSingleFile();
				return;
			}
			
			const mainZip = new JSZip();
			const totalSteps = this.fileCountInput + 1; //+1 compression operation

			const fetchFile$ = (index: number) => 
				this.getMockApiZipDataObservable().pipe(
					retry({
						count: this.maxRetries,
						delay: (error, count) => {
							console.warn(`Retrying request (${count}/${this.maxRetries}) due to error:`, error.message);
							return timer(count * retryDelayMs);
						}
					}),
					catchError(error => {
						console.warn(`Failed to fetch file ${index + 1}:`, error);
						this.contractIdErrorList.push(index);
						return this.allowFailure ? EMPTY : throwError(() => error);
					}),
					mergeMap(response => {
						if (!response?.ok) return EMPTY;
						return from(response.blob()).pipe(
							map(blob => ({ filename: this.getFilenameFromResponse(response, `file_${index + 1}.zip`), data: blob } as FileStruct))
						);
					}),
					defaultIfEmpty(null)
				);

			await this.processFilesSequentially(fetchFile$, mainZip, totalSteps);

			if (this.contractIdErrorList.length === this.fileCountInput) {
				throw new Error("All file downloads failed. Cannot create ZIP.");
			}
	
			const zipBlob = await mainZip.generateAsync({ type: "blob" }, metadata => {
				this.zipProgress = Math.round((this.fileCountInput / totalSteps) * 100 + (metadata.percent / totalSteps));
			});
	
			this.downloadFile(zipBlob);
			this.zipProgress = 100;
			this.isModalShown = this.contractIdErrorList.length !== 0;
		} catch (error) {
			this.progressType = 'danger';
			this.progressBarColor = '#dc3545';
			console.error("ZIP creation failed:", error);
		} finally {
			this.isProcessing = false;
		}
	}

	private async processFilesSequentially(fetchFile$: (index: number) => Observable<FileStruct | null>, mainZip: JSZip, totalSteps: number): Promise<void> {
		for (let i = 0; i < this.fileCountInput; i++) {
			const fileData = await lastValueFrom(fetchFile$(i));
			if (fileData) {
				mainZip.file(fileData.filename, fileData.data, { compression: "DEFLATE", compressionOptions: { level: 6 } });
				this.zipProgress = Math.round(((i + 1) / totalSteps) * 100);
			}
		}
	}
	
	async zipMultipleZipFilesWithFflateDelay(): Promise<void> {
		this.clear();
		
		try {
			this.isProcessing = true;
			this.zipProgress = 0;

			if (this.fileCountInput === 1) {
				this.downloadSingleFile();
			} else {
				const files: { [key: string]: Uint8Array } = {};
				const totalFiles = this.fileCountInput + 1;
		
				for (let i = 0; i < this.fileCountInput; i++) {
					const response = await lastValueFrom(this.getMockApiZipDataObservable());
					const filename = this.getFilenameFromResponse(response, `file_${i + 1}.zip`);
		
					const zipData = new Uint8Array(await response.arrayBuffer());
					files[filename] = zipData;
		
					this.zipProgress = Math.round(((i + 1) / totalFiles) * 100);
				}
		
				let compressedSize = 0;
				const fileEntries = Object.entries(files);
				
				const totalSize = fileEntries.reduce((prev, [_, data]) => prev + data.length, 0);
		
				const zipBlob = await new Promise<Blob>((resolve, reject) => {
					const zipChunks: Uint8Array[] = [];
		
					zip(files, (err: FlateError | null, data: Uint8Array) => {
						if (err) {
							reject(err);
							return;
						}
		
						zipChunks.push(data);
						compressedSize += data.length;
		
						this.zipProgress = Math.round((this.fileCountInput / totalFiles) * 100 + (compressedSize / totalFiles));
		
						if (compressedSize >= totalSize) {
							resolve(new Blob(zipChunks, { type: "application/zip" }));
						}
					});
				});
		
				this.downloadFile(zipBlob);
				this.zipProgress = 100;
			}
		} catch (error) {
			this.progressType = 'danger';
			console.error(error);
		} finally {
			this.isProcessing = false;
		}
	}

	private async downloadSingleFile() {
		const response = await lastValueFrom(this.getMockApiZipDataObservable());
		
		if (!response.ok) {
			throw new Error(`Failed to fetch file.`);
		}

		const blob = await response.blob();
		const filename = this.getFilenameFromResponse(response, 'single-file.zip');
		this.downloadFile(blob, filename);
		this.zipProgress = 100;
	}

	private getFilenameFromResponse(response: Response, defaultName: string): string {
		const contentDisposition = response.headers.get("Content-Disposition");
		return contentDisposition ? this.extractFilenameFromContentDisposition(contentDisposition) : defaultName;
	}

	private extractFilenameFromContentDisposition(contentDisposition: string): string {
		const regex = /filename\*?=(?:UTF-8'')?([^;]+)/i;
		const match = regex.exec(contentDisposition ?? '');
		return match ? decodeURIComponent(match[1].replace(/["']/g, '')) : "default.zip";
	}	

	private getMockApiZipDataObservable(): Observable<Response> {
		return of(null).pipe(delay(Math.random() * 500)).pipe(
			mergeMap(() => {
				if (Math.random() < this.errorChance) {
					return throwError(() => new Error('Failed to fetch file from getMockApiZipDataObservable: 500 Internal Server Error'));
				}

				const zip = new JSZip();
				zip.file('test.txt', 'This is a test file inside the ZIP.');

				return zip.generateAsync({ type: 'blob' }).then(zipBlob => {
					return this.createZipResponse(zipBlob);
				});
			})
		);
	}
	  
	private createZipResponse(zipBlob: Blob): Response {
		return new Response(zipBlob, {
			status: 200,
			headers: {
				"Content-Type": "application/zip",
				"Content-Disposition": `attachment; filename="mock-file-${Math.random().toString(36).slice(2, 10)}.zip"`,
			},
		});
	}
	  
	private downloadFile(zipBlob: Blob, fileName: string = "Main.zip") {
		const link = document.createElement("a");
		const objectUrl = URL.createObjectURL(zipBlob);
		link.href = objectUrl;
		link.download = fileName;
		link.click();
		URL.revokeObjectURL(objectUrl);
	}

	getOverlayStyle() {
		const isSemi = this.semicircle;
		const transform = (isSemi ? '' : 'translateY(-50%) ') + 'translateX(-50%)';
	
		return {
		  top: isSemi ? 'auto' : '50%',
		  bottom: isSemi ? '5%' : 'auto',
		  left: '50%',
		  transform,
		  fontSize: this.radius / 3.5 + 'px',
		};
	}

	showModal(): void {
		this.isModalShown = true;
	}
	
	hideModal(): void {
		this.autoShownModal?.hide();
	}
	
	onHidden(): void {
		this.isModalShown = false;
	}
}
