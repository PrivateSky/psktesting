require("../../../engine/core").enableTesting();
var fs = require("fs");
const fsExt = require('../../../libraries/utils/FSExtension').fsExt;
const assert = require("../../../modules/double-check").assert;
var fsm = require("../../../libraries/utils/FileStateManager");
var fileStateManager = fsm.getFileStateManager();

$$.loadLibrary("deployer", __dirname + "/../../../libraries/deployer");

const path = require("path");
var testWorkspaceDir = "./" + fsExt.guid();
var dummyTargetWorkDir = fsExt.resolvePath(testWorkspaceDir);
var dummyTargetDir = path.join(testWorkspaceDir, "./node_modules");
var dependencyName = "transrest";


var f = $$.flow.create("installActionTest", {
    start:function(end) {
        this.end = end;
        this.beforeExecution();
        this.act();
    },

    beforeExecution:function() {
        this.configObject = {
            "dependencies": [
                {
                    "name": dependencyName,
                    "src": "https://github.com/PrivateSky/transrest",
                    "workDir": dummyTargetWorkDir,
                    "actions": ["install"]
                }
            ]
        };
        fileStateManager.saveState([testWorkspaceDir]);
        fsExt.createDir(dummyTargetDir);
    },

    act:function() {
        $$.callflow.start("deployer.Deployer").run(this.configObject, this.callback);
    },

    clean:function(){
        console.log("restoring");
        fileStateManager.restoreState();
    },

    callback:function(error, result) {
        assert.notNull(result, "Result should not be null!");
        assert.isNull(error, "Should not be any errors!");
        let targetPath = fsExt.resolvePath(path.join(dummyTargetDir, dependencyName));
        assert.true(fs.existsSync(targetPath), `[FAIL] Dependency "${dependencyName}" does not exist in ${dummyTargetDir}`);
        this.end();

    }
});
assert.callback("installActionTest", function(end) {
    setTimeout(function(){
        console.log("Forcing clean");
        f.clean();
    }, 7000);
    f.start(end);
},5000);

