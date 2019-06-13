const tir = require('./../test-util/tir.js');
const assert = require('double-check').assert;
const domain = 'local';
const agents = ['hq', 'mi6'];

const swarms = {
	intel: {
		public: {
			a2: 'integer',
			a1: {
				test: this.a2,
			},
			result: 'integer',
		},
		begin: function(a1, a2) {
			console.info('--------- WE ARE THIS:', this);
			this.return(this.result);
		},
	},
};

assert.callback(
	'Swarm Structure Phase ref checking',
	finished => {
		tir.addDomain(domain, agents, swarms).launch(3000, () => {
			tir.interact('local', 'hq')
				.startSwarm('intel', 'begin', 1, 2)
				.onReturn(result => {
					console.log('Test should not pass. No ref allowrd in object definition'); // finished();
				});
		});
	},
	2000
);
