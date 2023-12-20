import { App } from 'aws-cdk-lib';
import { SNIECSStack } from './lib/ecs';
import { SNIBaseStack } from './lib/base';
import { SNIALBStack } from './lib/alb';

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: "us-east-1",
};

const app = new App();

const baseStack = new SNIBaseStack(app, 'base-ani-demo', { env: devEnv });
const ecsStack = new SNIECSStack(app, 'ecs-ani-demo', {
   env: devEnv,
   baseStack: baseStack,
   });
new SNIALBStack(app, 'alb-ani-demo', {
  env: devEnv,
  baseStack: baseStack,
  ecsStack: ecsStack,
});


app.synth();