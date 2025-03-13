import java.io.*;
import java.util.zip.*;
import java.util.List;
import java.util.ArrayList;

public class NestedZipCreator {

    public static void main(String[] args) {
        List<Contract> apiData = List.of(
            new Contract("1", "C001", "01", List.of(
                new FileData("1", "P001", "1", "F001", "File1.txt", 2048),
                new FileData("2", "P002", "2", "F002", "File2.txt", 2048)
            )),
            new Contract("2", "C002", "02", List.of(
                new FileData("11", "P011", "1", "F011", "File11.txt", 2048)
            ))
        );

        try {
            createNestedZip(apiData, "Main.zip");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public static void createNestedZip(List<Contract> apiData, String mainZipName) throws IOException {
        try (FileOutputStream fos = new FileOutputStream(mainZipName);
             ZipOutputStream mainZip = new ZipOutputStream(fos)) {

            for (Contract contract : apiData) {
                ByteArrayOutputStream subZipStream = new ByteArrayOutputStream();
                try (ZipOutputStream subZip = new ZipOutputStream(subZipStream)) {

                    for (FileData file : contract.data) {
                        String content = "Hello World\n";
                        ZipEntry subEntry = new ZipEntry(file.filename);
                        subZip.putNextEntry(subEntry);
                        subZip.write(content.getBytes());
                        subZip.closeEntry();
                    }
                }

                byte[] subZipBytes = subZipStream.toByteArray();
                String subZipName = contract.contractNo + "_" + contract.contractSequence + ".zip";

                ZipEntry mainEntry = new ZipEntry(subZipName);
                mainZip.putNextEntry(mainEntry);
                mainZip.write(subZipBytes);
                mainZip.closeEntry();
            }
        }
    }

    static class Contract {
        String contractId;
        String contractNo;
        String contractSequence;
        List<FileData> data;

        public Contract(String contractId, String contractNo, String contractSequence, List<FileData> data) {
            this.contractId = contractId;
            this.contractNo = contractNo;
            this.contractSequence = contractSequence;
            this.data = data;
        }
    }

    static class FileData {
        String receiptId;
        String receiptNo;
        String receiptSequence;
        String fileId;
        String filename;
        int fileSize;

        public FileData(String receiptId, String receiptNo, String receiptSequence, String fileId, String filename, int fileSize) {
            this.receiptId = receiptId;
            this.receiptNo = receiptNo;
            this.receiptSequence = receiptSequence;
            this.fileId = fileId;
            this.filename = filename;
            this.fileSize = fileSize;
        }
    }
}
