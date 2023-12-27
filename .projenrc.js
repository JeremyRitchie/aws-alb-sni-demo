const { awscdk } = require('projen');
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.114.1',
  defaultReleaseBranch: 'main',
  name: 'aws-alb-sni-demo',

  deps: [
    'exponential-backoff',
    'cdk-nag',
  ],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  devDeps: [
    'aws-sdk',
    '@aws-sdk/client-network-firewall',
    '@aws-sdk/client-sfn',
    '@aws-sdk/client-ssm',
    '@aws-sdk/util-arn-parser',
    '@types/aws-lambda',
  ],             /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
  depsUpgrade: false
});
project.synth();