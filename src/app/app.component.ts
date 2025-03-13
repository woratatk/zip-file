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
		/** spinner starts on init */
		this.spinner.show();
		
		setTimeout(() => {
		  /** spinner ends after 5 seconds */
		  this.spinner.hide();
		}, 2000);
	  }

	async zipMultipleZipFilesWithJsZip(): Promise<void> {
	  try {
		const data = await this.getMockApiZipData();
		const mainZip = new JSZip();
		this.totalContracts = data.length;
  
		for (let i = 0; i < this.totalContracts; i++) {
		  mainZip.file(data[i].fileName, data[i].fileData);
		  this.zipProgress = Math.round(((i + 1) / this.totalContracts) * 100);
		}
  
		const mainZipBlob = await mainZip.generateAsync({ type: 'blob' });
  
		const link = document.createElement('a');
		link.href = URL.createObjectURL(mainZipBlob);
		link.download = 'Main.zip';
		link.click();
	  } catch (error) {
		console.error(error);
	  }
	}

	async zipMultipleZipFilesWithJsZipDelay(): Promise<void> {
		try {
		  const data = await this.getMockApiZipData();
		  const mainZip = new JSZip();
		  this.totalContracts = data.length;
		  this.zipProgress = 0;
	  
		  for (let i = 0; i < this.totalContracts; i++) {
			const contract = data[i];
	  
			mainZip.file(contract.fileName, contract.fileData);
	  
			await new Promise(resolve => setTimeout(resolve, 500));
	  
			this.zipProgress = Math.round(((i + 1) / this.totalContracts) * 100);
		  }
	  
		  const mainZipBlob = await mainZip.generateAsync({ type: 'blob' });
	  
		  const link = document.createElement('a');
		  link.href = URL.createObjectURL(mainZipBlob);
		  link.download = 'Main_1.zip';
		  link.click();
	  
		} catch (error) {
		  console.log(error);
		}
	}

	private async getMockApiZipData(): Promise<ZipObject[]> {
		const mockZipContent = new Uint8Array([80, 75, 3, 4, 20, 0, 0, 0, 8, 0]); // Mock ZIP file header
	
		return [
			{
				fileName: 'TAX_RECEIPT_CT0XXXXXX1.zip',
				fileData: mockZipContent,
			},
			{
				fileName: 'TAX_RECEIPT_CT0XXXXXX2.zip',
				fileData: mockZipContent,
			},
			{
				fileName: 'TAX_RECEIPT_CT0XXXXXX3.zip',
				fileData: mockZipContent,
			},
			{
				fileName: 'TAX_RECEIPT_CT0XXXXXX4.zip',
				fileData: mockZipContent,
			},
			{
				fileName: 'TAX_RECEIPT_CT0XXXXXX5.zip',
				fileData: mockZipContent,
			},
			{
				fileName: 'TAX_RECEIPT_CT0XXXXXX6.zip',
				fileData: mockZipContent,
			},
			{
				fileName: 'TAX_RECEIPT_CT0XXXXXX7.zip',
				fileData: mockZipContent,
			},
			{
				fileName: 'TAX_RECEIPT_CT0XXXXXX8.zip',
				fileData: mockZipContent,
			},
			{
				fileName: 'TAX_RECEIPT_CT0XXXXXX9.zip',
				fileData: mockZipContent,
			},
			{
				fileName: 'TAX_RECEIPT_CT0XXXXX10.zip',
				fileData: mockZipContent,
			},
		];
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
