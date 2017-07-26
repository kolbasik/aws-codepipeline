# aws-codepipeline

```bash
aws cloudformation package --template-file serverless.yml --output-template-file serverless-output.yml --s3-prefix github --s3-bucket $s3-bucket
aws cloudformation deploy --capabilities CAPABILITY_IAM --template-file serverless-output.yml --stack-name github
```