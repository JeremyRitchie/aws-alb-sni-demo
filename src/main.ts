import { App } from 'aws-cdk-lib';
import { SNIApplicationStack } from './lib/app';

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: "us-east-1",
};

const app = new App();

new SNIApplicationStack(app, 'aws-alb-sni-demo-dev', { env: devEnv });

app.synth();