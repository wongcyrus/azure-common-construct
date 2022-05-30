const { cdktf } = require('projen');
const project = new cdktf.ConstructLibraryCdktf({
  author: 'Cyrus Wong',
  authorAddress: 'cywong@vtc.edu.hk',
  cdktfVersion: '^0.8.3',
  defaultReleaseBranch: 'main',
  name: 'AzureConstructLib',
  repositoryUrl: 'https://github.com/wongcyrus/AzureConstructLib.git',

  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // devDeps: [],             /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
});
project.synth();