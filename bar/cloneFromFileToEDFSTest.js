require("../../../psknode/bundles/pskruntime");
require("../../../psknode/bundles/psknode");
require("../../../psknode/bundles/virtualMQ");

require("callflow");
const bar = require('bar');
const createEdfsBrickStorage = require("edfs-brick-storage").createEDFSBrickStorage;
const double_check = require("../../../modules/double-check");
const assert = double_check.assert;
const Archive = bar.Archive;
const ArchiveConfigurator = bar.ArchiveConfigurator;
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

let folderPath;
let filePath;
let savePath;
let cloneStoragePath;


let folders;
let files;

let PORT = 9090;
const tempFolder = "../../tmp";

const VirtualMQ = require("virtualmq");

const text = ["asta e un text", "asta e un alt text", "ana are mere"];

$$.flows.describe("BarClone", {
    start: function (callback) {
        this.callback = callback;

        double_check.ensureFilesExist(folders, files, text, (err) => {
            assert.true(err === null || typeof err === "undefined", "Failed to create folder hierarchy.");

            double_check.computeFoldersHashes(folderPath, (err, initialHashes) => {
                assert.true(err === null || typeof err === "undefined", "Failed to compute folder hashes.");

                this.initialHashes = initialHashes;
                this.createServer();
            });
        });

    },

    createServer: function () {
        let server = VirtualMQ.createVirtualMQ(PORT, tempFolder, undefined, (err, res) => {
            if (err) {
                console.log("Failed to create VirtualMQ server on port ", PORT);
                console.log("Trying again...");
                if (PORT > 0 && PORT < 50000) {
                    PORT++;
                    this.createServer((err) => {
                        if (err) {
                            throw err;
                        }
                    });
                } else {
                    throw err;
                }
            } else {
                console.log("Server ready and available on port ", PORT);
                let url = `http://127.0.0.1:${PORT}`;
                this.server = server;
                this.url = url;
                this.createArchive();
            }
        });
    },

    createArchive: function () {
        this.archiveConfigurator = new ArchiveConfigurator();
        this.archiveConfigurator.setStorageProvider("FileBrickStorage", savePath);
        this.archiveConfigurator.setFsAdapter("FsAdapter");
        this.archiveConfigurator.setBufferSize(2);
        // this.archiveConfigurator.setMapEncryptionKey(crypto.randomBytes(32));
        this.archive = new Archive(this.archiveConfigurator);

        this.edfsBrickStorage = createEdfsBrickStorage(this.url);
        this.addFolder();
    },

    addFolder: function () {
        this.archive.addFolder(folderPath, (err, mapDigest) => {
            assert.true(err === null || typeof err === "undefined", "Failed to add folder.");

            double_check.deleteFoldersSync(folderPath);
            this.cloneBar();
        });
    },

    cloneBar: function () {
        this.archive.clone(this.edfsBrickStorage, true, (err, mapDigest) => {
            assert.true(err === null || typeof err === "undefined", `Failed to delete file ${filePath}`);
            assert.true(mapDigest !== null && typeof mapDigest !== "undefined", "Map digest is null or undefined");

            this.archiveConfigurator.setMapDigest(mapDigest);
            this.extractFolder();
        });
    },

    extractFolder: function () {
        this.archiveConfigurator.setStorageProvider("EDFSBrickStorage", this.url);
        const archive = new Archive(this.archiveConfigurator);
        archive.extractFolder(folderPath, (err) => {
            assert.true(err === null || typeof err === "undefined", `Failed to extract folder from file ${savePath}`);

            double_check.computeFoldersHashes(folderPath, (err, newHashes) => {
                assert.true(err === null || typeof err === "undefined", "Failed to compute folder hashes.");
                assert.hashesAreEqual(this.initialHashes, newHashes, "The extracted files are not te same as the initial ones");

                double_check.deleteFoldersSync([folderPath]);
                fs.unlinkSync(savePath);

                this.server.close((err) => {
                    assert.true(err === null || typeof err === "undefined", "Failed to close server.");

                    this.callback();
                });
            });
        });
    }
});

double_check.createTestFolder("bar_test_folder", (err, testFolder) => {

    folderPath = path.join(testFolder, "fld");
    savePath = path.join(testFolder, "dot");
    cloneStoragePath = path.join(testFolder, "aux");

    folders = [folderPath, cloneStoragePath];
    files = ["fld/a.txt", "fld/b.txt", "fld/c.txt"].map(file => path.join(testFolder, file));

    assert.callback("Bar clone test", (callback) => {
        $$.flows.start("BarClone", "start", callback);
    }, 90000);
});