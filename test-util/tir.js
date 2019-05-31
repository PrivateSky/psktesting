/**
 * Test Integration Runner
 *
 * This API abstracts the setup, initialization and
 * the internal butchery for PSKY.
 *
 */

/* Example:

const tir = require('./tir');
const assert = require('double-check').assert;

const domain = 'local';
const agents = ['exampleAgent'];

const swarm = {
  echo: {
    say: function(input) {
      this.return("Echo " + input);
    }
  },
  notifier: {
    init: function (encryptedSeed) {
      this.encryptedSeed = encryptedSeed;
    }
  }
};


assert.callback('Local connection testing', (finished) => {
  tir.addDomain(domain, agents, swarm).launch(5000, () => {
    tir.interact('local', 'exampleAgent').startSwarm("echo", "say", "Hello").onReturn(result => {
      assert.equal("Echo Hello", result);
      finished();
      tir.tearDown(0);
    });
  });
}, 3500);


*/

require("./../../../builds/devel/pskruntime.js");
require('./../../../builds/devel/psknode');
require('./../../../builds/devel/consoleTools');

const os = require('os');
const path = require('path');
const fs = require('fs');
const interact = require('interact');

const child_process = require("child_process");
const pskdb = require('pskdb');

const createKey = function (name) {
  let parsed = ('' + name);
  parsed.replace(/^[A-Za-z0-9 ]+/g, ' ');
  return parsed
    .split(' ')
    .map((word, idx) => idx === 0 ? word.toLocaleLowerCase() : word.substr(0, 1).toLocaleUpperCase() + word.toLowerCase().substr(1))
    .join('');
};

const rmDeep = (folder) => {
  if (fs.existsSync(folder)) {
    fs.readdirSync(folder).forEach((file) => {
      const curPath = path.join(folder, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        rmDeep(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(folder);
  }
};

const createConstitution = (prefix, describer, options) => {
  let opts = Object.assign({
    nl: '\n',
    semi: ';',
    tab: '  '
  }, options);

  const file = path.join(prefix, 'constitution.js');
  const contents = Object.keys(describer).reduce((c, name) => {
    let line = '$$.swarms.describe(\'' + name + '\', {';
    line += Object.keys(describer[name]).reduce((f, prop) => {
      if (typeof describer[name][prop] === 'object') {
        f.push(opts.nl + opts.tab + prop + ': ' + JSON.stringify(describer[name][prop]));
      } else {
        f.push(opts.nl + opts.tab + prop + ': ' + describer[name][prop].toString());
      }
      return f;
    }, []).join(',');
    line += opts.nl + '})' + opts.semi;
    c.push(line);
    return c;
  }, []).join(opts.nl);
  fs.writeFileSync(file, contents);
  return file;
};

const Tir = function () {

  const domainConfigs = {};
  const rootFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'psk_'));

  let testerNode = null;


  /**
   * Adds a domain to the configuration, in a fluent way.
   * Does not launch anything, just stores the configuration.
   * 
   * @param string domain The name of the domain
   * @param array agents The agents to be inserted
   * @param object|string constitution The swarm describer, either as an object or as a string file path
   * @returns this
   */
  this.addDomain = (domain, agents, constitution) => {
    let workspace = path.join(rootFolder, 'nodes', createKey(domain));
    let domainConfig = {
      name: domain,
      agents,
      constitution,
      workspace: workspace,
      conf: path.join(workspace, 'conf'),
      inbound: path.join(workspace, 'inbound'),
      outbound: path.join(workspace, 'outbound')
    };
    domainConfigs[domain] = domainConfig;
    return this;
  };


  /**
   * Launches all the configured domains.
   * 
   * @param integer tearDownAfter The number of miliseconds the TIR will tear down, even if the test fails. If missing, you must call tearDown
   * @param function callable The callback
   */
  this.launch = (tearDownAfter, callable) => {

    if (callable === undefined && tearDownAfter.call) {
      callable = tearDownAfter;
      tearDownAfter = null;
    }

    if (testerNode !== null) {
      throw new Error('Test node already launched!');
      return;
    }
    console.info('[TIR] setting working folder root', rootFolder);

    const confFolder = path.join(rootFolder, 'conf');

    console.info('[TIR] pskdb on', confFolder)
    pskdb.startDB(confFolder);

    fs.mkdirSync(path.join(rootFolder, 'nodes'));

    console.info('[TIR] start building nodes...');
    Object.keys(domainConfigs).forEach(name => {
      const domainConfig = domainConfigs[name];
      this.buildDomainConfiguration(domainConfig);
    });

    testerNode = child_process.spawn("node", ["./../../../engine/launcher", confFolder, rootFolder], {stdio:"inherit"});

    setTimeout(() => {
      if (tearDownAfter !== null) {
        setTimeout(() => this.tearDown(1), tearDownAfter);
      }
      callable();

    }, 10);
  };


  /**
   * Builds the config for a node.
   * 
   * @param object domainConfig The domain configuration stored by addDomain
   */
  this.buildDomainConfiguration = (domainConfig) => {

    console.info('[TIR] domain ' + domainConfig.name + ' in workspace', domainConfig.workspace);
    console.info('[TIR] domain ' + domainConfig.name + ' inbound', domainConfig.inbound);

    fs.mkdirSync(domainConfig.workspace);

    let constitutionFile = domainConfig.constitution;
    if (typeof domainConfig.constitution !== 'string') {
      constitutionFile = createConstitution(domainConfig.workspace, domainConfig.constitution);
    }

    let transaction = $$.blockchain.beginTransaction({});
    let domain = transaction.lookup('DomainReference', domainConfig.name);
    domain.init('system', domainConfig.name);
    domain.setWorkspace(domainConfig.workspace);
    domain.setConstitution(constitutionFile);
    domain.addLocalInterface('local', domainConfig.inbound);
    transaction.add(domain);
    $$.blockchain.commit(transaction);

    if (domainConfig.agents && Array.isArray(domainConfig.agents) && domainConfig.agents.length > 0) {
      let domainBlockChain = pskdb.createDBHandler(domainConfig.conf);
      console.info('[TIR] domain ' + domainConfig.name + ' starting agents...');

      domainConfig.agents.forEach(agentName => {
        console.info('[TIR] domain ' + domainConfig.name + ' agent', agentName);
        let trans = domainBlockChain.beginTransaction({});
        let agent = trans.lookup("Agent", agentName);
        trans.add(agent);
        domainBlockChain.commit(trans);
      });
    }
  };

  /**
   * Interacts with an agent of a domain.
   * 
   * @param string domain The name of the domain
   * @param string agent The name of the agent
   * @returns swarm
   */
  this.interact = (domain, agent) => {
    const domainConfig = domainConfigs[domain];
    if (domainConfig === undefined) {
      throw new Error('Could not find domain ' + domain + ' in ' + Object.keys(domainConfigs).join(', '));
    } else {
      var returnChannel = path.join(domainConfig.outbound, Math.random().toString(36).substr(2, 9));
      try{
        fs.mkdirSync(domainConfig.outbound);
      }catch(err){
        //dir allready exists
      }
      console.info('[TIR] Interacting with ' + domainConfig.name + '/' + agent + ' on', returnChannel);
      return interact.createNodeInteractionSpace(agent, domainConfig.inbound, returnChannel);
    }
  };

  /**
   * Tears down all the nodes
   * 
   * @param exitStatus The exit status, to exit the process.
   */
  this.tearDown = (exitStatus) => {
    console.info('[TIR] Tearing down...');
    if (testerNode) {
      console.info('[TIR] Killing node', testerNode.pid);
      process.kill(testerNode.pid);
      testerNode = null;
    }
    setTimeout(() => {
      try{
        console.info('[TIR] Removing temporary folder', rootFolder);
        rmDeep(rootFolder);
        console.info('[TIR] Temporary folder removed', rootFolder);
      }catch (e) {
        //just avoid to display error on console
      }

      if (exitStatus !== undefined) {
        process.exit(exitStatus);
      }

    }, 100);
  };
}

module.exports = new Tir();
