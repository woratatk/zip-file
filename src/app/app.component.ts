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
		// this.spinner.show();
		
		// setTimeout(() => {
		//   this.spinner.hide();
		// }, 2000);
	}

	async zipMultipleZipFilesWithJsZipDelay(): Promise<void> {
		try {
			const mainZip = new JSZip();
			this.zipProgress = 0;
			const totalFiles = 20;
	
			for (let i = 0; i < totalFiles; i++) {
				const response = await this.getMockApiZipData();

				const contentDisposition = response.headers.get("Content-Disposition");
				const filename = contentDisposition ? this.extractFilenameFromContentDisposition(contentDisposition) : `file_${i + 1}.zip`;
	
				const zipData = await response.blob();
				mainZip.file(filename, zipData);
	
				this.zipProgress = Math.round(((i + 1) / totalFiles) * 50);
			}
	
			const zipBlob = await mainZip.generateAsync({ type: "blob" }, (metadata) => {
				this.zipProgress = 50 + Math.round(metadata.percent / 2);
			});
	
			this.downloadFile(zipBlob);
	
			this.zipProgress = 100;
	
		} catch (error) {
			console.error(error);
		}
	}
	
	async zipMultipleZipFilesWithFflateDelay(): Promise<void> {
		try {
			const files: { [key: string]: Uint8Array } = {};
			this.zipProgress = 0;
			const totalFiles = 20;
	
			for (let i = 0; i < totalFiles; i++) {
				const response = await this.getMockApiZipData();
				const contentDisposition = response.headers.get("Content-Disposition");
				const filename = contentDisposition ? this.extractFilenameFromContentDisposition(contentDisposition) : `file_${i + 1}.zip`;
	
				const zipData = new Uint8Array(await response.arrayBuffer());
				files[filename] = zipData;
	
				this.zipProgress = Math.round(((i + 1) / totalFiles) * 50);
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
	
					this.zipProgress = 50 + Math.round((compressedSize / totalSize) * 50);
	
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
		const match = contentDisposition.match(/filename[^;=\n]*=(?:['"]?)([^'";\n]+)(?:['"]?)/);
		return match ? match[1] : "default.zip";
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
		link.href = URL.createObjectURL(zipBlob);
		link.download = "Main_Zip.zip";
		link.click();
	}
	
}
