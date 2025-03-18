import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import JSZip from 'jszip';
import { strToU8, zipSync } from 'fflate';
import { ZipObject } from './model/model';
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
	
				// Update progress first 50% for fetching data
				this.zipProgress = Math.round(((i + 1) / totalFiles) * 50);
			}
	
			const zipBlob = await mainZip.generateAsync({ type: "blob" }, (metadata) => {
				// Update progress second 50% for compression
				this.zipProgress = 50 + Math.round(metadata.percent / 2);
			});
	
			const link = document.createElement("a");
			link.href = URL.createObjectURL(zipBlob);
			link.download = "Main_Zip.zip";
			link.click();
	
			this.zipProgress = 100;
	
		} catch (error) {
			console.error(error);
		}
	}	
	
	private extractFilenameFromContentDisposition(contentDisposition: string): string {
		const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
		return match ? match[1] : "default.zip";
	}
	
	private async getMockApiZipData(): Promise<Response> {
		const mockZipContent = new Uint8Array([80, 75, 3, 4, 20, 0, 0, 0, 8, 0]); // Mock ZIP file header
		const zipBlob = new Blob([mockZipContent], { type: "application/zip" });
	
		await new Promise(resolve => setTimeout(resolve, Math.random() * 1500));
	
		return new Response(zipBlob, {
			status: 200,
			headers: {
				"Content-Type": "application/zip",
				"Content-Disposition": `attachment; filename="mock-file-${Math.random().toString(36).slice(2, 10)}.zip"`,
			},
		});
	}	

	async downloadNestedZip() {
		const apiData = await this.getMockApiData();
		await this.createNestedZipWithJsZip(apiData);
		this.createNestedZipWithFflate(apiData);
	}

	async createNestedZipWithJsZip(apiData: any[]): Promise<void> {
		const mainZip = new JSZip();

		for (const contract of apiData) {
			const subZip = new JSZip();

			for (const file of contract.data) {
				try {
					subZip.file(file.filename, "Hello World\n");
				} catch (error) {
					console.error(`Failed to fetch fileId ${file.fileId}:`, error);
				}
			}

			const subZipBlob = await subZip.generateAsync({ type: 'blob' });
			mainZip.file(`${contract.contractNo}_${contract.contractSequence}.zip`, subZipBlob);
		}

		const mainZipBlob = await mainZip.generateAsync({ type: 'blob' });

		const link = document.createElement('a');
		link.href = URL.createObjectURL(mainZipBlob);
		link.download = 'Main 1.zip';
		link.click();
	}

	async createNestedZipWithFflate(apiData: any[]): Promise<void> {
		const mainZip: { [key: string]: Uint8Array } = {};
	
		for (const contract of apiData) {
			const subZip: { [key: string]: Uint8Array } = {};
	
			for (const file of contract.data) {
				try {
					subZip[file.filename] = strToU8("ทดสอบ Fflate\n");
				} catch (error) {
					console.error(`Failed to add file ${file.filename}:`, error);
				}
			}
	
			const subZipBlob = zipSync(subZip);
	
			const subZipFilename = `${contract.contractNo}_${contract.contractSequence}.zip`;
			mainZip[subZipFilename] = subZipBlob;
		}
	
		const mainZipBlob = zipSync(mainZip);

		// compress each contract in parallel
		// const mainZipEntries: { [key: string]: Uint8Array } = {};

		// await Promise.all(
		// 	apiData.map(async (contract) => {
		// 		const subZipEntries: { [key: string]: Uint8Array } = {};
		// 		contract.data.forEach((file: any) => {
		// 			subZipEntries[file.filename] = strToU8(`ทดสอบไฟล์ที่ ${file.receiptId}`);
		// 		});

		// 		const subZipBlob = await new Promise<Uint8Array>((resolve, reject) => {
		// 			zip(subZipEntries, {}, (err, data) => {
		// 				if (err) {
		// 					reject(err);
		// 				} else {
		// 					resolve(data);
		// 				}
		// 			});
		// 		});

		// 		mainZipEntries[`${contract.contractNo}_${contract.contractSequence}.zip`] = subZipBlob;
		// 	})
		// );

		// const mainZipBlob2 = await new Promise<Uint8Array>((resolve, reject) => {
		// 	zip(mainZipEntries, {}, (err, data) => {
		// 		if (err) {
		// 			reject(err);
		// 		} else {
		// 			resolve(data);
		// 		}
		// 	});
		// });

		const base64Zip = btoa(String.fromCharCode(...new Uint8Array(mainZipBlob.buffer)));

		const downloadLink = document.createElement('a');
		downloadLink.href = `data:application/zip;base64,${base64Zip}`;
		downloadLink.download = 'Main 2.zip';
		downloadLink.click();
	}

	private async getMockApiData(): Promise<any[]> {
		return [
			{
				contractId: '1',
				contractNo: 'C001',
				contractSequence: '01',
				data: [
					{ receiptId: '1', receiptNo: 'P001', receiptSequence: '1', fileId: 'F001', filename: 'File1.txt', fileSize: 2048 },
					{ receiptId: '2', receiptNo: 'P002', receiptSequence: '2', fileId: 'F002', filename: 'File2.txt', fileSize: 2048 },
					{ receiptId: '3', receiptNo: 'P003', receiptSequence: '3', fileId: 'F003', filename: 'File3.txt', fileSize: 2048 },
					{ receiptId: '4', receiptNo: 'P004', receiptSequence: '4', fileId: 'F004', filename: 'File4.txt', fileSize: 2048 },
					{ receiptId: '5', receiptNo: 'P005', receiptSequence: '5', fileId: 'F005', filename: 'File5.txt', fileSize: 2048 },
					{ receiptId: '6', receiptNo: 'P006', receiptSequence: '6', fileId: 'F006', filename: 'File6.txt', fileSize: 2048 },
					{ receiptId: '7', receiptNo: 'P007', receiptSequence: '7', fileId: 'F007', filename: 'File7.txt', fileSize: 2048 },
					{ receiptId: '8', receiptNo: 'P008', receiptSequence: '8', fileId: 'F008', filename: 'File8.txt', fileSize: 2048 },
					{ receiptId: '9', receiptNo: 'P009', receiptSequence: '9', fileId: 'F009', filename: 'File9.txt', fileSize: 2048 },
					{ receiptId: '10', receiptNo: 'P010', receiptSequence: '10', fileId: 'F010', filename: 'File10.txt', fileSize: 2048 },
				],
			},
			{
				contractId: '2',
				contractNo: 'C002',
				contractSequence: '02',
				data: [
					{ receiptId: '11', receiptNo: 'P011', receiptSequence: '1', fileId: 'F011', filename: 'File11.txt', fileSize: 2048 },
				],
			},
		];
	}
	
}
