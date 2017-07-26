# aws-codepipeline

```bash
aws cloudformation package --template-file serverless.yml --output-template-file serverless-output.yml --s3-prefix github --s3-bucket $s3-bucket
aws cloudformation deploy --capabilities CAPABILITY_IAM --template-file serverless-output.yml --stack-name github
```

## Bucket Policy
```javascript
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::[LOCAL_ACCOUNT]:root"
            },
            "Action": "s3:*",
            "Resource": "arn:aws:s3:::[BUCKET_NAME]/*"
        },
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::[REMOTE_ACCOUNT]:root"
            },
            "Action": "s3:PutObject",
            "Resource": "arn:aws:s3:::[BUCKET_NAME]/*",
            "Condition": {
                "StringEquals": {
                    "s3:x-amz-acl": "bucket-owner-full-control"
                }
            }
        }
    ]
}
```