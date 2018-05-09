require("../../../engine/core").enableTesting();
const assert = require("../../../modules/double-check").assert;
var f = $$.flow.create("assertObjectHasFields",{
    action:function(cb){
        this.testData = [{location:[1, 2, 3]}, {location:[1, 2, 3]}, {name:"john"}, {name:"adrian"}, {age:24}, {age:24, citty:"iasi"}];
        this.cb = cb;
        for (var i = 0; i < this.testData.length; i++) {
            assert.objectHasFields(this.testData[i], this.testData[i+1]);
            i+=1;
        };
        this.cb();
    }
});
assert.callback("assertObjectHasFields", function(cb){
    f.action(cb);
}, 1500);