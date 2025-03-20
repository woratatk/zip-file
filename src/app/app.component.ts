import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import JSZip from 'jszip';
import { zip, FlateError } from "fflate";
import { RouterOutlet } from '@angular/router';
import { ProgressbarModule, ProgressbarType } from 'ngx-bootstrap/progressbar';
import { NgxSpinnerModule, NgxSpinnerService } from "ngx-spinner";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CircleProgressOptions, NgCircleProgressModule } from 'ng-circle-progress';
import {RoundProgressComponent} from 'angular-svg-round-progressbar';


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
		RoundProgressComponent
	],
	providers: [
		{
		  provide: CircleProgressOptions,
		  useValue: {
			radius: 70,
			maxPercent: 100,
			outerStrokeWidth: 10,
			showSubtitle: false,
			outerStrokeColor: "#0d6efd",
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

	constructor(private readonly spinner: NgxSpinnerService) {}

	ngOnInit() {
		// this.spinner.show();
		
		// setTimeout(() => {
		//   this.spinner.hide();
		// }, 1000);
	}

	onKeyUp(event: KeyboardEvent) {
		const inputValue = this.fileCountInput;
		if (inputValue > 100) {
		  this.fileCountInput = 100;
		} else if (inputValue < 1) {
		  this.fileCountInput = 1;
		}
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

	clear() {
		this.zipProgress = 0;
		this.progressType = 'success';
		this.isProcessing = false;
	}
	  
	clearAll() {
		this.fileCountInput = 1;
		this.zipProgress = 0;
		this.progressType = 'success';
		this.isProcessing = false;
	}

	async zipMultipleZipFilesWithJsZip(): Promise<void> {
		this.clear();

		try {
			this.isProcessing = true;
			this.zipProgress = 0;

			if (this.fileCountInput === 1) {
				this.downloadSingleFile();
			} else {
				const mainZip = new JSZip();
				const totalSteps = this.fileCountInput + 1;
			
				for (let i = 0; i < this.fileCountInput; i++) {
					const response = await this.getMockApiZipData();
					const filename = this.getFilenameFromResponse(response, `file_${i + 1}.zip`);

					const zipData = await response.blob();
					mainZip.file(filename, zipData);
				
					this.zipProgress = Math.round(((i + 1) / totalSteps) * 100);
				}
			
				const zipBlob = await mainZip.generateAsync({ type: "blob" }, (metadata) => {
					this.zipProgress = Math.round((this.fileCountInput / totalSteps) * 100 + (metadata.percent / totalSteps));
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

	async zipMultipleZipFilesWithJsZipFail(): Promise<void> {
		this.clear();

		try {
			this.isProcessing = true;
			this.zipProgress = 0;

			if (this.fileCountInput === 1) {
				this.downloadSingleFile(true);
			} else {
				const mainZip = new JSZip();
				const totalSteps = this.fileCountInput + 1;
			
				for (let i = 0; i < this.fileCountInput; i++) {
					try {
						const response = await this.getMockApiZipData(true);
				
						if (!response.ok) {
							throw new Error(`Failed to fetch file ${i + 1}`);
						}
				
						const contentDisposition = response.headers.get("Content-Disposition");
						const filename = contentDisposition ? this.extractFilenameFromContentDisposition(contentDisposition) : `file_${i + 1}.zip`;
				
						const zipData = await response.blob();
						mainZip.file(filename, zipData);
				
						this.zipProgress = Math.round(((i + 1) / totalSteps) * 100);
					} catch (error) {
						this.progressType = 'danger';
						console.error(`Error with file ${i + 1}:`, error);
						return;
					}
				}
			
				const zipBlob = await mainZip.generateAsync({ type: "blob" }, (metadata) => {
					this.zipProgress = Math.round((this.fileCountInput / totalSteps) * 100 + (metadata.percent / totalSteps));
				});
			
				this.downloadFile(zipBlob);
				this.zipProgress = 100;
			}
		} catch (error) {
			this.progressType = 'danger';
		  	console.error('Unexpected error:', error);
		} finally {
			this.isProcessing = false;
		}
	}

	async zipMultipleZipFilesWithJsZipParallel(): Promise<void> {
		this.clear();

		try {
			this.isProcessing = true;
			this.zipProgress = 0;

			if (this.fileCountInput === 1) {
				this.downloadSingleFile();
			} else {
				const mainZip = new JSZip();
				const totalSteps = this.fileCountInput + 1;
		
				const responses = await Promise.all(
					Array.from({ length: this.fileCountInput }, () => this.getMockApiZipData())
				);
		
				for (let i = 0; i < this.fileCountInput; i++) {
					const response = responses[i];
	
					const contentDisposition = response.headers.get("Content-Disposition");
					const filename = contentDisposition ? this.extractFilenameFromContentDisposition(contentDisposition) : `file_${i + 1}.zip`;
		
					const zipData = await response.blob();
					mainZip.file(filename, zipData);
		
					this.zipProgress = Math.round(((i + 1) / totalSteps) * 100);
				}
		
				const zipBlob = await mainZip.generateAsync({ type: "blob" }, (metadata) => {
					this.zipProgress = Math.round((this.fileCountInput / totalSteps) * 100 + (metadata.percent / totalSteps));
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

	async zipMultipleZipFilesWithJsZipParallelAllowFail(): Promise<void> {
		this.clear();

		try {
			this.isProcessing = true;
			this.zipProgress = 0;

			if (this.fileCountInput === 1) {
				this.downloadSingleFile(true);
			} else {
				const mainZip = new JSZip();
				const totalSteps = this.fileCountInput + 1;
		
				const responses = await Promise.allSettled(
					Array.from({ length: this.fileCountInput }, () => this.getMockApiZipData(true))
				);
		
				let successfulFiles = 0;
		
				for (let i = 0; i < this.fileCountInput; i++) {
					const result = responses[i];
					
					if (result.status === "fulfilled") {
						const response = result.value;

						const contentDisposition = response.headers.get("Content-Disposition");
						const filename = contentDisposition ? this.extractFilenameFromContentDisposition(contentDisposition) : `file_${i + 1}.zip`;
		
						const zipData = await response.blob();
						mainZip.file(filename, zipData);
						successfulFiles++;
					} else {
						this.progressType = 'danger';
						console.error(`Failed to fetch file ${i + 1}:`, result.reason);
						return;
					}
					
					this.zipProgress = Math.round(((i + 1) / totalSteps) * 100);
				}
		
				if (successfulFiles === 0) {
					throw new Error("All file downloads failed. Cannot create ZIP.");
				}
		
				const zipBlob = await mainZip.generateAsync({ type: "blob" }, (metadata) => {
					this.zipProgress = Math.round((this.fileCountInput / totalSteps) * 100 + (metadata.percent / totalSteps));
				});
		
				this.downloadFile(zipBlob);
				this.zipProgress = 100;
			}
		} catch (error) {
			this.progressType = 'danger';
			console.error("ZIP creation failed:", error);
		} finally {
			this.isProcessing = false;
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
					const response = await this.getMockApiZipData();
					const contentDisposition = response.headers.get("Content-Disposition");
					const filename = contentDisposition ? this.extractFilenameFromContentDisposition(contentDisposition) : `file_${i + 1}.zip`;
		
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

	private async downloadSingleFile(isFail: boolean = false) {
		const response = await this.getMockApiZipData(isFail);
		
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
		const match = contentDisposition?.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
		return match ? decodeURIComponent(match[1].replace(/["']/g, '')) : "default.zip";
	}
	
	private async getMockApiZipData(isFail: boolean = false): Promise<Response> {
		try {
			const mockZipContent = new Uint8Array([80, 75, 3, 4, 20, 0, 0, 0, 8, 0]);
			const zipBlob = new Blob([mockZipContent], { type: "application/zip" });
		
			await this.simulateApiCall();
		
			if (isFail && Math.random() < 0.2) { //20% chance error
				return Promise.reject(new Error("Failed to fetch file: 500 Internal Server Error"));
			}
		
			return this.createZipResponse(zipBlob);
		} catch (error) {
			console.error(error);
			throw error;
		}
	}
	  
	private async simulateApiCall(): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
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

}
