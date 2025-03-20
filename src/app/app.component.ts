import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import JSZip from 'jszip';
import { zip, FlateError } from "fflate";
import { RouterOutlet } from '@angular/router';
import { ProgressbarModule } from 'ngx-bootstrap/progressbar';
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
	totalContracts: number = 0;

	constructor(private readonly spinner: NgxSpinnerService) {}

	ngOnInit() {
		this.spinner.show();
		
		setTimeout(() => {
		  this.spinner.hide();
		}, 1000);
	}

	async zipMultipleZipFilesWithJsZipDelay(): Promise<void> {
		try {
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
		}
	}

	async zipMultipleZipFilesWithJsZipDelayParallel(): Promise<void> {
		try {
			const mainZip = new JSZip();
			this.zipProgress = 0;
			const FILE_COUNT = 100;
			const TOTAL_STEPS = FILE_COUNT + 1; // +1 for compression step
	
			const responses = await Promise.all(
				Array.from({ length: FILE_COUNT }, () => this.getMockApiZipData())
			);
	
			for (let i = 0; i < FILE_COUNT; i++) {
				const response = responses[i];

				const contentDisposition = response.headers.get("Content-Disposition");
				const filename = contentDisposition ? this.extractFilenameFromContentDisposition(contentDisposition) : `file_${i + 1}.zip`;
	
				const zipData = await response.blob();
				mainZip.file(filename, zipData);
	
				this.zipProgress = Math.round(((i + 1) / TOTAL_STEPS) * 100);
			}
	
			const zipBlob = await mainZip.generateAsync({ type: "blob" }, (metadata) => {
				this.zipProgress = Math.round((FILE_COUNT / TOTAL_STEPS) * 100 + (metadata.percent / TOTAL_STEPS));
			});
	
			this.downloadFile(zipBlob);
			this.zipProgress = 100;
		} catch (error) {
			console.error(error);
		}
	}

	async zipMultipleZipFilesWithJsZipDelayAllowFail(): Promise<void> {
		try {
			const mainZip = new JSZip();
			this.zipProgress = 0;
			const FILE_COUNT = 20;
			const TOTAL_STEPS = FILE_COUNT + 1; // +1 for compression step
	
			// Fetch all files in parallel and allow some to fail
			const responses = await Promise.allSettled(
				Array.from({ length: FILE_COUNT }, () => this.getMockApiZipData())
			);
	
			let successfulFiles = 0;
	
			for (let i = 0; i < FILE_COUNT; i++) {
				const result = responses[i];
	
				if (result.status === "fulfilled") {
					const response = result.value;

					const contentDisposition = response.headers.get("Content-Disposition");
					const filename = contentDisposition ? this.extractFilenameFromContentDisposition(contentDisposition) : `file_${i + 1}.zip`;
	
					const zipData = await response.blob();
					mainZip.file(filename, zipData);
					successfulFiles++;
				} else {
					console.warn(`Failed to fetch file ${i + 1}:`, result.reason);
				}
	
				this.zipProgress = Math.round(((i + 1) / TOTAL_STEPS) * 100);
			}
	
			if (successfulFiles === 0) {
				throw new Error("All file downloads failed. Cannot create ZIP.");
			}
	
			const zipBlob = await mainZip.generateAsync({ type: "blob" }, (metadata) => {
				this.zipProgress = Math.round((FILE_COUNT / TOTAL_STEPS) * 100 + (metadata.percent / TOTAL_STEPS));
			});
	
			this.downloadFile(zipBlob);
			this.zipProgress = 100;
		} catch (error) {
			console.error("ZIP creation failed:", error);
		}
	}
	
	async zipMultipleZipFilesWithFflateDelay(): Promise<void> {
		try {
			const files: { [key: string]: Uint8Array } = {};
			this.zipProgress = 0;
			const totalFiles = 20 + 1; //plus 1 for compression process
	
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

	private downloadFile(zipBlob: Blob) {
		const link = document.createElement("a");
		const objectUrl = URL.createObjectURL(zipBlob);
		link.href = objectUrl;
		link.download = "Main_Zip.zip";
		link.click();
		URL.revokeObjectURL(objectUrl);
	}
	
}
