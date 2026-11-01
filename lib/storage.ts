import { S3Client } from "@aws-sdk/client-s3";

export function getStorage() {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Image storage is not configured");
  }
  return {
    bucket,
    client: new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: !!process.env.S3_ENDPOINT,
    }),
  };
}
