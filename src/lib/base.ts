import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';



export interface SNIBaseStackProps extends StackProps {
}

export class SNIBaseStack extends Stack {
  hostedZone: route53.IHostedZone;
  redCert: acm.Certificate;
  blueCert: acm.Certificate;
  vpc: ec2.IVpc;
  constructor(scope: Construct, id: string, props: SNIBaseStackProps) {
    super(scope, id, props);

    // import hosted zone
    this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: 'jeremyritchie.com',
    });

    // create two acm certs
    this.redCert = new acm.Certificate(this, 'Certificate1', {
        domainName: 'red.jeremyritchie.com',
        validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });

    this.blueCert = new acm.Certificate(this, 'Certificate2', {
        domainName: 'blue.jeremyritchie.com',
        validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });

    // create one vpc
    this.vpc = new ec2.Vpc(this, 'VPC', {
        maxAzs: 2,
        createInternetGateway: true,
        subnetConfiguration: [
            {
                name: 'public',
                subnetType: ec2.SubnetType.PUBLIC,
            },
        ],
        natGateways: 0,
    })

  }
}