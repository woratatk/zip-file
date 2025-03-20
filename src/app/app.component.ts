import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import JSZip from 'jszip';
import { zip, FlateError } from "fflate";
import { RouterOutlet } from '@angular/router';
import { ProgressbarModule, ProgressbarType } from 'ngx-bootstrap/progressbar';
import { NgxSpinnerModule, NgxSpinnerService } from "ngx-spinner";
import { CommonModule } from '@angular/common';


@Component({
	standalone: true,
	selector: 'app-root',
	imports: [
		RouterOutlet,
        ProgressbarModule,
		NgxSpinnerModule,
		CommonModule,
	],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss'
})
export class AppComponent {
	zipProgress: number = 0;
	progressType: ProgressbarType = 'success';
	isProcessing: boolean = false; 

	constructor(private readonly spinner: NgxSpinnerService) {}

	ngOnInit() {
		this.spinner.show();
		
		setTimeout(() => {
		  this.spinner.hide();
		}, 1000);
	}

	clear() {
		this.zipProgress = 0;
		this.progressType = 'success';
		this.isProcessing = false;
	}

	async zipMultipleZipFilesWithJsZip(): Promise<void> {
		try {
			this.isProcessing = true;

			const mainZip = new JSZip();
			this.zipProgress = 0;
			const totalFiles = 100 + 1; // +1 for compression step
	
			for (let i = 0; i < totalFiles; i++) {
				const response = await this.getMockApiZipData();

				const contentDisposition = response.headers.get("Content-Disposition");
				const filename = contentDisposition ? this.extractFilenameFromContentDisposition(contentDisposition) : `file_${i + 1}.zip`;
	
				const zipData = await response.blob();
				mainZip.file(filename, zipData);
	
				this.zipProgress = Math.round(((i + 1) / totalFiles) * 100);
			}
	
			const zipBlob = await mainZip.generateAsync({ type: "blob" }, (metadata) => {
				this.zipProgress += Math.round(metadata.percent / 100);
			});
	
			this.downloadFile(zipBlob);
	
			this.zipProgress = 100;
	
		} catch (error) {
			console.error(error);
		} finally {
			this.isProcessing = false;
		}
	}

	async zipMultipleZipFilesWithJsZipFail(): Promise<void> {
		try {
			this.isProcessing = true;

			const mainZip = new JSZip();
			this.zipProgress = 0;
			const totalFiles = 100 + 1;
		
			for (let i = 0; i < totalFiles; i++) {
				try {
					const response = await this.getMockApiZipDataFail();
			
					if (!response.ok) {
						throw new Error(`Failed to fetch file ${i + 1}`);
					}
			
					const contentDisposition = response.headers.get("Content-Disposition");
					const filename = contentDisposition ? this.extractFilenameFromContentDisposition(contentDisposition) : `file_${i + 1}.zip`;
			
					const zipData = await response.blob();
					mainZip.file(filename, zipData);
			
					this.zipProgress = Math.round(((i + 1) / totalFiles) * 100);
				} catch (error) {
					console.error(`Error with file ${i + 1}:`, error);
					this.progressType = 'danger';
					return;
				}
			}
		
			const zipBlob = await mainZip.generateAsync({ type: "blob" }, (metadata) => {
				this.zipProgress += Math.round(metadata.percent / 100);
			});
		
			this.downloadFile(zipBlob);
		
			this.zipProgress = 100;
	  
		} catch (error) {
		  	console.error('Unexpected error:', error);
		} finally {
			this.isProcessing = false;
		}
	}

	async zipMultipleZipFilesWithJsZipParallel(): Promise<void> {
		try {
			this.isProcessing = true;

			const mainZip = new JSZip();
			this.zipProgress = 0;
			const fileCount = 100;
			const totalSteps = fileCount + 1;
	
			const responses = await Promise.all(
				Array.from({ length: fileCount }, () => this.getMockApiZipData())
			);
	
			for (let i = 0; i < fileCount; i++) {
				const response = responses[i];

				const contentDisposition = response.headers.get("Content-Disposition");
				const filename = contentDisposition ? this.extractFilenameFromContentDisposition(contentDisposition) : `file_${i + 1}.zip`;
	
				const zipData = await response.blob();
				mainZip.file(filename, zipData);
	
				this.zipProgress = Math.round(((i + 1) / totalSteps) * 100);
			}
	
			const zipBlob = await mainZip.generateAsync({ type: "blob" }, (metadata) => {
				this.zipProgress = Math.round((fileCount / totalSteps) * 100 + (metadata.percent / totalSteps));
			});
	
			this.downloadFile(zipBlob);
			this.zipProgress = 100;
		} catch (error) {
			console.error(error);
		} finally {
			this.isProcessing = false;
		}
	}

	async zipMultipleZipFilesWithJsZipParallelAllowFail(): Promise<void> {
		try {
			this.isProcessing = true;

			const mainZip = new JSZip();
			this.zipProgress = 0;
			const fileCount = 100;
			const totalSteps = fileCount + 1;
	
			const responses = await Promise.allSettled(
				Array.from({ length: fileCount }, () => this.getMockApiZipDataFail())
			);
	
			let successfulFiles = 0;
	
			for (let i = 0; i < fileCount; i++) {
				const result = responses[i];
				
				if (result.status === "fulfilled") {
					const response = result.value;

					const contentDisposition = response.headers.get("Content-Disposition");
					const filename = contentDisposition ? this.extractFilenameFromContentDisposition(contentDisposition) : `file_${i + 1}.zip`;
	
					const zipData = await response.blob();
					mainZip.file(filename, zipData);
					successfulFiles++;
				} else {
					console.log(`Failed to fetch file ${i + 1}:`, result.reason);
					this.progressType = 'danger';
					return;
				}
				
				this.zipProgress = Math.round(((i + 1) / totalSteps) * 100);
			}
	
			if (successfulFiles === 0) {
				throw new Error("All file downloads failed. Cannot create ZIP.");
			}
	
			const zipBlob = await mainZip.generateAsync({ type: "blob" }, (metadata) => {
				this.zipProgress = Math.round((fileCount / totalSteps) * 100 + (metadata.percent / totalSteps));
			});
	
			this.downloadFile(zipBlob);
			this.zipProgress = 100;
		} catch (error) {
			console.error("ZIP creation failed:", error);
		} finally {
			this.isProcessing = false;
		}
	}
	
	async zipMultipleZipFilesWithFflateDelay(): Promise<void> {
		try {
			this.isProcessing = true;

			const files: { [key: string]: Uint8Array } = {};
			this.zipProgress = 0;
			const totalFiles = 100 + 1;
	
			for (let i = 0; i < totalFiles; i++) {
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
	
					this.zipProgress += Math.round((compressedSize / totalSize) * 100);
	
					if (compressedSize >= totalSize) {
						resolve(new Blob(zipChunks, { type: "application/zip" }));
					}
				});
			});
	
			this.downloadFile(zipBlob);
	
			this.zipProgress = 100;
		} catch (error) {
			console.error(error);
		} finally {
			this.isProcessing = false;
		}
	}

	private extractFilenameFromContentDisposition(contentDisposition: string): string {
		const match = contentDisposition?.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
		return match ? decodeURIComponent(match[1].replace(/["']/g, '')) : "default.zip";
	}
	
	private async getMockApiZipData(): Promise<Response> {
		const mockZipContent = new Uint8Array([80, 75, 3, 4, 20, 0, 0, 0, 8, 0]);
		const zipBlob = new Blob([mockZipContent], { type: "application/zip" });
	
		await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
	
		return new Response(zipBlob, {
			status: 200,
			headers: {
				"Content-Type": "application/zip",
				"Content-Disposition": `attachment; filename="mock-file-${Math.random().toString(36).slice(2, 10)}.zip"`,
			},
		});
	}

	private async getMockApiZipDataFail(): Promise<Response> {
		const mockZipContent = new Uint8Array([80, 75, 3, 4, 20, 0, 0, 0, 8, 0]);
		const zipBlob = new Blob([mockZipContent], { type: "application/zip" });
	  
		await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
	  
		//random 20% chance of failure
		if (Math.random() < 0.2) {
		//   return new Response(null, { status: 500, statusText: "Internal Server Error" });
			return Promise.reject(new Error("Failed to fetch file: 500 Internal Server Error"));
		}
	  
		return new Response(zipBlob, {
		  status: 200,
		  headers: {
			"Content-Type": "application/zip",
			"Content-Disposition": `attachment; filename="mock-file-${Math.random().toString(36).slice(2, 10)}.zip"`,
		  },
		});
	}

	private downloadFile(zipBlob: Blob) {
		const link = document.createElement("a");
		const objectUrl = URL.createObjectURL(zipBlob);
		link.href = objectUrl;
		link.download = "Main_Zip.zip";
		link.click();
		URL.revokeObjectURL(objectUrl);
	}	  

}
