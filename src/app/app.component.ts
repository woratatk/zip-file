import { Component, CUSTOM_ELEMENTS_SCHEMA, ViewChild } from '@angular/core';
import JSZip from 'jszip';
import { RouterOutlet } from '@angular/router';
import { ProgressbarModule, ProgressbarType } from 'ngx-bootstrap/progressbar';
import { NgxSpinnerModule, NgxSpinnerService } from "ngx-spinner";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CircleProgressOptions, NgCircleProgressModule } from 'ng-circle-progress';
import {RoundProgressComponent} from 'angular-svg-round-progressbar';
import { EMPTY, lastValueFrom, Observable, of, throwError, timer } from 'rxjs';
import { catchError, defaultIfEmpty, delay, map, mergeMap, retry, take } from 'rxjs/operators';
import { ModalDirective } from 'ngx-bootstrap/modal';

type ReceiptType = '5' | '6';

type ZipDownloadParams = {
	contractId: number;
	receiptType: ReceiptType;
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
	retryDelayMs: number = 1000;
	maxRetries: number = 1;
	allowFailure: boolean = false;
	contractList: ZipDownloadParams[] = [];
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

	onKeyUp(_: KeyboardEvent) {
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

	/* START ZIP PROCESS */
	
	async mainZip(): Promise<void> {
		this.clear();
		this.contractList = this.mockSelectData();  //mock select data
		this.isProcessing = true;
		this.zipProgress = 0;
		
		try {
			if (this.contractList.length === 1) {
				await this.downloadSingleFile(this.contractList[0]);
				return;
			}
	
			const mainZip = new JSZip();
			const totalSteps = this.contractList.length + 1;
	
			await this.processFilesSequentially(mainZip, totalSteps);
	
			if (this.contractIdErrorList.length === this.fileCountInput) {
				throw new Error("All file downloads failed. Cannot create ZIP.");
			}
	
			await this.generateAndDownloadMainZip(mainZip, totalSteps);
	
		} catch (error) {
			this.progressType = 'danger';
			this.progressBarColor = '#dc3545';
			console.error("ZIP creation failed:", error);
		} finally {
			this.isModalShown = this.contractIdErrorList.length > 0;
			this.isProcessing = false;
		}
	}

	private async downloadSingleFile({ contractId, receiptType }: ZipDownloadParams): Promise<void> {
		try {
			const response = await this.fetchFileWithRetry({ contractId, receiptType });
			if (!response) throw new Error(`No contract found for contractId ${contractId} and receiptType ${receiptType}`);
	  
			const blob = await response.blob();
			const filename = this.getFilenameFromResponse(response, `file_${contractId}.zip`);

			this.downloadFile(blob, filename);
			this.zipProgress = 100;
		} catch (error) {
			console.error(`Download failed for contractId ${contractId}:`, error);
		} finally {
			this.isModalShown = this.contractIdErrorList.length > 0;
		}
	}

	private async processFilesSequentially(mainZip: JSZip, totalSteps: number): Promise<void> {
		for (let i = 0; i < this.contractList.length; i++) {
			const fileData = await this.fetchFileWithRetry(this.contractList[i]);

			if(!fileData) {
				if(!this.allowFailure) throw new Error(`No contract found for contractId ${this.contractList[i].contractId} and receiptType ${this.contractList[i].receiptType}`);
				continue;
			}
			
			const blob = await fileData.blob();
			const filename = this.getFilenameFromResponse(fileData, `file_${this.contractList[i].contractId}.zip`);

			mainZip.file(filename, blob, { compression: "DEFLATE", compressionOptions: { level: 6 } });

			this.zipProgress = Math.round(((i + 1) / totalSteps) * 100);
		}
	}

	private fetchFileWithRetry({ contractId, receiptType }: ZipDownloadParams): Promise<Response | null> {
		return lastValueFrom(
			this.getMockApiZipDataObservable(contractId, receiptType).pipe(
				take(1),
				retry({
					count: this.maxRetries,
					delay: (error, count) => {
						console.warn(`Retrying request (${count}/${this.maxRetries}) due to error:`, error.message);
						return timer(count * this.retryDelayMs);
					}
				}),
				catchError(error => {
					console.warn(`Failed to fetch file from contractId ${contractId}:`, error);
					this.contractIdErrorList.push(contractId);
					return this.allowFailure ? EMPTY : throwError(() => error);
				}),
				map(response => response?.ok ? response : null),
				defaultIfEmpty(null)
			)
		);
	}

	private async generateAndDownloadMainZip(mainZip: JSZip, totalSteps: number): Promise<void> {		
		const zipBlob = await mainZip.generateAsync({ type: "blob" }, metadata => {
			this.zipProgress = this.zipProgress + (metadata.percent / totalSteps);
		});
	
		this.downloadFile(zipBlob, "Main.zip");
		this.zipProgress = 100;
	}

	private downloadFile(zipBlob: Blob, fileName: string) {
		const link = document.createElement("a");
		const objectUrl = URL.createObjectURL(zipBlob);
		link.href = objectUrl;
		link.download = fileName;
		link.click();
		URL.revokeObjectURL(objectUrl);
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

	/* END ZIP PROCESS */

	/* START MOCK DATA */

	//mock contract checkbox selection
	private mockSelectData(): ZipDownloadParams[] {
		return Array.from({ length: this.fileCountInput }, (_, index) => ({
			contractId: index + 1,
			receiptType: Math.random() < 0.5 ? '5' : '6'
		}));
	}

	private getMockApiZipDataObservable(contractId: number, receiptType: ReceiptType): Observable<Response> {
		return of(null).pipe(delay(Math.random() * 500)).pipe(
			mergeMap(() => {
				if (Math.random() < this.errorChance) {
					return throwError(() => new Error(`Failed to fetch file from contractId=${contractId}, receiptType=${receiptType}: 500 Internal Server Error`));
				}

				const zip = new JSZip();
				zip.file('inner-test-file.txt', 'This is a inner test file inside the ZIP.');

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

	/* END MOCK DATA */

	/* START MODAL */

	showModal(): void {
		this.isModalShown = true;
	}
	
	hideModal(): void {
		this.autoShownModal?.hide();
	}
	
	onHidden(): void {
		this.isModalShown = false;
	}

	/* END MODAL */

	/* START CIRCLE PROGRESS STYLE */

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

	/* END CIRCLE PROGRESS STYLE */
}
