require("../../../engine/core").enableTesting();
var fs = require("fs");
const fsExt = require('../../../libraries/utils/FSExtension').fsExt;
const assert = require("../../../modules/double-check").assert;
var fsm = require("../../../libraries/utils/FileStateManager");
var fileStateManager = fsm.getFileStateManager();

$$.loadLibrary("deployer", __dirname + "/../../../libraries/deployer");

const path = require("path");
var testWorkspaceDir = "./" + fsExt.guid();
var dependencyTarget = path.join(testWorkspaceDir, "js");

var dependencyName = "double-check";

var f = $$.flow.create("cloneActionNoOptionsTest", {
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
                    "src": "https://github.com/PrivateSky/double-check",
                    "actions": [{
                        "type": "clone",
                        "target": dependencyTarget
                    }]
                }
            ]
        };
        fileStateManager.saveState([testWorkspaceDir]);
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
        let dependencyPath = fsExt.resolvePath(dependencyTarget + "/" + dependencyName);
        assert.true(fs.existsSync(dependencyPath), `[FAIL] Dependency "${dependencyPath}" does not exist!`);
        this.end();
    }
});
assert.callback("cloneActionNoOptionsTest", function(end) {
    setTimeout(function(){
        console.log("Forcing clean");
        f.clean();
    }, 1500);
    f.start(end);
});
