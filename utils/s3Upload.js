import { Upload } from "@aws-sdk/lib-storage";
import s3 from "../config/s3Config.js";

export const uploadBufferToS3 = async ({
  buffer,
  bucketName,
  key,
  contentType,
}) => {
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  };

  const parallelUploads3 = new Upload({
    client: s3,
    params,
  });

  await parallelUploads3.done();

  const url = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  return { url, key };
};

export default uploadBufferToS3;
